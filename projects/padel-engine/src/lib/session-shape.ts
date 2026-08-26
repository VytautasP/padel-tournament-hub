/*
 * The structural rules a session document must satisfy before anything can be scheduled on it:
 * a mode the engine knows, courts to play on, rounds to fill, and a roster of distinct,
 * identifiable players big enough to fill a court.
 *
 * `createSession` and `assertSessionValid` both run these checks, so a configuration the engine
 * refuses to build is described in exactly the same words as a session that has drifted into
 * the same state.
 */
import type { RosterEntry, Session } from './model';
import { availableIn, joinedAtRound, leftAfterRound } from './roster-availability';

/** Players per match — two per side, four per court. */
export const PLAYERS_PER_COURT = 4;

/**
 * How many courts this session can fill in one particular round.
 *
 * An organizer books courts before they know who turns up, so `courtCount` is an upper bound
 * rather than a promise: six players on two courts play on one court and bench two. Every part
 * of the engine that asks "how many matches does a round have?" asks this, so the scheduler and
 * the referee can never disagree about it.
 *
 * It is asked per round rather than per session because the roster moves underneath the evening
 * (decision #5). Nine players fill two courts; once two of them go home the same session fills
 * one — from the round they left onwards, and not in the rounds they played.
 */
export function courtsInPlay(session: Session, roundNumber: number): number {
  const available = availableIn(session, roundNumber).length;

  return Math.min(session.courtCount, Math.floor(available / PLAYERS_PER_COURT));
}

export function assertSessionShape(session: Session): void {
  if (session.id.trim() === '') {
    throw new Error('A session needs an id.');
  }
  if (session.mode !== 'americano') {
    throw new Error(`Unknown session mode "${String(session.mode)}".`);
  }
  if (session.status !== 'in-progress' && session.status !== 'finished') {
    throw new Error(`Unknown session status "${String(session.status)}".`);
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
    assertWindowSound(entry);
  }

  // Four players fill one court; below that there is no match to schedule. Above it any roster
  // is schedulable — whoever does not fit onto a court is benched, and the bench rotates.
  if (session.roster.length < PLAYERS_PER_COURT) {
    throw new Error(
      `Americano needs at least ${PLAYERS_PER_COURT} players — ` +
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

  assertEveryRoundStaffable(session);
}

/**
 * A player's availability window has to describe a stretch of the evening that could exist.
 *
 * The one window that looks wrong and is not is `leftAfterRound === joinedAtRound - 1`: a player
 * added and then removed before either of them played a round. They were here, briefly, and the
 * document says so.
 */
function assertWindowSound(entry: RosterEntry): void {
  if (entry.joinedAtRound !== undefined && !isPositiveInteger(entry.joinedAtRound)) {
    throw new Error(`Roster entry "${entry.id}" joins at round ${entry.joinedAtRound}.`);
  }
  if (entry.leftAfterRound !== undefined && !isWholeNumber(entry.leftAfterRound)) {
    throw new Error(`Roster entry "${entry.id}" leaves after round ${entry.leftAfterRound}.`);
  }
  if (leftAfterRound(entry) < joinedAtRound(entry) - 1) {
    throw new Error(`Roster entry "${entry.id}" leaves before it joins.`);
  }
}

/**
 * Every round slot has the players to fill a court — including the ones not generated yet.
 *
 * Checking the ungenerated rounds too is what makes a roster change refuse itself: removing the
 * fifth of five players leaves a session whose remaining rounds cannot be scheduled, and the
 * honest moment to say so is when the organizer taps Remove, not when the generator runs.
 */
function assertEveryRoundStaffable(session: Session): void {
  for (const round of session.rounds) {
    const available = availableIn(session, round.number).length;
    if (available < PLAYERS_PER_COURT) {
      throw new Error(
        `Round ${round.number} has ${available} player(s) available — ` +
          `Americano needs at least ${PLAYERS_PER_COURT}.`,
      );
    }
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
