/** Semantic facts committed with the room, never an animation timeline. */
export type ConfirmedEvent = {
  id: string;
  sequence: number;
  revision: number;
  round: number;
  occurredAt: number;
  kind: 'move' | 'mill' | 'capture' | 'reset';
  actorId: string;
  actorName: string;
  player: 0 | 1 | 2;
  mills: number[][];
  target: number | null;
  capturedStone: 0 | 1 | 2;
  winner: 0 | 1 | 2;
};
export type EventFeed = { eventCursor: number; events: ConfirmedEvent[] };
export type EventSnapshot = Partial<EventFeed> & {
  id: string;
  revision: number;
  serverTime?: number;
};
