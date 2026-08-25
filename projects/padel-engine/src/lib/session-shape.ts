/*
 * The structural rules a session document must satisfy before anything can be scheduled on it:
 * a mode the engine knows, courts to play on, rounds to fill, and a roster of distinct,
 * identifiable players that fills every court exactly.
 *
 * `createSession` and `assertSessionValid` both run these checks, so a configuration the engine
 * refuses to build is described in exactly the same words as a session that has drifted into
 * the same state.
 */
import type { Session } from './model';

/** Players per match — two per side, four per court. */
export const PLAYERS_PER_COURT = 4;

export function assertSessionShape(session: Session): void {
  if (session.id.trim() === '') {
    throw new Error('A session needs an id.');
  }
  if (session.mode !== 'americano') {
    throw new Error(`Unknown session mode "${String(session.mode)}".`);
  }
  if (!isPositiveInteger(session.courtCount)) {
    throw new Error('A session needs at least one court.');
  }
  if (!isPositiveInteger(session.targetScore)) {
    throw new Error('The target score must be a positive whole number.');
  }
  if (session.rounds.length === 0) {
    throw new Error('A session needs at least one round.');
  }

  const seenPlayerIds = new Set<string>();
  for (const entry of session.roster) {
    if (entry.id.trim() === '') {
      throw new Error('Every roster entry needs a stable id.');
    }
    if (entry.name.trim() === '') {
      throw new Error(`Roster entry "${entry.id}" needs a name.`);
    }
    if (seenPlayerIds.has(entry.id)) {
      throw new Error(`Duplicate roster id "${entry.id}" — roster entries need unique ids.`);
    }
    seenPlayerIds.add(entry.id);
  }

  // This ticket schedules exact-fit rosters only: every court is filled and nobody is benched.
  // Bench rotation for rosters that do not divide evenly lands in a later ticket.
  const required = session.courtCount * PLAYERS_PER_COURT;
  if (session.roster.length !== required) {
    throw new Error(
      `Americano on ${session.courtCount} court(s) needs exactly ${required} players — ` +
        `the roster has ${session.roster.length}.`,
    );
  }

  session.rounds.forEach((round, index) => {
    if (round.number !== index + 1) {
      throw new Error(`Round at position ${index + 1} is numbered ${round.number}.`);
    }
  });

  const seenRoundIds = new Set<string>();
  for (const round of session.rounds) {
    if (seenRoundIds.has(round.id)) {
      throw new Error(`Duplicate round id "${round.id}".`);
    }
    seenRoundIds.add(round.id);
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
