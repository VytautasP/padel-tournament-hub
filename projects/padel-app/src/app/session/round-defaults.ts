/*
 * The three numbers the Review step arrives pre-filled with (ADR-0017, decision #2).
 *
 * They are here rather than in the engine because they are a suggestion rather than a rule: the
 * organizer can change all three, and the engine will schedule whatever it is given. Only the
 * round count is worth computing.
 */

/** Every match adds up to this (decision #3). */
export const DEFAULT_TARGET_SCORE = 24;

/** One court, because that is what most evenings book (ADR-0017). */
export const DEFAULT_COURT_COUNT = 1;

/**
 * Where a complete rotation stops being a suggestion and starts being a threat (decision #6).
 * Eleven players on two courts want fourteen rounds; nobody is playing fourteen rounds.
 */
export const MAX_SUGGESTED_ROUND_COUNT = 12;

/**
 * The smallest any of Review's three numbers can be. An evening with no courts, no rounds or a
 * target of nothing is not an evening, and the engine's shape check refuses all three.
 */
export const MINIMUM_SESSION_NUMBER = 1;

/** Four players fill one court, and below that there is nothing to schedule (decision #4). */
export const MINIMUM_PLAYERS = 4;

/**
 * Two players make a team — which is what makes an odd roster unpairable (decision #2a).
 *
 * The engine holds the same number and enforces it (`teams.ts`), but does not export it: what it
 * exports is the rule, in the form of a session it refuses. This is the app asking the question
 * one screen earlier, where the organizer can still do something about the answer.
 */
export const PLAYERS_PER_TEAM = 2;

/** Two teams fill a court — one on each side of the net, which is what makes a team the unit. */
export const TEAMS_PER_COURT = 2;

/**
 * How many rounds it takes for everyone to have partnered everyone — capped.
 *
 * A roster of `n` holds `n(n-1)/2` distinct pairs, and each round consumes two of them per court
 * in play, so a complete rotation is that division rounded up. Courts beyond what the roster can
 * actually staff do not count: six players on three courts still play one court a round, and a
 * round count computed as though they played three would end the evening a third of the way
 * through the rotation.
 *
 * The result is a default, not a limit. `addRound` extends an evening that is still going, which
 * is why decision #6 could afford to cap this at all.
 */
export function completeRotationRoundCount(playerCount: number, courtCount: number): number {
  const courtsInPlay = Math.max(1, Math.min(courtCount, Math.floor(playerCount / MINIMUM_PLAYERS)));
  const pairs = (playerCount * (playerCount - 1)) / 2;

  return capped(pairs / (courtsInPlay * 2));
}

/**
 * The same question asked of the unit Team Americano rotates: how many rounds it takes for every
 * team to have faced every other one (ADR-0011).
 *
 * A different sum rather than the same one with different numbers in it. Americano's rotation is
 * over *partnerships*, two of which are consumed per court; here the partnerships are fixed and
 * what rotates is the fixture list, one of which is consumed per court. Handing the players'
 * formula a team count would suggest an evening several times longer than the one that has any
 * rounds left to be new.
 */
export function completeTeamRotationRoundCount(teamCount: number, courtCount: number): number {
  const courtsInPlay = Math.max(1, Math.min(courtCount, Math.floor(teamCount / TEAMS_PER_COURT)));
  const fixtures = (teamCount * (teamCount - 1)) / 2;

  return capped(fixtures / courtsInPlay);
}

/** At least one round, at most the cap, and always a whole number of them. */
function capped(rounds: number): number {
  return Math.min(Math.max(1, Math.ceil(rounds)), MAX_SUGGESTED_ROUND_COUNT);
}
