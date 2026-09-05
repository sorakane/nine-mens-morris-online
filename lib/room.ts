import {
  newGame,
  move,
  resign,
  seats,
  type Game,
  type Member,
  type Activity,
} from './game.ts';
export type SavedRoom = {
  members: (Member & { key: string })[];
  round: number;
  game: Game;
  players?: number[];
  nextPlayers?: number[];
  history?: Game[];
  undo?: { requester: string } | null;
  activity?: Activity | null;
};
export class RoomError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function normalizeRoom(s: SavedRoom) {
  s.players ??= s.game.status === 'waiting' ? [] : seats(s.round);
  s.nextPlayers ??= [...s.players];
  s.history ??= [];
  s.undo ??= null;
  s.activity ??= null;
  return s;
}
export function changeRoom(
  original: SavedRoom,
  index: number,
  b: Record<string, unknown>,
): SavedRoom {
  const s = normalizeRoom(structuredClone(original));
  const member = s.members[index];
  if (!member) throw new RoomError('部屋に参加してください', 403);
  const player = (s.players!.indexOf(index) + 1) as 0 | 1 | 2;
  const participant = () => {
    if (!player) throw new RoomError('観戦者はこの操作を行えません', 403);
  };
  const remember = () => {
    s.history!.push(structuredClone(s.game));
    s.history = s.history!.slice(-40);
  };
  const event = (kind: Activity['kind'], extra: Partial<Activity> = {}) => {
    s.activity = { kind, actor: member.id, from: null, to: null, ...extra };
  };
  if (
    s.undo &&
    !['undo-approve', 'undo-reject', 'undo-cancel'].includes(String(b.action))
  )
    throw new RoomError('1手戻す申請への返答を待っています');
  switch (b.action) {
    case 'select-players': {
      if (index !== 0)
        throw new RoomError('対戦者を選べるのは部屋を作った人だけです', 403);
      if (s.game.status === 'playing')
        throw new RoomError('対局中は対戦者を変更できません');
      const p = b.players;
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        p[0] === p[1] ||
        p.some((i) => !Number.isInteger(i) || i < 0 || i >= s.members.length)
      )
        throw new RoomError('別々の参加者を2人選んでください');
      s.nextPlayers = p as number[];
      if (s.game.status === 'waiting') s.players = [...s.nextPlayers];
      break;
    }
    case 'start':
      if (index !== 0) throw new RoomError('部屋を作った人が開始できます', 403);
      if (s.members.length !== 3)
        throw new RoomError('3人が集まるのを待っています');
      if (s.game.status === 'playing') throw new RoomError('すでに対局中です');
      if (s.nextPlayers!.length !== 2)
        throw new RoomError('先に対戦者2人を選んでください');
      if (s.game.status === 'finished') s.round++;
      s.players = [...s.nextPlayers!];
      s.history = [];
      s.game = newGame();
      s.game.status = 'playing';
      event('start');
      break;
    case 'move': {
      participant();
      const before = s.game;
      const after = move(before, player as 1 | 2, b.from, b.to);
      if (!before.capture) remember();
      if (before.capture) {
        event('capture', {
          from: s.activity?.from ?? null,
          to: s.activity?.to ?? null,
          removed: b.to as number,
          mill: true,
        });
      } else
        event(
          before.remaining[1] + before.remaining[2] > 0 ? 'place' : 'move',
          {
            from:
              before.remaining[1] + before.remaining[2] > 0
                ? null
                : (b.from as number),
            to: b.to as number,
            mill: after.capture,
          },
        );
      s.game = after;
      break;
    }
    case 'resign':
      participant();
      {
        const after = resign(s.game, player as 1 | 2);
        remember();
        s.game = after;
        event('resign');
      }
      break;
    case 'undo-request':
      participant();
      if (!s.history!.length) throw new RoomError('戻せる一手がありません');
      s.undo = { requester: member.id };
      break;
    case 'undo-approve':
      participant();
      if (!s.undo || s.undo.requester === member.id)
        throw new RoomError('申請した相手だけが承認できます', 403);
      {
        const previous = s.history!.pop();
        if (!previous) throw new RoomError('戻せる一手がありません');
        s.game = previous;
        s.undo = null;
        event('undo');
      }
      break;
    case 'undo-reject':
      participant();
      if (!s.undo || s.undo.requester === member.id)
        throw new RoomError('申請した相手だけが返答できます', 403);
      s.undo = null;
      break;
    case 'undo-cancel':
      participant();
      if (!s.undo || s.undo.requester !== member.id)
        throw new RoomError('申請した人だけが取り消せます', 403);
      s.undo = null;
      break;
    default:
      throw new RoomError('不明な操作です');
  }
  return s;
}
