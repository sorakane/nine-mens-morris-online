import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  newGame,
  move,
  capturable,
  resign,
  seats,
  type Game,
} from '../lib/game.ts';
const fresh = (): Game => ({ ...newGame(), status: 'playing' as const });
test('placement, mill, capture and alternating turns', () => {
  let g = fresh();
  for (const [p, t] of [
    [1, 0],
    [2, 3],
    [1, 1],
    [2, 4],
    [1, 2],
  ])
    g = move(g, p as 1 | 2, null, t);
  assert.equal(g.capture, true);
  assert.equal(g.turn, 1);
  g = move(g, 1, null, 3);
  assert.equal(g.board[3], 0);
  assert.equal(g.turn, 2);
  assert.equal(g.remaining[1], 6);
  assert.equal(g.ply, 5);
});
test('reject wrong turn, occupied cells, invalid coordinates, retain original', () => {
  const g = fresh();
  assert.throws(() => move(g, 2, null, 0));
  assert.throws(() => move(g, 1, null, -1));
  assert.throws(() => move(g, 1, null, 1.5));
  const next = move(g, 1, null, 0);
  assert.equal(g.board[0], 0);
  assert.throws(() => move(next, 2, null, 0));
});
test('protected mills may only be captured if no unprotected stones exist', () => {
  const g = fresh();
  g.board[0] = g.board[1] = g.board[2] = 2;
  g.board[9] = 2;
  g.capture = true;
  assert.equal(capturable(g, 0), false);
  assert.equal(capturable(g, 9), true);
  g.board[9] = 0;
  assert.equal(capturable(g, 0), true);
});
test('sliding requires adjacency; three stones allow flying', () => {
  let g = fresh();
  g.remaining = [0, 0, 0];
  [0, 1, 3, 9].forEach((i) => (g.board[i] = 1));
  [2, 5, 8, 14].forEach((i) => (g.board[i] = 2));
  assert.throws(() => move(g, 1, 0, 23));
  g.board[9] = 0;
  g = move(g, 1, 0, 23);
  assert.equal(g.board[23], 1);
  assert.equal(g.board[0], 0);
});
test('capturing down to two ends the game', () => {
  let g = fresh();
  g.remaining = [0, 0, 0];
  [0, 1, 2].forEach((i) => (g.board[i] = 1));
  [3, 4, 5].forEach((i) => (g.board[i] = 2));
  g.capture = true;
  g = move(g, 1, null, 3);
  assert.equal(g.winner, 1);
  assert.equal(g.status, 'finished');
});
test('blocked opponent loses', () => {
  let g = fresh();
  g.remaining = [0, 0, 0];
  [0, 2, 21, 23].forEach((i) => (g.board[i] = 2));
  [1, 9, 14, 22, 6].forEach((i) => (g.board[i] = 1));
  g = move(g, 1, 6, 7);
  assert.equal(g.status, 'finished');
  assert.equal(g.winner, 1);
});
test('resign and round-robin seats', () => {
  assert.equal(resign(fresh(), 1).winner, 2);
  assert.deepEqual([1, 2, 3, 4].map(seats), [
    [0, 1],
    [1, 2],
    [2, 0],
    [0, 1],
  ]);
});
test('fifty moves by each side without capture is a draw', () => {
  let g = fresh();
  g.remaining = [0, 0, 0];
  [0, 1, 3, 9].forEach((i) => (g.board[i] = 1));
  [2, 5, 8, 14].forEach((i) => (g.board[i] = 2));
  g.quiet = 99;
  g = move(g, 1, 9, 21);
  assert.equal(g.status, 'finished');
  assert.equal(g.winner, 0);
});
