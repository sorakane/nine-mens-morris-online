import { MILLS, type Game } from './game.ts';
import type { SavedRoom } from './room.ts';
import type { ConfirmedEvent } from './presentation/events.ts';
/** Called only after changeRoom succeeds, before the same compare-and-swap commit.
 * An unsuccessful write publishes neither state nor events. No gameplay mutation. */
export function recordConfirmedEvent(
  before: Game,
  state: SavedRoom,
  roomId: string,
  revision: number,
  action: unknown,
  actorIndex: number,
  now = Date.now(),
): void {
  let kind: ConfirmedEvent['kind'];
  if (action === 'move')
    kind = before.capture ? 'capture' : state.game.capture ? 'mill' : 'move';
  else if (['start', 'undo-approve', 'resign'].includes(String(action)))
    kind = 'reset';
  else return;
  const actor = state.members[actorIndex];
  if (!actor) return;
  const player = ((state.players || []).indexOf(actorIndex) + 1) as 0 | 1 | 2;
  const target = action === 'move' ? state.game.last : null;
  const sequence = (state.eventCursor || 0) + 1;
  const event: ConfirmedEvent = {
    id: `${roomId}:${sequence}`,
    sequence,
    revision,
    round: state.round,
    occurredAt: now,
    kind,
    actorId: actor.id,
    actorName: actor.name,
    player,
    mills:
      kind === 'mill' && target !== null
        ? MILLS.filter(
            (m) =>
              m.includes(target) &&
              m.every((p) => state.game.board[p] === player),
          ).map((m) => [...m])
        : [],
    target,
    capturedStone:
      kind === 'capture' && target !== null ? before.board[target] : 0,
    winner: state.game.winner,
  };
  state.eventCursor = sequence;
  state.events = [...(state.events || []), event].slice(-32);
}
