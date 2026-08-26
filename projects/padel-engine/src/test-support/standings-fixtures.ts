/*
 * Hand-built scored sessions, so a standings test can say exactly who beat whom.
 *
 * The scheduler decides partners and opponents for itself, which is what makes a generated
 * session the wrong instrument for testing a tie-break: a test that isolates head-to-head has to
 * put two specific players on opposite sides of a court and pick the score. So these build the
 * rounds outright.
 *
 * They are test support only — excluded from the library build, never exported from the public
 * API — and they build *inputs*. Every assertion still runs against what the engine returns.
 */
import type { PlayerId, Round, Session } from '../public-api';
import { roster } from './session-fixtures';

/** One court: two sides, and the score if it has been played. `[sideA, sideB]` points. */
export interface MatchSpec {
  readonly sideA: readonly [PlayerId, PlayerId];
  readonly sideB: readonly [PlayerId, PlayerId];
  readonly score?: readonly [number, number];
}

/**
 * A session whose rounds are exactly what the test asked for.
 *
 * Each inner array is one round's courts, numbered from 1 in the order given. The roster is
 * `p1..pN` for the players mentioned, or `playerCount` of them when a test needs someone who
 * never got on court.
 */
export function scoredSession(
  rounds: readonly (readonly MatchSpec[])[],
  options: { readonly playerCount?: number; readonly targetScore?: number } = {},
): Session {
  const playerCount = options.playerCount ?? highestMentioned(rounds);

  return {
    id: 'session-1',
    mode: 'americano',
    roster: roster(playerCount),
    courtCount: Math.max(1, ...rounds.map((round) => round.length)),
    targetScore: options.targetScore ?? 24,
    rounds: rounds.map((matches, index) => buildRound(matches, index + 1)),
  };
}

/**
 * How big a roster the rounds imply: the highest `pN` played, not the count of distinct ids.
 * A test that fields p1 and p8 and nobody in between is asking for a roster of eight.
 */
function highestMentioned(rounds: readonly (readonly MatchSpec[])[]): number {
  const played = rounds.flatMap((round) =>
    round.flatMap((match) => [...match.sideA, ...match.sideB]),
  );

  return Math.max(...played.map((id) => Number(id.replace('p', ''))));
}

function buildRound(matches: readonly MatchSpec[], number: number): Round {
  return {
    id: `r${number}`,
    number,
    matches: matches.map((match, index) => ({
      id: `r${number}c${index + 1}`,
      courtNumber: index + 1,
      sideA: [match.sideA[0], match.sideA[1]] as const,
      sideB: [match.sideB[0], match.sideB[1]] as const,
      ...(match.score ? { score: { sideA: match.score[0], sideB: match.score[1] } } : {}),
    })),
  };
}
