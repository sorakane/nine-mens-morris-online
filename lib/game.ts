export type Stone = 0 | 1 | 2;
export const POINTS = [
  [0, 0],
  [3, 0],
  [6, 0],
  [1, 1],
  [3, 1],
  [5, 1],
  [2, 2],
  [3, 2],
  [4, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [4, 3],
  [5, 3],
  [6, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [1, 5],
  [3, 5],
  [5, 5],
  [0, 6],
  [3, 6],
  [6, 6],
];
export const MILLS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
  [12, 13, 14],
  [15, 16, 17],
  [18, 19, 20],
  [21, 22, 23],
  [0, 9, 21],
  [3, 10, 18],
  [6, 11, 15],
  [1, 4, 7],
  [16, 19, 22],
  [8, 12, 17],
  [5, 13, 20],
  [2, 14, 23],
];
export const EDGES = MILLS.flatMap(([a, b, c]) => [
  [a, b],
  [b, c],
]);
export const adjacent = (a: number, b: number) =>
  EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
export type Game = {
  board: Stone[];
  remaining: number[];
  turn: 1 | 2;
  capture: boolean;
  status: 'waiting' | 'playing' | 'finished';
  winner: 0 | 1 | 2;
  reason: string;
  ply: number;
  last: number | null;
  quiet: number;
  positions: Record<string, number>;
};
export const newGame = (): Game => ({
  board: Array(24).fill(0),
  remaining: [0, 9, 9],
  turn: 1,
  capture: false,
  status: 'waiting',
  winner: 0,
  reason: '',
  ply: 0,
  last: null,
  quiet: 0,
  positions: {},
});
export const count = (g: Game, p: number) =>
  g.board.filter((s) => s === p).length;
export const inMill = (board: Stone[], i: number) =>
  board[i] !== 0 &&
  MILLS.some((m) => m.includes(i) && m.every((k) => board[k] === board[i]));
export const capturable = (g: Game, i: number) =>
  g.board[i] === 3 - g.turn &&
  (!inMill(g.board, i) ||
    g.board.every((s, k) => s !== 3 - g.turn || inMill(g.board, k)));
function finish(g: Game, winner: 0 | 1 | 2, reason: string) {
  g.status = 'finished';
  g.winner = winner;
  g.reason = reason;
  g.capture = false;
}
function endTurn(g: Game) {
  g.capture = false;
  g.ply++;
  g.turn = (3 - g.turn) as 1 | 2;
  const n = count(g, g.turn);
  if (g.remaining[g.turn] === 0) {
    if (n < 3) {
      finish(g, (3 - g.turn) as 1 | 2, '相手の駒が2個以下になりました');
      return;
    }
    if (
      n > 3 &&
      !g.board.some(
        (s, i) => s === g.turn && g.board.some((t, j) => !t && adjacent(i, j)),
      )
    ) {
      finish(g, (3 - g.turn) as 1 | 2, '相手が動かせなくなりました');
      return;
    }
  }
  if (g.remaining[1] + g.remaining[2] === 0) {
    const key = g.board.join('') + g.turn;
    g.positions[key] = (g.positions[key] || 0) + 1;
    if (g.positions[key] >= 3) finish(g, 0, '同じ盤面・手番が3回現れました');
    else if (g.quiet >= 100)
      finish(g, 0, '50往復のあいだ駒の捕獲がありませんでした');
  }
}
export function move(
  source: Game,
  player: 1 | 2,
  from: unknown,
  to: unknown,
): Game {
  const g = structuredClone(source);
  if (g.status !== 'playing' || g.turn !== player)
    throw Error('あなたの手番ではありません');
  if (!Number.isInteger(to) || (to as number) < 0 || (to as number) > 23)
    throw Error('交点を選んでください');
  const t = to as number;
  if (g.capture) {
    if (!capturable(g, t))
      throw Error('ミルの外にある相手の駒を選んでください');
    g.board[t] = 0;
    g.last = t;
    g.quiet = 0;
    endTurn(g);
    return g;
  }
  if (g.board[t]) throw Error('空いている交点を選んでください');
  if (g.remaining[1] + g.remaining[2] > 0) {
    if (g.remaining[player] === 0) throw Error('配置が完了していません');
    g.board[t] = player;
    g.remaining[player]--;
    g.quiet = 0;
  } else {
    if (
      !Number.isInteger(from) ||
      (from as number) < 0 ||
      (from as number) > 23 ||
      g.board[from as number] !== player
    )
      throw Error('自分の駒を選んでください');
    if (count(g, player) !== 3 && !adjacent(from as number, t))
      throw Error('線でつながった隣の交点へ動かしてください');
    g.board[from as number] = 0;
    g.board[t] = player;
    g.quiet++;
  }
  g.last = t;
  if (inMill(g.board, t) && count(g, 3 - player) > 0) g.capture = true;
  else endTurn(g);
  return g;
}
export function resign(source: Game, player: 1 | 2): Game {
  if (source.status !== 'playing') throw Error('対局中のみ投了できます');
  const g = structuredClone(source);
  finish(g, (3 - player) as 1 | 2, '投了により対局が終了しました');
  return g;
}
export type Member = { id: string; name: string };
export type Activity = {
  kind: 'place' | 'move' | 'capture' | 'undo' | 'start' | 'resign';
  actor: string;
  from: number | null;
  to: number | null;
  removed?: number;
  mill?: boolean;
};
export const pointName = (i: number) =>
  String.fromCharCode(65 + POINTS[i][0]) + (7 - POINTS[i][1]);
export type Room = {
  spectatorsAllowed: boolean;
  players: number[];
  nextPlayers: number[];
  undo: { requester: string } | null;
  canUndo: boolean;
  activity: Activity | null;
  id: string;
  members: Member[];
  round: number;
  game: Game;
  revision: number;
  you: string | null;
};
export const seats = (round: number) =>
  [
    [0, 1],
    [1, 2],
    [2, 0],
  ][(round - 1) % 3];
