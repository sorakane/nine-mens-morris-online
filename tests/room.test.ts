import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { newGame } from '../lib/game.ts';
import { changeRoom, normalizeRoom, type SavedRoom } from '../lib/room.ts';
const fresh = (): SavedRoom => ({
  members: [0, 1, 2].map((i) => ({
    id: `p${i}`,
    name: `人${i}`,
    key: `key${i}`,
  })),
  round: 1,
  game: newGame(),
});
function started() {
  return changeRoom(
    changeRoom(fresh(), 0, { action: 'select-players', players: [2, 1] }),
    0,
    { action: 'start' },
  );
}
test('host chooses any pair, including being the spectator; pairing stays fixed', () => {
  let s = fresh();
  a.throws(() => changeRoom(s, 0, { action: 'start' }));
  a.throws(() =>
    changeRoom(s, 1, { action: 'select-players', players: [1, 2] }),
  );
  for (const players of [
    [1, 1],
    [0, 3],
    [0, -1],
    [0, 1.5],
  ])
    a.throws(() => changeRoom(s, 0, { action: 'select-players', players }));
  s = started();
  a.deepEqual(s.players, [2, 1]);
  a.throws(() => changeRoom(s, 0, { action: 'move', to: 0 }));
  a.throws(() =>
    changeRoom(s, 0, { action: 'select-players', players: [0, 1] }),
  );
  s = changeRoom(s, 1, { action: 'resign' });
  s = changeRoom(s, 0, { action: 'start' });
  a.deepEqual(s.players, [2, 1]);
  a.equal(s.round, 2);
});
test('undo requires both participants, freezes play, can be rejected or cancelled', () => {
  let s = changeRoom(started(), 2, { action: 'move', to: 0 });
  const board = structuredClone(s.game);
  a.throws(() => changeRoom(s, 0, { action: 'undo-request' }));
  s = changeRoom(s, 2, { action: 'undo-request' });
  for (const actor of [0, 2])
    a.throws(() => changeRoom(s, actor, { action: 'undo-approve' }));
  a.throws(() => changeRoom(s, 1, { action: 'move', to: 3 }));
  a.throws(() => changeRoom(s, 1, { action: 'resign' }));
  s = changeRoom(s, 1, { action: 'undo-reject' });
  a.deepEqual(s.game, board);
  s = changeRoom(s, 1, { action: 'undo-request' });
  a.throws(() => changeRoom(s, 2, { action: 'undo-cancel' }));
  s = changeRoom(s, 1, { action: 'undo-cancel' });
  a.equal(s.undo, null);
  s = changeRoom(s, 1, { action: 'undo-request' });
  s = changeRoom(s, 2, { action: 'undo-approve' });
  a.deepEqual(s.game, started().game);
  a.equal(s.history!.length, 0);
  a.throws(() => changeRoom(s, 2, { action: 'undo-request' }));
});
test('mill placement and capture undo as one complete turn, including reserve and turn', () => {
  let s = started();
  for (const [actor, to] of [
    [2, 0],
    [1, 3],
    [2, 1],
    [1, 4],
  ])
    s = changeRoom(s, actor, { action: 'move', to });
  const before = structuredClone(s.game);
  s = changeRoom(s, 2, { action: 'move', to: 2 });
  a.equal(s.game.capture, true);
  a.equal(s.activity?.mill, true);
  const length = s.history!.length;
  s = changeRoom(s, 2, { action: 'move', to: 3 });
  a.equal(s.history!.length, length);
  a.equal(s.activity?.removed, 3);
  a.equal(s.activity?.to, 2);
  s = changeRoom(s, 2, { action: 'undo-request' });
  s = changeRoom(s, 1, { action: 'undo-approve' });
  a.deepEqual(s.game, before);
});
test('undo while a capture is pending restores before the mill', () => {
  let s = started();
  for (const [actor, to] of [
    [2, 0],
    [1, 3],
    [2, 1],
    [1, 4],
  ])
    s = changeRoom(s, actor, { action: 'move', to });
  const before = structuredClone(s.game);
  s = changeRoom(s, 2, { action: 'move', to: 2 });
  s = changeRoom(s, 1, { action: 'undo-request' });
  s = changeRoom(s, 2, { action: 'undo-approve' });
  a.deepEqual(s.game, before);
});
test('legacy rooms retain active colors and gain new fields without resetting game', () => {
  const old = fresh();
  old.round = 2;
  old.game.status = 'playing';
  old.game.board[0] = 1;
  const s = normalizeRoom(old);
  a.deepEqual(s.players, [1, 2]);
  a.equal(s.game.board[0], 1);
  a.equal(s.history!.length, 0);
});
test('changing next pair after a game keeps the finished winner attached to original players', () => {
  let s = started();
  s = changeRoom(s, 1, { action: 'resign' });
  s = changeRoom(s, 0, { action: 'select-players', players: [0, 2] });
  a.deepEqual(s.players, [2, 1]);
  a.equal(s.game.winner, 1);
  a.deepEqual(s.nextPlayers, [0, 2]);
  s = changeRoom(s, 0, { action: 'start' });
  a.deepEqual(s.players, [0, 2]);
  a.equal(s.history!.length, 0);
});

test('two participants can start with or without an optional spectator seat', () => {
  for (const capacity of [2, 3] as const) {
    const s = fresh();
    s.capacity = capacity;
    s.members = s.members.slice(0, 2);
    const selected = changeRoom(s, 0, {
      action: 'select-players',
      players: [0, 1],
    });
    const playing = changeRoom(selected, 0, { action: 'start' });
    a.equal(playing.game.status, 'playing');
    a.equal(playing.members.length, 2);
    a.equal(playing.spectatorsAllowed, capacity === 3);
  }
});

test('legacy three-seat rooms now allow spectators without a capacity guard', () => {
  const s = fresh();
  s.capacity = 3;
  const normalized = normalizeRoom(s);
  a.equal(normalized.spectatorsAllowed, true);
  for (let i = 3; i < 10; i++)
    s.members.push({ id: `p${i}`, name: `人${i}`, key: `key${i}` });
  let room = changeRoom(s, 0, { action: 'select-players', players: [5, 8] });
  room = changeRoom(room, 0, { action: 'start' });
  a.equal(room.members.length, 10);
  room = changeRoom(room, 5, { action: 'move', to: 0 });
  a.equal(room.game.board[0], 1);
  a.throws(() => changeRoom(room, 9, { action: 'move', to: 3 }));
});
