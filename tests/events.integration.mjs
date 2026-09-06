import assert from 'node:assert/strict';
import { PresentationDirector } from '../lib/presentation/director.ts';
const base = process.env.MORRIS_TEST_URL || 'http://localhost:3000';
const cookies = ['', '', ''];
async function post(client, body) {
  const response = await fetch(base + '/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies[client] },
    body: JSON.stringify(body),
  });
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('morris_device='));
  if (cookie) cookies[client] = cookie.split(';')[0];
  return { status: response.status, ...(await response.json()) };
}
async function read(client, id) {
  return (
    await fetch(base + '/api/rooms?id=' + id, {
      headers: { Cookie: cookies[client] },
    })
  ).json();
}
let room = await post(0, { action: 'create', name: '演出検証・白' });
assert.equal(room.status, 200);
const id = room.id;
room = await post(1, { action: 'join', id, name: '演出検証・琥珀' });
room = await post(2, { action: 'join', id, name: '演出検証・観戦' });
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
await act(0, 'select-players', { players: [0, 1] });
await act(0, 'start');
const cursor = room.eventCursor;
const race = await Promise.all([
  post(0, { action: 'move', id, revision: room.revision, to: 0 }),
  post(0, { action: 'move', id, revision: room.revision, to: 0 }),
]);
assert.equal(race.filter((r) => r.status === 200).length, 1);
assert.equal(race.filter((r) => r.status === 409).length, 1);
room = race.find((r) => r.status === 200);
assert.equal(room.eventCursor, cursor + 1);
assert.equal(room.events.at(-1).revision, room.revision);
for (const [client, to] of [
  [1, 3],
  [0, 1],
  [1, 4],
])
  await act(client, 'move', { to });
const beforeMill = structuredClone(room.game);
const baseline = await Promise.all([0, 1, 2].map((c) => read(c, id)));
const directors = baseline.map((view) => {
  const d = new PresentationDirector();
  d.setMode('full');
  d.receive(view);
  assert.equal(d.getSnapshot(), null);
  return d;
});
await act(0, 'move', { to: 2 });
assert.equal(room.game.capture, true);
const mill = room.events.at(-1);
assert.equal(mill.kind, 'mill');
assert.deepEqual(mill.mills, [[0, 1, 2]]);
assert.equal(mill.actorName, '演出検証・白');
await act(0, 'move', { to: 3 });
const capture = room.events.at(-1);
assert.equal(capture.kind, 'capture');
assert.equal(capture.capturedStone, 2);
assert.equal(capture.target, 3);
assert.equal(capture.sequence, mill.sequence + 1);
const views = await Promise.all([0, 1, 2].map((c) => read(c, id)));
for (let i = 0; i < views.length; i++) {
  assert.deepEqual(views[i].game, room.game);
  assert.deepEqual(views[i].events, room.events);
  assert.equal(
    views[i].game.board[3],
    0,
    'authoritative capture is already applied before presentation',
  );
  directors[i].receive(views[i]);
  assert.equal(directors[i].getSnapshot()?.event.id, mill.id);
  directors[i].receive(views[i]);
  assert.equal(directors[i].getSnapshot()?.event.id, mill.id);
}
const stableCursor = room.eventCursor;
const rejected = await post(2, {
  action: 'move',
  id,
  revision: room.revision,
  to: 5,
});
assert.equal(rejected.status, 403);
assert.equal((await read(0, id)).eventCursor, stableCursor);
// A late joining/reconnected client displays the latest board without historical effects.
const reconnected = new PresentationDirector();
reconnected.receive(views[2]);
assert.equal(reconnected.getSnapshot(), null);
reconnected.dispose();
await act(1, 'undo-request');
assert.equal(room.eventCursor, stableCursor);
await act(0, 'undo-approve');
assert.equal(room.events.at(-1).kind, 'reset');
assert.deepEqual(room.game, beforeMill);
for (const director of directors) {
  director.receive(room);
  assert.equal(director.getSnapshot(), null);
  director.dispose();
}
console.log(
  'PASS: atomic state/event commits, race rejection, shared mill/capture feed for both players and spectator, immediate canonical capture, deduplication, reconnect baseline and mutual undo reset.',
);
