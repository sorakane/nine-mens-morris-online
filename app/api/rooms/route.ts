import { roomDb } from '@/db/rooms';
import { newGame } from '@/lib/game';
import {
  normalizeRoom,
  changeRoom,
  RoomError,
  type SavedRoom as Saved,
} from '@/lib/room';
const reply = (body: unknown, status = 200, cookie?: string) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
const cookieToken = (r: Request) =>
  r.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)morris_device=([a-f0-9-]{36})/)?.[1];
async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
const validId = (id: string) => /^[a-f0-9]{32}$/.test(id);
const view = (id: string, raw: Saved, revision: number, key: string) => {
  const state = normalizeRoom(raw);
  return {
    players: state.players,
    nextPlayers: state.nextPlayers,
    undo: state.undo,
    canUndo: !!state.history?.length,
    activity: state.activity,
    id,
    members: state.members.map(({ id, name }) => ({ id, name })),
    round: state.round,
    game: state.game,
    revision,
    you: state.members.find((m) => m.key === key)?.id || null,
  };
};
export async function GET(r: Request) {
  const id = new URL(r.url).searchParams.get('id') || '';
  if (!validId(id)) return reply({ error: '部屋URLを確認してください' }, 400);
  const row = await roomDb()
    .prepare('SELECT state, revision FROM rooms WHERE id = ?')
    .bind(id)
    .first<{ state: string; revision: number }>();
  if (!row) return reply({ error: '部屋が見つかりません' }, 404);
  return reply(
    view(
      id,
      JSON.parse(row.state),
      row.revision,
      await hash(cookieToken(r) || ''),
    ),
  );
}
export async function POST(r: Request) {
  try {
    const origin = r.headers.get('origin');
    if (origin && origin !== new URL(r.url).origin)
      return reply({ error: 'この操作は許可されていません' }, 403);
    if (Number(r.headers.get('content-length') || 0) > 4096)
      return reply({ error: 'リクエストが大きすぎます' }, 413);
    const raw = await r.text();
    if (raw.length > 4096)
      return reply({ error: 'リクエストが大きすぎます' }, 413);
    const b = JSON.parse(raw);
    const token = cookieToken(r) || crypto.randomUUID();
    const key = await hash(token);
    const cookie = `morris_device=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(r.url).protocol === 'https:' ? '; Secure' : ''}`;
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 20) : '';
    if (b.action === 'create') {
      if (!name) return reply({ error: '名前を入力してください' }, 400);
      const id = crypto.randomUUID().replaceAll('-', '');
      const state: Saved = {
        members: [{ id: crypto.randomUUID(), name, key }],
        round: 1,
        game: newGame(),
      };
      await roomDb()
        .prepare(
          'INSERT INTO rooms (id,state,revision,created_at) VALUES (?,?,0,?)',
        )
        .bind(id, JSON.stringify(state), Date.now())
        .run();
      return reply(view(id, state, 0, key), 200, cookie);
    }
    const id = typeof b.id === 'string' ? b.id : '';
    if (!validId(id)) return reply({ error: '部屋が見つかりません' }, 404);
    const row = await roomDb()
      .prepare('SELECT state,revision FROM rooms WHERE id = ?')
      .bind(id)
      .first<{ state: string; revision: number }>();
    if (!row) return reply({ error: '部屋が見つかりません' }, 404);
    let state: Saved = normalizeRoom(JSON.parse(row.state));
    const index = state.members.findIndex((m) => m.key === key);
    if (b.action === 'join') {
      if (index >= 0)
        return reply(view(id, state, row.revision, key), 200, cookie);
      if (state.members.length >= 3)
        return reply(
          {
            error:
              'この部屋は3人で満席です。参加済みの方は元のブラウザで開いてください。',
          },
          409,
        );
      if (!name) return reply({ error: '名前を入力してください' }, 400);
      state.members.push({ id: crypto.randomUUID(), name, key });
    } else {
      if (index < 0) return reply({ error: '部屋に参加してください' }, 403);
      if (b.revision !== row.revision)
        return reply(
          { error: '盤面が更新されました。もう一度操作してください' },
          409,
        );
      state = changeRoom(state, index, b);
    }
    const result = await roomDb()
      .prepare(
        'UPDATE rooms SET state = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
      )
      .bind(JSON.stringify(state), id, row.revision)
      .run();
    if (!result.meta.changes)
      return reply(
        { error: 'ほかの人の操作が届きました。もう一度お試しください' },
        409,
      );
    return reply(view(id, state, row.revision + 1, key), 200, cookie);
  } catch (e) {
    return reply(
      {
        error:
          e instanceof Error && !e.message.includes('D1')
            ? e.message
            : '通信に失敗しました。もう一度お試しください',
      },
      e instanceof RoomError ? e.status : 400,
    );
  }
}
