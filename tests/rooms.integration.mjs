import assert from 'node:assert/strict';
const base = process.env.MORRIS_TEST_URL || 'http://localhost:3000';
const cookies = ['', '', '', ''];
async function post(client, body) {
  const r = await fetch(base + '/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies[client] },
    body: JSON.stringify(body),
  });
  const cookie = r.headers.getSetCookie().find((value) => value.startsWith('morris_device='));
  if (cookie) cookies[client] = cookie.split(';')[0];
  const data = await r.json();
  return { status: r.status, ...data };
}
async function read(client, id) {
  const r = await fetch(base + '/api/rooms?id=' + id, {
    headers: { Cookie: cookies[client] },
  });
  return r.json();
}
let room = await post(0, { action: 'create', name: '検証A' });
assert.equal(room.status, 200, JSON.stringify(room));
const id = room.id;
room = await post(1, { action: 'join', id, name: '検証B' });
assert.equal(room.status, 200);
room = await post(2, { action: 'join', id, name: '検証C' });
assert.equal(room.members.length, 3);
assert.equal(
  (await post(3, { action: 'join', id, name: '満席確認' })).status,
  409,
);
assert.equal(
  (await post(2, { action: 'start', id, revision: room.revision })).status,
  400,
);
room = await post(0, { action: 'start', id, revision: room.revision });
assert.equal(room.game.status, 'playing');
assert.equal(
  (await post(2, { action: 'move', id, revision: room.revision, to: 0 }))
    .status,
  403,
);
const race = await Promise.all([
  post(0, { action: 'move', id, revision: room.revision, to: 0 }),
  post(0, { action: 'move', id, revision: room.revision, to: 1 }),
]);
assert.equal(race.filter((r) => r.status === 200).length, 1);
assert.equal(race.filter((r) => r.status === 409).length, 1);
room = race.find((r) => r.status === 200);
const views = await Promise.all([0, 1, 2].map((c) => read(c, id)));
assert.deepEqual(views[0].game, views[1].game);
assert.deepEqual(views[1].game, views[2].game);
assert.ok(views.every((v) => v.you));
assert.ok(views.every((v) => !JSON.stringify(v).includes('"key"')));
assert.equal(
  (await post(1, { action: 'move', id, revision: room.revision - 1, to: 3 }))
    .status,
  409,
);
room = await post(1, { action: 'resign', id, revision: room.revision });
assert.equal(room.game.winner, 1);
room = await post(0, { action: 'start', id, revision: room.revision });
assert.equal(room.round, 2);
assert.equal(
  (await post(0, { action: 'move', id, revision: room.revision, to: 0 }))
    .status,
  403,
);
room = await post(1, { action: 'move', id, revision: room.revision, to: 0 });
assert.equal(room.game.board[0], 1);
assert.equal((await read(0, id)).you, views[0].you);
console.log(
  'PASS: three clients, private identities, full room, spectator authorization, atomic simultaneous moves, stale revisions, shared board, reconnect identity and round rotation.',
);
