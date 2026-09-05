import assert from 'node:assert/strict';
const base = process.env.MORRIS_TEST_URL || 'http://localhost:3000';
const cookies = ['', '', ''];
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
assert.equal(
  (await post(0, { action: 'create', name: '定員確認', capacity: 4 })).status,
  400,
);
for (const capacity of [2, 3]) {
  let room = await post(0, { action: 'create', name: '人数確認A', capacity });
  assert.equal(room.status, 200, JSON.stringify(room));
  assert.equal(room.capacity, capacity);
  const id = room.id;
  room = await post(1, { action: 'join', id, name: '人数確認B' });
  assert.equal(room.status, 200);
  room = await post(0, {
    action: 'select-players',
    id,
    revision: room.revision,
    players: [0, 1],
  });
  assert.equal(room.status, 200);
  room = await post(0, { action: 'start', id, revision: room.revision });
  assert.equal(room.game.status, 'playing');
  assert.equal(room.members.length, 2);
  const third = await post(2, { action: 'join', id, name: '人数確認C' });
  if (capacity === 2) {
    assert.equal(third.status, 409);
    assert.ok(third.error.includes('定員2人'));
  } else {
    assert.equal(third.status, 200);
    assert.equal(third.game.status, 'playing');
    assert.deepEqual(third.players, [0, 1]);
    assert.equal(
      (await post(2, { action: 'move', id, revision: third.revision, to: 0 }))
        .status,
      403,
    );
  }
}
console.log(
  'PASS: configurable capacity, two-player start in both modes, two-seat room limit, late spectator joining and spectator permissions.',
);
