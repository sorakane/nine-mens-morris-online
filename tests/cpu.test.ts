import { test } from 'node:test';
import { strict as a } from 'node:assert';
import { newGame, move, type Game } from '../lib/game.ts';
import { chooseCpuMove, legalMoves } from '../lib/cpu.ts';
import { createCpuMatch, cpuAction, cpuView } from '../lib/cpu-match.ts';
function playing(): Game {
  const g = newGame();
  g.status = 'playing';
  return g;
}
test('CPU forms a mill and blocks an immediate opposing mill', () => {
  for (const stone of [1, 2] as const) {
    const g = playing();
    g.turn = 2;
    g.board[0] = stone;
    g.board[1] = stone;
    g.remaining[stone] = 7;
    const before = structuredClone(g);
    a.equal(chooseCpuMove(g)?.to, 2);
    a.deepEqual(g, before);
  }
});
test('CPU respects mill protection and can take a winning capture', () => {
  const g = playing();
  g.turn = 2;
  g.capture = true;
  g.remaining = [0, 0, 0];
  g.board[0] = g.board[1] = g.board[2] = 1;
  g.board[3] = 1;
  g.board[6] = g.board[7] = g.board[8] = 2;
  a.equal(chooseCpuMove(g)?.to, 3);
  g.board[3] = 0;
  const chosen = chooseCpuMove(g)!;
  const result = move(g, 2, chosen.from, chosen.to);
  a.equal(result.winner, 2);
});
test('sliding and flying use the same legal rules', () => {
  for (const pieces of [
    [0, 1, 3, 4],
    [0, 1, 3],
  ]) {
    const g = playing();
    g.remaining = [0, 0, 0];
    for (const i of pieces) g.board[i] = 1;
    g.board[6] = g.board[7] = g.board[8] = 2;
    for (const step of legalMoves(g))
      a.doesNotThrow(() => move(g, 1, step.from, step.to));
    a.ok(chooseCpuMove(g));
  }
  a.equal(chooseCpuMove(newGame()), null);
});
test('local undo restores before the human move and cancels the CPU response state', () => {
  let match = createCpuMatch('cpu-test');
  const initial = structuredClone(match.state.game);
  match = cpuAction(match, 0, 'move', { to: 0 });
  match = cpuAction(match, 1, 'move', { to: 3 });
  match = cpuAction(match, 0, 'undo-request');
  a.deepEqual(match.state.game, initial);
  a.equal(cpuView(match).events?.at(-1)?.kind, 'reset');
  match = cpuAction(match, 0, 'move', { to: 1 });
  match = cpuAction(match, 0, 'undo-request');
  a.deepEqual(match.state.game, initial);
});
test('local mill capture undo and rematch retain event IDs and correct rules', () => {
  let m = createCpuMatch('cpu-test');
  for (const [actor, to] of [
    [0, 0],
    [1, 3],
    [0, 1],
    [1, 4],
  ])
    m = cpuAction(m, actor, 'move', { to });
  const before = structuredClone(m.state.game);
  m = cpuAction(m, 0, 'move', { to: 2 });
  a.equal(m.state.game.capture, true);
  m = cpuAction(m, 0, 'move', { to: 3 });
  m = cpuAction(m, 1, 'move', { to: 5 });
  m = cpuAction(m, 0, 'undo-request');
  a.deepEqual(m.state.game, before);
  const cursor = m.state.eventCursor!;
  m = cpuAction(m, 0, 'resign');
  m = cpuAction(m, 0, 'start');
  a.equal(m.state.round, 2);
  a.equal(m.state.game.status, 'playing');
  a.ok(m.state.eventCursor! > cursor);
});
test('CPU can play complete games without illegal actions or modifying its input', () => {
  for (let opening = 0; opening < 4; opening++) {
    let g = move(playing(), 1, null, opening);
    let steps = 0;
    while (g.status === 'playing' && steps++ < 350) {
      const next = chooseCpuMove(g);
      a.ok(next);
      g = move(g, g.turn, next.from, next.to);
    }
    a.equal(g.status, 'finished');
  }
});
