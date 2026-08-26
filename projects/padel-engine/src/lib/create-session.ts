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
import type { RosterEntry, Session, SessionConfig, Team } from './model';
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
    // Absent rather than empty for a mode with no teams, so a session the app stores and reads
    // back holds the same document it was given — and so the shape check can tell "this mode has
    // no teams" from "this Team Americano session was never paired".
    ...(config.teams ? { teams: config.teams.map((team) => teamEntry(team)) } : {}),
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

/**
 * A team as the session stores it: its id, the pair it fields, the halves that have left it, and
 * nothing else the caller held.
 *
 * The former members are absent rather than empty on a team that has never been repaired, so a
 * session stored before decision #2b's repairs existed reads back as the document it was saved as.
 */
export function teamEntry(team: Team): Team {
  const stored: Team = { id: team.id, playerIds: [team.playerIds[0], team.playerIds[1]] };

  return team.formerPlayerIds && team.formerPlayerIds.length > 0
    ? { ...stored, formerPlayerIds: [...team.formerPlayerIds] }
    : stored;
}

export function roundId(sessionId: string, roundNumber: number): string {
  return `${sessionId}:r${roundNumber}`;
}

export function matchId(sessionId: string, roundNumber: number, courtNumber: number): string {
  return `${roundId(sessionId, roundNumber)}:c${courtNumber}`;
}
