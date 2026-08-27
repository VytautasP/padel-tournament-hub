/*
 * Who is sitting out one round — asked once, answered once, read by both screens that ask it.
 *
 * The Round tab names the bench under the courts and the Players tab badges the same people in
 * the roster list, and the two must not be able to disagree: an organizer looking at a strip that
 * says Cara is out and a row that does not is looking at a bug they cannot resolve, standing next
 * to Cara. Two derivations of the same fact drift the first time a roster changes underneath one
 * of them, so there is one.
 *
 * It is derived rather than stored for the reason `round-view.ts` gives: the engine's document
 * says who is *playing*, and the bench is everybody else who is here — which stays true when a
 * roster moves under a round that was generated for a different one.
 */
import type { RosterEntry, Session } from 'padel-engine';

/**
 * The roster entries this round leaves off a court, in roster order.
 *
 * Present-but-unscheduled is the whole of it: somebody who has gone home is not sitting out
 * round 5, they are at home, and somebody who has not arrived yet is not sitting out either.
 */
export function benchedIn(session: Session, roundNumber: number): readonly RosterEntry[] {
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);
  const playing = new Set(
    (round?.matches ?? []).flatMap((match) => [...match.sideA, ...match.sideB]),
  );

  return session.roster.filter(
    (entry) => !playing.has(entry.id) && isHereForRound(entry, roundNumber),
  );
}

/**
 * Whether this round is one the player is present for — as opposed to one before they arrived or
 * after they went home (decision #5).
 *
 * The window is the engine's, read rather than recomputed: absent bounds mean "since the start"
 * and "still here", which is what a session written before roster changes existed carries.
 */
export function isHereForRound(entry: RosterEntry, roundNumber: number): boolean {
  return (
    (entry.joinedAtRound ?? 1) <= roundNumber && roundNumber <= (entry.leftAfterRound ?? Infinity)
  );
}

/** Whether this player has gone home: their played rounds stay, and no later round holds them. */
export function hasGoneHome(entry: RosterEntry): boolean {
  return entry.leftAfterRound !== undefined;
}
