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
 * The same two conditions, read the other way round, say which rounds an evening *abandoned*, so
 * compensation (ADR-0037) lives here too: it is the same arithmetic asked about the rounds the
 * bench credit has nothing to say about. A round is one or the other and never both — paid because
 * every match in it is scored, or abandoned because one is not — which is what keeps a competitor
 * from being paid twice for the same round.
 *
 * Who was benched is the caller's half, because that is where the levels genuinely differ: a
 * player is benched by the rotation, a team is on a bye (decision #2c), and neither is the same
 * thing as being absent — a late arrival, a player who went home, an orphaned team and the
 * stranded half inside it are all off court for reasons the rotation did not choose, and are paid
 * nothing (ADR-0023 §3).
 */
import type { Credit } from './ranking';
import type { Match, Round, Session } from './model';

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

/**
 * The rounds an ending abandoned: generated, and still holding a match nobody scored (ADR-0037 §2).
 *
 * The exact complement of `paidRounds` among the generated rounds, which is the property that
 * matters — a round pays a bench credit or it pays compensation, never both. An ungenerated round
 * is in neither list: a slot is a number in a form field rather than a fixture, and paying for
 * those would let an evening be inflated by asking for thirty rounds.
 */
export function abandonedRounds(session: Session): readonly Round[] {
  return session.rounds.filter(
    (round) => round.matches.length > 0 && round.matches.some((match) => match.score === undefined),
  );
}

/**
 * Whether this evening has anything to compensate: one abandoned round is enough (ADR-0037 §1).
 *
 * Exported because the question is the organizer's and the app has to know whether to ask it. The
 * screen cannot work this out for itself without re-deriving what an abandoned round *is*, and a
 * second definition of that is the drift ADR-0037 §7 has the referee watching for. So there is one
 * definition, here, and both the confirmation and the referee ask it.
 */
export function hasAbandonedRounds(session: Session): boolean {
  return abandonedRounds(session).length > 0;
}

/**
 * One compensation per competitor per abandoned round they were available for — if the organizer
 * said so, and nothing at all if they did not (ADR-0037 §1).
 *
 * `availableIn` is the round's whole field, scheduled and benched alike, because ending early must
 * not become a penalty for wherever the rotation happened to put you (ADR-0037 §3). `scoredIn` is
 * how a half-played round is settled: the courts that finished, finished, so whoever they put on
 * court was paid by the match and is not paid again here. Both are the caller's half for the same
 * reason `creditsFor`'s is — a competitor is a player at one level and a team at the other.
 */
export function compensationsFor(
  session: Session,
  availableIn: (round: Round) => readonly string[],
  scoredIn: (match: Match) => readonly string[],
): readonly Credit[] {
  if (!session.compensatedUnplayed) {
    return [];
  }

  const points = creditPerRound(session);

  return abandonedRounds(session).flatMap((round) => {
    const alreadyPaid = new Set(
      round.matches.filter((match) => match.score !== undefined).flatMap(scoredIn),
    );

    return availableIn(round)
      .filter((id) => !alreadyPaid.has(id))
      .map((id) => ({ id, points }));
  });
}
