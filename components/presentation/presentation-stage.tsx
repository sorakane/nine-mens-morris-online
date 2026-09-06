'use client';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { POINTS } from '@/lib/game';
import type { ActiveEffect, EffectsMode } from '@/lib/presentation/director';
import { CutIn } from './cut-in';
import './presentation.css';
export function PresentationStage({
  active,
  mode,
  children,
}: {
  active: ActiveEffect | null;
  mode: EffectsMode;
  children: ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !active ||
      active.mode !== 'full' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const amount =
      active.intensity === 'finisher' ? 3 : active.kind === 'mill' ? 2 : 1.5;
    const animation = surface.current?.animate?.(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-amount}px,1px)` },
        { transform: `translate(${amount}px,-1px)` },
        { transform: 'translate(-1px,0)' },
        { transform: 'translate(0,0)' },
      ],
      {
        duration: 150,
        delay: active.kind === 'mill' ? 155 : 100,
        easing: 'cubic-bezier(0.23,1,0.32,1)',
      },
    );
    return () => animation?.cancel();
  }, [active]);
  const event = active?.event;
  const target = event?.target;
  const position =
    target !== null && target !== undefined
      ? {
          left: `${((POINTS[target][0] + 0.5) / 7) * 100}%`,
          top: `${((POINTS[target][1] + 0.5) / 7) * 100}%`,
        }
      : undefined;
  return (
    <div className="presentation-stage" data-effects={mode}>
      <div className="presentation-surface" ref={surface}>
        {children}
      </div>
      {active && (
        <div
          className={`fx-layer fx-${active.kind} fx-${active.mode} fx-${active.intensity} fx-player-${event!.player}`}
          key={event!.id}
          aria-hidden="true"
          style={{ '--fx-duration': `${active.duration}ms` } as CSSProperties}
        >
          <div className="fx-tint" />
          <div className="fx-speedlines" />
          <div className="fx-grid">
            {active.kind === 'mill' && (
              <svg className="fx-mill-markers" viewBox="-0.5 -0.5 7 7">
                {event!.mills.map((line, i) => (
                  <line
                    key={i}
                    x1={POINTS[line[0]][0]}
                    y1={POINTS[line[0]][1]}
                    x2={POINTS[line[2]][0]}
                    y2={POINTS[line[2]][1]}
                  />
                ))}
                {[...new Set(event!.mills.flat())].map((point) => (
                  <g key={point}>
                    <circle
                      cx={POINTS[point][0]}
                      cy={POINTS[point][1]}
                      r=".27"
                    />
                    <circle
                      className="fx-mill-core"
                      cx={POINTS[point][0]}
                      cy={POINTS[point][1]}
                      r=".19"
                    />
                  </g>
                ))}
              </svg>
            )}
            {active.kind === 'capture' && position && (
              <div className="fx-target" style={position}>
                <span className="fx-focus-ring" />
                <span className="fx-impact-star" />
                <span
                  className={`fx-captured-stone fx-stone-${event!.capturedStone}`}
                >
                  {event!.capturedStone === 1 ? '●' : '◆'}
                </span>
                <span className="fx-fragment fx-fragment-a" />
                <span className="fx-fragment fx-fragment-b" />
                <span className="fx-capture-label">TAKEN</span>
              </div>
            )}
          </div>
          <div className="fx-flash" />
          {active.kind === 'mill' && <CutIn effect={active} />}
        </div>
      )}
    </div>
  );
}
