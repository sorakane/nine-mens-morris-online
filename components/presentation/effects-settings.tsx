'use client';
import { useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { EffectsMode } from '@/lib/presentation/director';
const options = [
  { value: 'full', label: '通常の演出' },
  { value: 'reduced', label: '控えめな演出' },
];
export function EffectsSettings({
  mode,
  onChange,
}: {
  mode: EffectsMode;
  onChange: (mode: EffectsMode) => void;
}) {
  const previousMode = useRef<Exclude<EffectsMode, 'off'> | null>(null);
  const enabled = mode !== 'off';
  return (
    <div className="effects-settings">
      <div className="effects-toggle-row">
        <label htmlFor="effects-enabled">ゲーム演出</label>
        <div className="effects-toggle-control">
          <span className="effects-toggle-status" aria-hidden="true">
            {enabled ? 'ON' : 'OFF'}
          </span>
          <Switch
            id="effects-enabled"
            className="effects-switch"
            checked={enabled}
            onCheckedChange={(checked) => {
              if (!checked) {
                if (mode !== 'off') previousMode.current = mode;
                onChange('off');
              } else {
                onChange(
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'reduced'
                    : (previousMode.current ?? 'full'),
                );
              }
            }}
            aria-describedby="effects-description"
          />
        </div>
      </div>
      {enabled && (
        <>
          <label id="effects-mode-label" className="sr-only">
            演出の強さ
          </label>
          <Select
            value={mode}
            items={options}
            onValueChange={(value) => {
              if (value === 'full' || value === 'reduced') onChange(value);
            }}
          >
            <SelectTrigger aria-labelledby="effects-mode-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      <p id="effects-description">
        {mode === 'full'
          ? '短いカットインとインパクト。'
          : mode === 'reduced'
            ? '揺れ・フラッシュなしで、結果を穏やかに表示。'
            : 'カットインや動く演出を表示しません。'}{' '}
        この端末だけに適用します。
      </p>
    </div>
  );
}
