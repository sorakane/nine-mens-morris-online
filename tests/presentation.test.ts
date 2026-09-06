import { test } from 'node:test';
import { strict as a } from 'node:assert';
import {
  EventGate,
  PresentationDirector,
  recipes,
  type EffectClock,
} from '../lib/presentation/director.ts';
import type {
  ConfirmedEvent,
  EventSnapshot,
} from '../lib/presentation/events.ts';

const event = (
  sequence: number,
  kind: ConfirmedEvent['kind'] = 'mill',
  extra: Partial<ConfirmedEvent> = {},
): ConfirmedEvent => ({
  id: `room:${sequence}`,
  sequence,
  revision: sequence,
  round: 1,
  occurredAt: 10000,
  kind,
  actorId: 'p1',
  actorName: '白の人',
  player: 1,
  mills: kind === 'mill' ? [[0, 1, 2]] : [],
  target: kind === 'capture' ? 3 : 2,
  capturedStone: kind === 'capture' ? 2 : 0,
  winner: 0,
  ...extra,
});
const snapshot = (
  cursor: number,
  events: ConfirmedEvent[] = [],
  extra: Partial<EventSnapshot> = {},
): EventSnapshot => ({
  id: 'room',
  revision: cursor,
  eventCursor: cursor,
  events,
  serverTime: 10000,
  ...extra,
});
function setup() {
  let time = 0;
  let sequence = 0;
  const jobs = new Map<number, { at: number; fn: () => void }>();
  const clock: EffectClock = {
    now: () => time,
    later: (fn, ms) => {
      const id = ++sequence;
      jobs.set(id, { at: time + ms, fn });
      return id;
    },
    cancel: (id) => {
      jobs.delete(id as number);
    },
  };
  const director = new PresentationDirector(clock);
  director.setMode('full');
  director.receive(snapshot(0));
  const advance = (ms: number) => {
    const end = time + ms;
    for (;;) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at;
      jobs.delete(next[0]);
      next[1].fn();
    }
    time = end;
  };
  return { director, advance, jobs };
}
test('initial snapshots are silent; duplicate, reordered and old deliveries never replay', () => {
  const gate = new EventGate();
  a.deepEqual(gate.receive(snapshot(1, [event(1)]), 0), {
    reset: true,
    events: [],
  });
  const received = gate.receive(
    snapshot(3, [event(3, 'capture'), event(2), event(2)]),
    100,
  );
  a.deepEqual(
    received.events.map((e) => e.id),
    ['room:2', 'room:3'],
  );
  a.equal(
    gate.receive(snapshot(3, [event(2), event(3)]), 200).events.length,
    0,
  );
  a.equal(gate.receive(snapshot(2, [event(2)]), 300).events.length, 0);
});
test('reconnect, room switch, long absence and missing feed history establish a silent baseline', () => {
  const gate = new EventGate();
  gate.receive(snapshot(0), 0);
  gate.disconnect();
  a.equal(gate.receive(snapshot(1, [event(1)]), 10).events.length, 0);
  a.equal(gate.receive(snapshot(2, [event(2)]), 20).events.length, 1);
  a.equal(gate.receive(snapshot(3, [event(3)]), 6021).events.length, 0);
  a.equal(gate.receive(snapshot(40, [event(9), event(40)]), 6030).reset, true);
  a.equal(
    gate.receive(snapshot(1, [event(1)], { id: 'another' }), 6040).reset,
    true,
  );
});
test('stale, future, wrong ID and uncommitted events are consumed without playing', () => {
  const gate = new EventGate();
  gate.receive(snapshot(0), 0);
  const events = [
    event(1, 'mill', { occurredAt: 4999 }),
    event(2, 'mill', { occurredAt: 10001 }),
    event(3, 'mill', { id: 'another:3' }),
    event(4, 'mill', { revision: 5 }),
  ];
  a.equal(gate.receive(snapshot(4, events), 1).events.length, 0);
  a.equal(
    gate.receive(snapshot(4, [event(1), event(2), event(3), event(4)]), 2)
      .events.length,
    0,
  );
});
test('a mill and immediate capture play once in order with bounded local timers', () => {
  const { director, advance, jobs } = setup();
  const source = snapshot(2, [event(1), event(2, 'capture')]);
  const unchanged = structuredClone(source);
  director.receive(source);
  a.equal(director.getSnapshot()?.kind, 'mill');
  a.equal(jobs.size, 1);
  director.receive(source);
  advance(719);
  a.equal(director.getSnapshot()?.kind, 'mill');
  advance(1);
  a.equal(director.getSnapshot()?.kind, 'capture');
  advance(460);
  a.equal(director.getSnapshot(), null);
  a.equal(jobs.size, 0);
  a.deepEqual(source, unchanged);
  director.receive(source);
  a.equal(director.getSnapshot(), null);
});
test('new gameplay or an undo/reset cancels an obsolete effect and its queued capture', () => {
  for (const kind of ['move', 'reset'] as const) {
    const { director, advance, jobs } = setup();
    director.receive(snapshot(2, [event(1), event(2, 'capture')]));
    const oldCallback = [...jobs.values()][0].fn;
    director.receive(
      snapshot(3, [event(1), event(2, 'capture'), event(3, kind)]),
    );
    a.equal(director.getSnapshot(), null);
    a.equal(jobs.size, 0);
    director.receive(snapshot(4, [event(4)]));
    oldCallback();
    a.equal(director.getSnapshot()?.event.sequence, 4);
    advance(720);
    a.equal(director.getSnapshot(), null);
  }
});
test('disconnect clears immediately and rejoin does not replay the gap', () => {
  const { director, jobs } = setup();
  director.receive(snapshot(1, [event(1)]));
  director.disconnect();
  a.equal(director.getSnapshot(), null);
  a.equal(jobs.size, 0);
  director.receive(snapshot(2, [event(1), event(2, 'capture')]));
  a.equal(director.getSnapshot(), null);
  director.receive(snapshot(3, [event(3)]));
  a.equal(director.getSnapshot()?.event.sequence, 3);
});
test('hidden tabs and slow responses baseline even fresh server timestamps', () => {
  for (const options of [{ hidden: true }, { latency: 5001 }]) {
    const { director } = setup();
    director.receive(snapshot(1, [event(1)]), options);
    a.equal(director.getSnapshot(), null);
    director.receive(snapshot(1, [event(1)]));
    a.equal(director.getSnapshot(), null);
    director.receive(snapshot(2, [event(2)]));
    a.equal(director.getSnapshot()?.event.sequence, 2);
  }
});
test('off consumes events; changing settings cancels effects without resetting deduplication', () => {
  const { director, advance } = setup();
  director.setMode('off');
  director.receive(snapshot(1, [event(1)]));
  a.equal(director.getSnapshot(), null);
  director.setMode('full');
  director.receive(snapshot(1, [event(1)]));
  a.equal(director.getSnapshot(), null);
  director.receive(snapshot(2, [event(2)]));
  director.setMode('reduced');
  a.equal(director.getSnapshot(), null);
  director.receive(snapshot(3, [event(3)]));
  a.equal(director.getSnapshot()?.mode, 'reduced');
  advance(720);
  a.equal(director.getSnapshot(), null);
});
test('no unbounded backlog and tab-suspended queues expire', () => {
  const { director, advance } = setup();
  director.receive(
    snapshot(4, [event(1), event(2, 'capture'), event(3), event(4, 'capture')]),
  );
  a.equal(director.getSnapshot()?.event.sequence, 3);
  advance(720 + 460);
  a.equal(director.getSnapshot(), null);
  let now = 0;
  let callback = () => {};
  const paused = new PresentationDirector({
    now: () => now,
    later: (fn) => {
      callback = fn;
      return 1;
    },
    cancel: () => {},
  });
  paused.receive(snapshot(0));
  paused.receive(snapshot(2, [event(1), event(2, 'capture')]));
  now = 6000;
  callback();
  a.equal(paused.getSnapshot(), null);
});
test('intensity recipes do not modify game facts', () => {
  a.equal(recipes.mill!(event(1)).intensity, 'strong');
  a.equal(
    recipes.mill!(
      event(1, 'mill', {
        mills: [
          [0, 1, 2],
          [0, 9, 21],
        ],
      }),
    ).intensity,
    'finisher',
  );
  a.equal(recipes.capture!(event(1, 'capture')).intensity, 'normal');
  a.equal(
    recipes.capture!(event(1, 'capture', { winner: 1 })).intensity,
    'finisher',
  );
});
