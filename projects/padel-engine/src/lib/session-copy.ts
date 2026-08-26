/*
 * Structural copies of a session and its parts.
 *
 * Every engine operation returns a deep-frozen session, and freezing is not something you can do
 * by halves: freeze a session that still shares an array with its input and the caller's own
 * object becomes immutable as a side effect of an operation that promised to leave it alone.
 *
 * So operations copy all the way down before they freeze. Knowing how deep "all the way" goes
 * lives here and nowhere else, so `generateRemaining` and `recordScore` cannot disagree about it —
 * a match's score is a nested object too, and it is the easiest one to forget.
 */
import { teamEntry } from './create-session';
import type { Match, Round, Session } from './model';

export function copyMatch(match: Match): Match {
  // Spread first, so a field added to `Match` later is carried rather than silently dropped by
  // the one function written to stop things being forgotten. Only the nested parts are listed.
  const copy: Match = {
    ...match,
    sideA: [match.sideA[0], match.sideA[1]],
    sideB: [match.sideB[0], match.sideB[1]],
    ...(match.teams ? { teams: { ...match.teams } } : {}),
  };

  // Re-added rather than spread in, so an unscored match keeps having no `score` key at all
  // rather than one holding `undefined`.
  return match.score ? { ...copy, score: { ...match.score } } : copy;
}

/**
 * A round, copied.
 *
 * `amend` gets each copied match and returns what the round should hold in its place, which is how
 * `recordScore` swaps one match's score without owning a second copy of the copying.
 */
export function copyRound(round: Round, amend: (match: Match) => Match = identity): Round {
  return { ...round, matches: round.matches.map((match) => amend(copyMatch(match))) };
}

/** The session with its own roster and the rounds given, sharing nothing with the original. */
export function copySession(session: Session, rounds: readonly Round[]): Session {
  return {
    ...session,
    roster: session.roster.map((entry) => ({ ...entry })),
    ...(session.teams ? { teams: session.teams.map((team) => teamEntry(team)) } : {}),
    rounds,
  };
}

function identity(match: Match): Match {
  return match;
}
