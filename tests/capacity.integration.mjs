import assert from 'node:assert/strict';
const base = process.env.MORRIS_TEST_URL || 'http://localhost:3000';
const cookies = Array(10).fill('');
async function post(client, body) {
  const r = await fetch(base + '/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies[client] },
    body: JSON.stringify(body),
  });
  const cookie = r.headers
    .getSetCookie()
    .find((v) => v.startsWith('morris_device='));
  if (cookie) cookies[client] = cookie.split(';')[0];
  return { status: r.status, ...(await r.json()) };
}
async function read(client, id) {
  return (
    await fetch(base + '/api/rooms?id=' + id, {
      headers: { Cookie: cookies[client] },
    })
  ).json();
}
let room = await post(0, {
  action: 'create',
  name: '観戦確認・主催',
  spectatorsAllowed: true,
});
assert.equal(room.status, 200, JSON.stringify(room));
assert.equal(room.spectatorsAllowed, true);
const id = room.id;
async function act(client, action, extra = {}) {
  const r = await post(client, {
    action,
    id,
    revision: room.revision,
    ...extra,
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  room = r;
  return r;
}
await act(1, 'join', { name: '対戦者B' });
await act(0, 'select-players', { players: [0, 1] });
await act(0, 'start');
for (let client = 2; client < 10; client++)
  await act(client, 'join', { name: `観戦者${client - 1}` });
assert.equal(room.members.length, 10);
assert.deepEqual(room.players, [0, 1]);
for (let client = 2; client < 10; client++) {
  assert.equal(
    (await post(client, { action: 'move', id, revision: room.revision, to: 0 }))
      .status,
    403,
  );
  assert.equal(
    (
      await post(client, {
        action: 'undo-request',
        id,
        revision: room.revision,
      })
    ).status,
    403,
  );
}
await act(0, 'move', { to: 0 });
const views = await Promise.all(cookies.map((_, c) => read(c, id)));
assert.ok(views.every((v) => v.you));
assert.ok(
  views.every((v) => JSON.stringify(v.game) === JSON.stringify(room.game)),
);
assert.ok(views.every((v) => v.activity.to === 0));
await act(1, 'resign');
await act(0, 'select-players', { players: [5, 8] });
await act(0, 'start');
await act(5, 'move', { to: 3 });
assert.equal(room.game.board[3], 1);
assert.equal(
  (await post(0, { action: 'move', id, revision: room.revision, to: 4 }))
    .status,
  403,
);
let privateRoom = await post(0, {
  action: 'create',
  name: '2人専用',
  spectatorsAllowed: false,
});
assert.equal(privateRoom.spectatorsAllowed, false);
privateRoom = await post(1, {
  action: 'join',
  id: privateRoom.id,
  name: '対戦者B',
});
assert.equal(
  (await post(2, { action: 'join', id: privateRoom.id, name: '観戦者' }))
    .status,
  409,
);
const legacy = await post(0, {
  action: 'create',
  name: '既存クライアント',
  capacity: 3,
});
assert.equal(legacy.spectatorsAllowed, true);
console.log(
  'PASS: 2 players + 8 spectators, late joins, all 10 synchronized, spectator move/undo forbidden, host can promote any spectators, optional players-only mode and legacy compatibility.',
);
