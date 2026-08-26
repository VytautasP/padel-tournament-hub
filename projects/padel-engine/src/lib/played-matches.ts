/*
 * The matches a session has actually played.
 *
 * A match without a score is a court that has not finished, which is a normal state for a session
 * to be in all evening. Both leaderboards start by asking this same question — the player table
 * and the team table are two readings of one set of results — so it is asked in one place, and
 * neither of them has to depend on the other to ask it.
 */
import type { Match, MatchScore, Session } from './model';

/** A match that has been played, so its score is there to be read rather than checked for. */
export type PlayedMatch = Match & { readonly score: MatchScore };

export function playedMatches(session: Session): PlayedMatch[] {
  return session.rounds
    .flatMap((round) => round.matches)
    .filter((match): match is PlayedMatch => match.score !== undefined);
}
