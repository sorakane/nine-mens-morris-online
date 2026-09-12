import { newGame, type Room } from './game.ts';
import { changeRoom, type SavedRoom } from './room.ts';
import { recordConfirmedEvent } from './confirmed-events.ts';
export type CpuMatch = { id: string; revision: number; state: SavedRoom };
export function createCpuMatch(id: string): CpuMatch {
  let state: SavedRoom = {
    members: [
      { id: 'human', name: 'あなた', key: 'local-human' },
      { id: 'cpu', name: 'CPU', key: 'local-cpu' },
    ],
    round: 1,
    game: newGame(),
    spectatorsAllowed: false,
  };
  state = changeRoom(state, 0, { action: 'select-players', players: [0, 1] });
  state = changeRoom(state, 0, { action: 'start' });
  return { id, revision: 0, state };
}
export function cpuAction(
  match: CpuMatch,
  actor: number,
  action: string,
  extra: Record<string, unknown> = {},
): CpuMatch {
  let state = match.state;
  if (action === 'undo-request') {
    if (actor !== 0) throw Error('あなたの操作で戻してください');
    do {
      state = changeRoom(state, 0, { action: 'undo-request' });
      state = changeRoom(state, 1, { action: 'undo-approve' });
    } while (state.game.turn === 2 && state.history?.length);
    action = 'undo-approve';
  } else state = changeRoom(state, actor, { action, ...extra });
  const revision = match.revision + 1;
  recordConfirmedEvent(
    match.state.game,
    state,
    match.id,
    revision,
    action,
    actor,
  );
  return { ...match, state, revision };
}
export function cpuView(match: CpuMatch): Room {
  const s = match.state;
  return {
    id: match.id,
    revision: match.revision,
    game: s.game,
    round: s.round,
    members: s.members.map(({ id, name }) => ({ id, name })),
    you: 'human',
    players: s.players!,
    nextPlayers: s.nextPlayers!,
    spectatorsAllowed: false,
    undo: null,
    canUndo: !!s.history?.length,
    activity: s.activity ?? null,
    eventCursor: s.eventCursor ?? 0,
    events: s.events ?? [],
    serverTime: Date.now(),
  };
}
