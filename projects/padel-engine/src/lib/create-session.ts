/*
 * Session creation: turn an organizer's configuration into a schedulable session document.
 *
 * A new session is in progress: the round count here is where the evening starts, not where it
 * has to end — `addRound` extends it and `finishSession` closes it.
 *
 * Creation is pure — the ids come from the caller and the round ids are derived from the
 * session id, so no clock is read and no random source is touched. The rounds start empty;
 * `generateRemaining` fills them.
 */
import { deepFreeze } from './freeze';
import type { RosterEntry, Session, SessionConfig } from './model';
import { assertSessionShape } from './session-shape';

export function createSession(config: SessionConfig): Session {
  // Round count is the one field with no counterpart on the session — `rounds.length` cannot tell
  // a fractional request from the number of slots it rounded down to, so it is checked here.
  if (!Number.isInteger(config.roundCount) || config.roundCount < 1) {
    throw new Error('A session needs at least one round.');
  }

  const session: Session = {
    id: config.id,
    mode: config.mode,
    status: 'in-progress',
    roster: config.players.map((player) => rosterEntry(player)),
    courtCount: config.courtCount,
    targetScore: config.targetScore,
    rounds: Array.from({ length: config.roundCount }, (_, index) => ({
      id: roundId(config.id, index + 1),
      number: index + 1,
      matches: [],
    })),
  };

  assertSessionShape(session);

  return deepFreeze(session);
}

/**
 * A roster entry as the session stores it: the fields the engine schedules from, and nothing a
 * caller happened to hang off the object it passed in.
 *
 * Availability windows are not among them — a session starts with everybody here, and it is
 * `addPlayer` and `removePlayer` that open and close windows (decision #5). `addPlayer` builds on
 * this and adds the one it needs, so the two paths cannot disagree about what an entry holds.
 */
export function rosterEntry(player: RosterEntry): RosterEntry {
  return player.gender === undefined
    ? { id: player.id, name: player.name }
    : { id: player.id, name: player.name, gender: player.gender };
}

export function roundId(sessionId: string, roundNumber: number): string {
  return `${sessionId}:r${roundNumber}`;
}

export function matchId(sessionId: string, roundNumber: number, courtNumber: number): string {
  return `${roundId(sessionId, roundNumber)}:c${courtNumber}`;
}
