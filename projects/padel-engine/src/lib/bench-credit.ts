/*
 * What a round pays the people who did not play it (ADR-0023 §2).
 *
 * The standings rank on total points, so the bench cannot be free by arithmetic any more — it has
 * to be free by payment. A benched competitor is credited half the target score for the round they
 * sat out, which is exactly a drawn match: a match's two scores always sum to the target
 * (decision #3), so half of it is the one result that neither rewards nor penalises.
 *
 * Both leaderboards ask this the same way and differ only in who "sat out" means, so the two
 * conditions that are *not* about the competitor live here, once:
 *
 *   - **The round has to be complete.** Rounds are generated ahead of play (decision #6), so a
 *     round slot exists long before anybody stands on a court. A credit paid on generation would
 *     put a benched player top of the table for an evening nobody has started, and a round with no
 *     matches at all — ungenerated — would pay everybody.
 *   - **A credit is one round, not one sum.** How many were earned is a figure the table shows: it
 *     is the term that explains why a record of matches does not add up to a total of points.
 *
 * Who was benched is the caller's half, because that is where the levels genuinely differ: a
 * player is benched by the rotation, a team is on a bye (decision #2c), and neither is the same
 * thing as being absent — a late arrival, a player who went home, an orphaned team and the
 * stranded half inside it are all off court for reasons the rotation did not choose, and are paid
 * nothing (ADR-0023 §3).
 */
import type { Credit } from './ranking';
import type { Round, Session } from './model';

/** What one benched round is worth: exactly a drawn match, halves and all. */
export function creditPerRound(session: Session): number {
  return session.targetScore / 2;
}

/**
 * The rounds that owe a credit: generated, and finished.
 *
 * "Every match scored" is asked of a round with matches in it. An ungenerated round satisfies it
 * vacuously — there is nothing unscored in an empty list — which is why the emptiness is checked
 * first rather than left to the reader to notice.
 */
export function paidRounds(session: Session): readonly Round[] {
  return session.rounds.filter(
    (round) =>
      round.matches.length > 0 && round.matches.every((match) => match.score !== undefined),
  );
}

/**
 * One credit per competitor per round they sat out, for whatever `benchedIn` calls sitting out.
 *
 * Handed a round rather than a round number because the caller needs the matches to say who was on
 * court, and reading them off the same round this function decided was complete is what stops the
 * two halves disagreeing about which round is being talked about.
 */
export function creditsFor(
  session: Session,
  benchedIn: (round: Round) => readonly string[],
): readonly Credit[] {
  const points = creditPerRound(session);

  return paidRounds(session).flatMap((round) => benchedIn(round).map((id) => ({ id, points })));
}
