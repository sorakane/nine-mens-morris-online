import assert from 'node:assert/strict';
const base = process.env.MORRIS_TEST_URL || 'http://localhost:3000';
const cookies = ['', '', '', ''];
async function post(client, body) {
  const r = await fetch(base + '/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies[client] },
    body: JSON.stringify(body),
  });
  const cookie = r.headers
    .getSetCookie()
    .find((value) => value.startsWith('morris_device='));
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
let room = await post(0, { action: 'create', name: '検証A' });
assert.equal(room.status, 200, JSON.stringify(room));
const id = room.id;
room = await post(1, { action: 'join', id, name: '検証B' });
room = await post(2, { action: 'join', id, name: '検証C' });
assert.equal(room.members.length, 3);
async function act(client, action, extra = {}) {
  const result = await post(client, {
    action,
    id,
    revision: room.revision,
    ...extra,
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  room = result;
  return result;
}
async function denied(client, action, status, extra = {}) {
  assert.equal(
    (await post(client, { action, id, revision: room.revision, ...extra }))
      .status,
    status,
  );
}
await act(3, 'join', { name: '追加観戦者' });
await denied(1, 'select-players', 403, { players: [0, 1] });
await denied(0, 'start', 400);
await act(0, 'select-players', { players: [2, 1] });
await act(0, 'start');
await denied(0, 'move', 403, { to: 0 });
await denied(0, 'select-players', 400, { players: [0, 1] });
const race = await Promise.all([
  post(2, { action: 'move', id, revision: room.revision, to: 0 }),
  post(2, { action: 'move', id, revision: room.revision, to: 0 }),
]);
assert.equal(race.filter((r) => r.status === 200).length, 1);
assert.equal(race.filter((r) => r.status === 409).length, 1);
room = race.find((r) => r.status === 200);
const views = await Promise.all([0, 1, 2].map((c) => read(c, id)));
assert.deepEqual(views[0].game, views[1].game);
assert.deepEqual(views[1].game, views[2].game);
assert.ok(views.every((v) => v.you));
assert.ok(views.every((v) => !JSON.stringify(v).includes('"key"')));
assert.equal(room.activity.kind, 'place');
assert.equal(room.activity.to, 0);
await denied(0, 'undo-request', 403);
const original = structuredClone(room.game);
await act(2, 'undo-request');
await denied(2, 'undo-approve', 403);
await denied(0, 'undo-approve', 403);
await denied(1, 'move', 400, { to: 3 });
await act(1, 'undo-reject');
assert.deepEqual(room.game, original);
await act(2, 'undo-request');
await act(1, 'undo-approve');
assert.equal(room.game.board[0], 0);
assert.equal(room.game.turn, 1);
assert.equal(room.activity.kind, 'undo');
for (const [client, to] of [
  [2, 0],
  [1, 3],
  [2, 1],
  [1, 4],
])
  await act(client, 'move', { to });
const beforeMill = structuredClone(room.game);
await act(2, 'move', { to: 2 });
assert.equal(room.game.capture, true);
await act(2, 'move', { to: 3 });
assert.equal(room.activity.removed, 3);
await act(1, 'undo-request');
await act(2, 'undo-approve');
assert.deepEqual(room.game, beforeMill);
const afterUndo = await Promise.all([0, 1, 2].map((c) => read(c, id)));
assert.ok(
  afterUndo.every((v) => JSON.stringify(v.game) === JSON.stringify(room.game)),
);
await act(1, 'resign');
await act(0, 'select-players', { players: [0, 2] });
assert.deepEqual(room.players, [2, 1]);
await act(0, 'start');
assert.equal(room.round, 2);
assert.deepEqual(room.players, [0, 2]);
await denied(1, 'move', 403, { to: 0 });
await act(0, 'move', { to: 0 });
assert.equal((await read(0, id)).you, views[0].you);
console.log(
  'PASS: host-selected players, spectator permissions, synchronized activity, atomic moves, mutual undo approval/rejection, frozen pending requests, combined mill/capture undo, shared rollback and next-game selection.',
);
