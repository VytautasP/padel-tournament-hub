/*
 * Recording a match result.
 *
 * The organizer enters one side's points and the engine derives the other from the session target
 * (decision #3). That is the whole design, and it is a modelling choice rather than a convenience:
 * with one number in, an invalid scoreline is impossible to construct, so there is nothing to
 * validate afterwards and no way for two entered fields to disagree.
 *
 * Two things follow from how it is written, and both are things that happen at the side of a
 * court rather than in a test:
 *
 *   - **Corrections are ordinary.** Re-recording a match replaces its score outright — nothing
 *     accumulates, nothing is added twice, and re-entering against the other side corrects a
 *     result typed into the wrong column. A typo in round two must not poison round nine.
 *   - **Order is free.** A score is addressed by match id, not by position, so the court that
 *     finished five minutes ago is entered while the slow court next to it is still playing, in
 *     any round. Nothing here reads or advances a notion of "the current round", because there
 *     isn't one.
 */
import { deepFreeze } from './freeze';
import type { MatchScore, Round, ScoreEntry, Session } from './model';
import { assertPointsInRange } from './score-rules';
import { copyRound, copySession } from './session-copy';
import { assertSessionShape } from './session-shape';

export function recordScore(session: Session, entry: ScoreEntry): Session {
  assertSessionShape(session);
  assertPointsInRange(entry.points, session.targetScore, `Side ${entry.side}'s score`);

  const score = derivePair(entry, session.targetScore);
  let recorded = 0;

  const rounds: Round[] = session.rounds.map((round) =>
    copyRound(round, (match) => {
      if (match.id !== entry.matchId) {
        return match;
      }

      recorded++;

      // The whole score, replaced. Anything that merged with what was there before would make a
      // correction depend on what it is correcting.
      return { ...match, score };
    }),
  );

  if (recorded === 0) {
    throw new Error(`Session "${session.id}" has no match "${entry.matchId}" to score.`);
  }
  // Ids are unique in any session the engine built, but one loaded from storage might not be, and
  // quietly scoring two courts from one entry is a worse answer than refusing.
  if (recorded > 1) {
    throw new Error(
      `Session "${session.id}" has ${recorded} matches with id "${entry.matchId}" — ` +
        'a score cannot say which is meant.',
    );
  }

  return deepFreeze(copySession(session, rounds));
}

/** One entered number becomes both sides: the target is the whole, and the entry is one part. */
function derivePair(entry: ScoreEntry, targetScore: number): MatchScore {
  const other = targetScore - entry.points;

  return entry.side === 'A'
    ? { sideA: entry.points, sideB: other }
    : { sideA: other, sideB: entry.points };
}
