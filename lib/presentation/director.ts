import type { ConfirmedEvent, EventSnapshot } from './events.ts';
export type EffectsMode = 'full' | 'reduced' | 'off';
export type Intensity = 'normal' | 'strong' | 'finisher';
export type EffectCue = {
  kind: 'mill' | 'capture';
  intensity: Intensity;
  duration: number;
  event: ConfirmedEvent;
};
export type ActiveEffect = EffectCue & { mode: Exclude<EffectsMode, 'off'> };
const MAX_EVENT_AGE = 5000;
const MAX_RECEIPT_GAP = 6000;
/** Pure delivery policy. Cursor survives effect cancellation and mode changes. */
export class EventGate {
  private room = '';
  private cursor = 0;
  private revision = -1;
  private lastReceipt = 0;
  private baseline = true;
  disconnect() {
    this.baseline = true;
  }
  receive(
    snapshot: EventSnapshot,
    now: number,
  ): { reset: boolean; events: ConfirmedEvent[] } {
    if (snapshot.id === this.room && snapshot.revision < this.revision)
      return { reset: false, events: [] };
    const cursor = snapshot.eventCursor ?? 0;
    const seen = new Set<string>();
    const events = [...(snapshot.events ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      });
    const freshSession =
      this.baseline ||
      snapshot.id !== this.room ||
      now - this.lastReceipt > MAX_RECEIPT_GAP;
    const missedRange =
      events.length > 0 && events[0].sequence > this.cursor + 1;
    const oldCursor = this.cursor;
    const reset = freshSession || missedRange || cursor < oldCursor;
    this.room = snapshot.id;
    this.revision = snapshot.revision;
    this.lastReceipt = now;
    this.baseline = false;
    this.cursor = Math.max(reset ? 0 : oldCursor, cursor);
    if (reset) return { reset: true, events: [] };
    return {
      reset: false,
      events: events.filter(
        (e) =>
          e.sequence > oldCursor &&
          e.sequence <= cursor &&
          e.id === `${snapshot.id}:${e.sequence}` &&
          e.revision <= snapshot.revision &&
          typeof snapshot.serverTime === 'number' &&
          snapshot.serverTime - e.occurredAt >= 0 &&
          snapshot.serverTime - e.occurredAt <= MAX_EVENT_AGE,
      ),
    };
  }
}
/** Registry owns only local duration/intensity. Add future recipes here. */
export const recipes: Partial<
  Record<ConfirmedEvent['kind'], (event: ConfirmedEvent) => EffectCue>
> = {
  mill: (event) => ({
    kind: 'mill',
    intensity: event.mills.length > 1 ? 'finisher' : 'strong',
    duration: 720,
    event,
  }),
  capture: (event) => ({
    kind: 'capture',
    intensity: event.winner ? 'finisher' : 'normal',
    duration: event.winner ? 560 : 460,
    event,
  }),
};
export type EffectClock = {
  now: () => number;
  later: (fn: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
};
const clock: EffectClock = {
  now: () => performance.now(),
  later: (fn, ms) => setTimeout(fn, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
/** No references to board setters, requests, permissions, or gameplay timers. */
export class PresentationDirector {
  private gate = new EventGate();
  private mode: EffectsMode = 'reduced';
  private active: ActiveEffect | null = null;
  private pending: { cue: EffectCue; receivedAt: number }[] = [];
  private timer: unknown;
  private generation = 0;
  private listeners = new Set<() => void>();
  constructor(privateClock: EffectClock = clock) {
    this.clock = privateClock;
  }
  private clock: EffectClock;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.active;
  private publish(value: ActiveEffect | null) {
    this.active = value;
    this.listeners.forEach((fn) => fn());
  }
  clear() {
    this.generation++;
    if (this.timer !== undefined) this.clock.cancel(this.timer);
    this.timer = undefined;
    this.pending = [];
    if (this.active) this.publish(null);
  }
  disconnect = () => {
    this.gate.disconnect();
    this.clear();
  };
  setMode(mode: EffectsMode) {
    if (mode !== this.mode) {
      this.mode = mode;
      this.clear();
    }
  }
  receive = (
    snapshot: EventSnapshot,
    options: { hidden?: boolean; latency?: number } = {},
  ) => {
    if (
      options.hidden ||
      (options.latency !== undefined && options.latency > MAX_EVENT_AGE)
    )
      this.disconnect();
    const result = this.gate.receive(snapshot, this.clock.now());
    if (result.reset) this.clear();
    for (const event of result.events) {
      if (event.kind === 'reset' || event.kind === 'move') {
        this.clear();
        continue;
      }
      if (this.mode === 'off' || options.hidden) continue;
      const cue = recipes[event.kind]?.(event);
      if (!cue) continue;
      if (cue.kind === 'mill' && !cue.event.mills.length) continue;
      this.pending.push({ cue, receivedAt: this.clock.now() });
      // Never accumulate a backlog: at most one mill/capture pair.
      if (this.pending.length > 2) {
        this.clear();
        this.pending.push({ cue, receivedAt: this.clock.now() });
      }
    }
    this.playNext();
  };
  private playNext() {
    if (this.active || this.mode === 'off') return;
    const next = this.pending.shift();
    if (!next) return;
    if (this.clock.now() - next.receivedAt > MAX_EVENT_AGE) {
      this.playNext();
      return;
    }
    const generation = this.generation;
    this.publish({ ...next.cue, mode: this.mode });
    this.timer = this.clock.later(() => {
      if (generation !== this.generation) return;
      this.timer = undefined;
      this.publish(null);
      this.playNext();
    }, next.cue.duration);
  }
  dispose() {
    this.disconnect();
    this.listeners.clear();
  }
}
