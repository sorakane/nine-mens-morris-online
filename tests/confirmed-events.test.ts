import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { newGame } from '../lib/game.ts';
import { changeRoom, type SavedRoom } from '../lib/room.ts';
import { recordConfirmedEvent } from '../lib/confirmed-events.ts';

function setup() {
  let state: SavedRoom = {
    members: [0, 1, 2].map((i) => ({
      id: `p${i}`,
      name: `人${i}`,
      key: `k${i}`,
    })),
    round: 1,
    game: newGame(),
  };
  let revision = 0;
  function act(
    actor: number,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    const before = state.game;
    const next = changeRoom(state, actor, { action, ...extra });
    const canonical = structuredClone(next.game);
    recordConfirmedEvent(
      before,
      next,
      'room',
      ++revision,
      action,
      actor,
      10000 + revision,
    );
    a.deepEqual(
      next.game,
      canonical,
      'presentation annotation must not alter any game field',
    );
    state = next;
    return state;
  }
  act(0, 'select-players', { players: [2, 1] });
  act(0, 'start');
  return { act, get: () => state };
}
test('committed mill and capture retain both facts, correct actor, points and captured color', () => {
  const { act, get } = setup();
  for (const [actor, to] of [
    [2, 0],
    [1, 3],
    [2, 1],
    [1, 4],
    [2, 2],
  ])
    act(actor, 'move', { to });
  const mill = get().events!.at(-1)!;
  a.equal(mill.kind, 'mill');
  a.equal(mill.actorId, 'p2');
  a.equal(mill.player, 1);
  a.deepEqual(mill.mills, [[0, 1, 2]]);
  a.equal(mill.target, 2);
  act(2, 'move', { to: 3 });
  const capture = get().events!.at(-1)!;
  a.equal(capture.kind, 'capture');
  a.equal(capture.target, 3);
  a.equal(capture.capturedStone, 2);
  a.equal(get().game.board[3], 0);
  a.equal(capture.sequence, mill.sequence + 1);
  a.equal(capture.id, `room:${capture.sequence}`);
  a.deepEqual(
    get()
      .events!.slice(-2)
      .map((e) => e.kind),
    ['mill', 'capture'],
  );
});
test('invalid actions publish no event; undo and rounds preserve monotonically increasing IDs', () => {
  const { act, get } = setup();
  act(2, 'move', { to: 0 });
  const before = get();
  const cursor = before.eventCursor!;
  a.throws(() => act(0, 'move', { to: 3 }));
  a.deepEqual(get(), before);
  act(2, 'undo-request');
  a.equal(get().eventCursor, cursor);
  act(1, 'undo-approve');
  a.equal(get().events!.at(-1)!.kind, 'reset');
  a.equal(get().eventCursor, cursor + 1);
  a.equal(get().game.board[0], 0);
  act(1, 'resign');
  act(0, 'start');
  a.equal(get().round, 2);
  a.equal(get().eventCursor, cursor + 3);
  a.equal(new Set(get().events!.map((e) => e.id)).size, get().events!.length);
});
test('ledger retention stays bounded across rounds', () => {
  const { act, get } = setup();
  for (let i = 0; i < 20; i++) {
    act(1, 'resign');
    act(0, 'start');
  }
  a.equal(get().events!.length, 32);
  a.equal(get().eventCursor, 41);
  a.equal(get().events![0].sequence, 10);
  a.equal(get().events!.at(-1)!.sequence, 41);
});
