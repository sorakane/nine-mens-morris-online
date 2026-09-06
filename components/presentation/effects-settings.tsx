'use client';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { EffectsMode } from '@/lib/presentation/director';
const options = [
  { value: 'full', label: 'Full Effects' },
  { value: 'reduced', label: 'Reduced Effects' },
  { value: 'off', label: 'Effects Off' },
];
export function EffectsSettings({
  mode,
  onChange,
}: {
  mode: EffectsMode;
  onChange: (mode: EffectsMode) => void;
}) {
  return (
    <div className="effects-settings">
      <label id="effects-mode-label">ゲーム演出</label>
      <Select
        value={mode}
        items={options}
        onValueChange={(value) => {
          if (value === 'full' || value === 'reduced' || value === 'off')
            onChange(value);
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
      <p>
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
