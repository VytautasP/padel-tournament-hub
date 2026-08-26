/*
 * What a score is allowed to be, in one place.
 *
 * `recordScore` checks the number on the way in; `assertSessionValid` checks the pairs already in
 * a session document. Both ask these functions, so a score the engine refuses to record is
 * described in exactly the same words as one that has drifted into a session loaded from storage.
 */
import type { MatchScore } from './model';

/**
 * One side's points, against the session target: a whole number from 0 to the target inclusive.
 *
 * `subject` names what is being scored — "Side A's score", "Round 2 court 1 side B's score" —
 * so the same rule reads correctly whether it fired on an entry or on a stored pair.
 */
export function assertPointsInRange(points: number, targetScore: number, subject: string): void {
  if (!Number.isInteger(points)) {
    throw new Error(`${subject} is ${points} — a score is a whole number.`);
  }
  if (points < 0 || points > targetScore) {
    throw new Error(`${subject} is ${points} — a score is between 0 and ${targetScore}.`);
  }
}

/**
 * A stored pair, against the session target (decision #3).
 *
 * `recordScore` derives the second number from the first, so a pair it built can only fail this
 * if the session was assembled elsewhere — which is exactly the case the referee exists for.
 *
 * `subject` names the match, the way it does above: "Round 2 court 1".
 */
export function assertScorePairValid(
  score: MatchScore,
  targetScore: number,
  subject: string,
): void {
  assertPointsInRange(score.sideA, targetScore, `${subject} side A's score`);
  assertPointsInRange(score.sideB, targetScore, `${subject} side B's score`);

  if (score.sideA + score.sideB !== targetScore) {
    throw new Error(
      `${subject} is scored ${score.sideA}-${score.sideB}, which does not sum to ${targetScore}.`,
    );
  }
}
