'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  PresentationDirector,
  type EffectsMode,
} from '@/lib/presentation/director';
import type { EventSnapshot } from '@/lib/presentation/events';
const STORAGE_KEY = 'morris.effects.v1';
const empty = () => null;
export function usePresentation() {
  const directorRef = useRef<PresentationDirector | null>(null);
  if (!directorRef.current) directorRef.current = new PresentationDirector();
  const director = directorRef.current;
  const [mode, setMode] = useState<EffectsMode>('reduced');
  const modeRef = useRef<EffectsMode>('reduced');
  const active = useSyncExternalStore(
    director.subscribe,
    director.getSnapshot,
    empty,
  );
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {}
    const initial: EffectsMode =
      saved === 'off'
        ? 'off'
        : preference.matches
          ? 'reduced'
          : saved === 'reduced'
            ? 'reduced'
            : 'full';
    director.setMode(initial);
    modeRef.current = initial;
    setMode(initial);
    const onMotion = () => {
      if (preference.matches && modeRef.current !== 'off') {
        director.setMode('reduced');
        modeRef.current = 'reduced';
        setMode('reduced');
      }
    };
    const onVisibility = () => director.disconnect();
    const onOffline = () => director.disconnect();
    preference.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('offline', onOffline);
    return () => {
      preference.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('offline', onOffline);
      director.disconnect();
    };
  }, [director]);
  const changeMode = useCallback(
    (value: EffectsMode) => {
      director.setMode(value);
      modeRef.current = value;
      setMode(value);
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {}
    },
    [director],
  );
  const receive = useCallback(
    (snapshot: EventSnapshot, latency = 0) => {
      try {
        director.receive(snapshot, { hidden: document.hidden, latency });
      } catch {
        director.disconnect();
      }
    },
    [director],
  );
  return { active, mode, changeMode, receive, disconnect: director.disconnect };
}
