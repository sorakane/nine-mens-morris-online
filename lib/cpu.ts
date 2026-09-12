import { adjacent, capturable, count, MILLS, move, type Game } from './game.ts';
export type CpuMove = { from: number | null; to: number };
export function legalMoves(g: Game): CpuMove[] {
  if (g.status !== 'playing') return [];
  if (g.capture)
    return g.board.flatMap((_, to) =>
      capturable(g, to) ? [{ from: null, to }] : [],
    );
  const empty = g.board.flatMap((stone, i) => (stone ? [] : [i]));
  if (g.remaining[1] + g.remaining[2] > 0)
    return g.remaining[g.turn] > 0
      ? empty.map((to) => ({ from: null, to }))
      : [];
  return g.board.flatMap((stone, from) =>
    stone === g.turn
      ? empty
          .filter((to) => count(g, g.turn) === 3 || adjacent(from, to))
          .map((to) => ({ from, to }))
      : [],
  );
}
function score(g: Game, player: number) {
  if (g.status === 'finished')
    return g.winner === player ? 100000 : g.winner ? -100000 : 0;
  const other = 3 - player;
  let value =
    200 *
    (count(g, player) +
      g.remaining[player] -
      count(g, other) -
      g.remaining[other]);
  for (const line of MILLS) {
    const mine = line.filter((i) => g.board[i] === player).length;
    const theirs = line.filter((i) => g.board[i] === other).length;
    if (!theirs)
      value += mine === 3 ? 80 : mine === 2 ? 35 : mine === 1 ? 4 : 0;
    if (!mine)
      value -= theirs === 3 ? 80 : theirs === 2 ? 110 : theirs === 1 ? 5 : 0;
  }
  for (let i = 0; i < 24; i++)
    if (g.board[i]) {
      const mobility = g.board.filter(
        (stone, j) => !stone && adjacent(i, j),
      ).length;
      value += (g.board[i] === player ? 1 : -1) * mobility * 3;
    }
  return value;
}
/** Bounded one-turn search; every candidate and capture uses the existing rules. */
export function chooseCpuMove(g: Game): CpuMove | null {
  const player = g.turn;
  let best: CpuMove | null = null;
  let bestScore = -Infinity;
  for (const action of legalMoves(g)) {
    const next = move(g, player, action.from, action.to);
    let value = score(next, player);
    if (next.capture) {
      value = -Infinity;
      for (const capture of legalMoves(next))
        value = Math.max(
          value,
          score(move(next, player, null, capture.to), player),
        );
    }
    if (value > bestScore) {
      bestScore = value;
      best = action;
    }
  }
  return best;
}
