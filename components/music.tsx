'use client';
import { useEffect, useRef, useState } from 'react';
import { TableMusic } from '@/lib/music';
import { Slider } from '@/components/ui/slider';
export function Music() {
  const music = useRef<TableMusic | null>(null),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(22),
    [error, setError] = useState('');
  useEffect(
    () => () => {
      music.current?.close();
    },
    [],
  );
  async function toggle() {
    try {
      setError('');
      music.current ??= new TableMusic(setPlaying);
      music.current.setVolume(volume);
      if (playing) {
        await music.current.pause();
        setPlaying(false);
      } else {
        await music.current.play();
        setPlaying(true);
      }
    } catch {
      setError('音楽を再生できませんでした。もう一度お試しください。');
    }
  }
  return (
    <div className="music">
      <button
        className={`music-toggle ${playing ? 'on' : ''}`}
        aria-pressed={playing}
        onClick={() => void toggle()}
      >
        {playing ? '♫ BGM 再生中' : '♫ BGMを流す'}
      </button>
      <div className="music-volume">
        <span id="bgm-volume">音量</span>
        <Slider
          aria-labelledby="bgm-volume"
          value={[volume]}
          min={0}
          max={60}
          step={1}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v;
            setVolume(n);
            music.current?.setVolume(n);
          }}
        />
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
