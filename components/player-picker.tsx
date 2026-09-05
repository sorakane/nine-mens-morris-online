'use client';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { Room } from '@/lib/game';
export function PlayerPicker({
  room,
  busy,
  onSave,
  onDirty,
}: {
  room: Room;
  busy: boolean;
  onSave: (players: number[]) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [white, setWhite] = useState<number | null>(
      room.nextPlayers[0] ?? null,
    ),
    [amber, setAmber] = useState<number | null>(room.nextPlayers[1] ?? null);
  useEffect(() => {
    setWhite(room.nextPlayers[0] ?? null);
    setAmber(room.nextPlayers[1] ?? null);
  }, [room.nextPlayers[0], room.nextPlayers[1]]);
  const valid = white !== null && amber !== null && white !== amber,
    changed =
      white !== (room.nextPlayers[0] ?? null) ||
      amber !== (room.nextPlayers[1] ?? null);
  useEffect(() => {
    onDirty(changed);
  }, [changed, onDirty]);
  const spectator = valid
    ? room.members.find((_, i) => i !== white && i !== amber)
    : null;
  return (
    <div className="player-picker">
      <h3>
        {room.game.status === 'finished' ? '次の対戦者を選ぶ' : '対戦者を選ぶ'}
      </h3>
      {['白 · 先手', '琥珀 · 後手'].map((label, c) => (
        <div key={label} className="pick-row">
          <span id={`player-label-${c}`}>{label}</span>
          <Select
            value={c === 0 ? white : amber}
            onValueChange={(v) => {
              if (c === 0) setWhite(v as number | null);
              else setAmber(v as number | null);
            }}
            disabled={busy}
            items={room.members.map((m, i) => ({ value: i, label: m.name }))}
          >
            <SelectTrigger aria-labelledby={`player-label-${c}`}>
              <SelectValue placeholder="選んでください" />
            </SelectTrigger>
            <SelectContent>
              {room.members.map((m, i) => (
                <SelectItem key={m.id} value={i}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <p>
        {valid
          ? `${spectator?.name || '残りの1人'} さんが観戦します。`
          : '別々の参加者を2人選んでください。'}
      </p>
      <button
        className="secondary"
        disabled={busy || !valid || !changed}
        onClick={() => onSave([white!, amber!])}
      >
        {changed ? 'この組み合わせにする' : 'この組み合わせで対戦'}
      </button>
    </div>
  );
}
