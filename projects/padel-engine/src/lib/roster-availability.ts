/*
 * Which rounds a player is in the session for.
 *
 * A roster is not a fixed list for the length of an evening (decision #5): someone arrives twenty
 * minutes late, someone else twists an ankle and goes home. Both stay on the roster — a player who
 * has left still has a name on the matches they played and a line in the standings — so "on the
 * roster" and "in this round" stop being the same question, and this file is where the second one
 * is answered.
 *
 * The window is stored as two optional round numbers, absent meaning "since the start" and "still
 * here", so a session written before roster changes existed reads back with everyone available all
 * evening and nothing to migrate.
 *
 * This is a question about the document, not about fairness: the scheduler and the referee both
 * ask it, in the same way `session-shape.ts` is asked by both. What each of them *does* with the
 * answer — how a late arrival's bench count is seeded, which partnerships count as a repeat — each
 * works out for itself.
 */
import type { PlayerId, RosterEntry, Session } from './model';

/** The first round this player can be scheduled into. */
export function joinedAtRound(entry: RosterEntry): number {
  return entry.joinedAtRound ?? 1;
}

/** The last round this player can be scheduled into; `Infinity` while they are still here. */
export function leftAfterRound(entry: RosterEntry): number {
  return entry.leftAfterRound ?? Number.POSITIVE_INFINITY;
}

/** Has this player left the session? Their played rounds stay; no later round may hold them. */
export function hasLeft(entry: RosterEntry): boolean {
  return entry.leftAfterRound !== undefined;
}

export function isAvailableIn(entry: RosterEntry, roundNumber: number): boolean {
  return joinedAtRound(entry) <= roundNumber && roundNumber <= leftAfterRound(entry);
}

/** The roster entries this round may schedule, in roster order. */
export function availableIn(session: Session, roundNumber: number): RosterEntry[] {
  return session.roster.filter((entry) => isAvailableIn(entry, roundNumber));
}

/** The ids of `order` that this round may schedule, keeping the order they were given in. */
export function availableOf(
  order: readonly PlayerId[],
  roster: readonly RosterEntry[],
  roundNumber: number,
): PlayerId[] {
  const window = new Map(roster.map((entry) => [entry.id, entry]));

  return order.filter((id) => {
    const entry = window.get(id);

    return entry !== undefined && isAvailableIn(entry, roundNumber);
  });
}
