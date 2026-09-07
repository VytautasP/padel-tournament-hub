/*
 * The leaderboard, derived from the rounds and stored nowhere (decision #17).
 *
 * `computeStandings` reads the recorded scores every time it is asked. There is no standings
 * field on the session, so there is nothing to invalidate and nothing to drift: a score typed
 * into the wrong column and corrected a minute later recomputes for free, which is the whole
 * reason corrections are the ordinary path in `recordScore` rather than an exceptional one.
 *
 * Two rules decide the order, and both come from the same place — the bench.
 *
 *   - **Total points, with the bench paid a credit** (ADR-0023, superseding the ranking clause of
 *     decision #4). A player who sat out scored nothing that round, and ranking on totals alone
 *     would charge them for a seat the scheduler assigned; so the round is paid for instead of
 *     divided out, and the table shows the number the evening was actually played in.
 *   - **Ties are resolved on evidence and then stop** (decision #8). Head-to-head, and if two
 *     players are still level the standings say they are joint rather than inventing a separator.
 *     Roster order is not evidence.
 *
 * Both live in `ranking.ts`, because Team Americano ranks teams by exactly the same ladder. What
 * this file owns is the other half: who is being ranked, what a result of theirs is, and which
 * rounds they were benched in. Here a result belongs to the two players on a side — which is true
 * in every mode, Team Americano included, where a player's line is their team's evening read off
 * their own name.
 */
import { creditsFor } from './bench-credit';
import { deepFreeze } from './freeze';
import type { PlayerId, Round, Session } from './model';
import { playedMatches } from './played-matches';
import type { PlayedMatch } from './played-matches';
import { placings } from './ranking';
import { availableIn } from './roster-availability';
import { assertSessionShape } from './session-shape';
import { teamLineupIn, teamPlayIn, teamsOnByeIn } from './teams';

/**
 * One player's line in the table.
 *
 * `position` is the place itself, so a joint second is `2` for both players and the next player
 * is `4` — the places a joint position occupies are used up, not reassigned. `joint` says the
 * position is shared, which is what stops a reader treating the order inside it as a result:
 * players level after every tier are listed in roster order, and that order means nothing.
 */
export interface Standing {
  readonly playerId: PlayerId;
  readonly name: string;
  /** 1-based place, shared by everyone in a joint position. */
  readonly position: number;
  /** Whether this place is shared with another player. */
  readonly joint: boolean;
  /** Matches with a recorded score. A court still playing counts for nothing. */
  readonly matchesPlayed: number;
  /** Points scored across those matches, plus a bench credit for every round sat out. */
  readonly points: number;
  /** Matches whose other side scored fewer points. */
  readonly won: number;
  /** Matches that ended level, which an odd target score makes impossible. */
  readonly tied: number;
  /** Matches whose other side scored more points. */
  readonly lost: number;
  /** Rounds sat out and paid for — the term that explains the gap between the record and the points. */
  readonly benched: number;
}

/** The standings, ranked, one line per roster entry. Frozen, like every other engine result. */
export function computeStandings(session: Session): readonly Standing[] {
  assertSessionShape(session);

  const entrants = session.roster.map((entry) => ({ id: entry.id, name: entry.name }));
  const results = playedMatches(session).flatMap((match) =>
    sidesOf(match).map(([players, points, opponents, opponentPoints]) => ({
      ids: players,
      points,
      opponentPoints,
      against: opponents,
    })),
  );
  const credits = creditsFor(session, (round) => benchedIn(session, round));

  return deepFreeze(
    placings(entrants, results, credits).map((placing) => ({
      playerId: placing.id,
      name: placing.name,
      position: placing.position,
      joint: placing.joint,
      matchesPlayed: placing.matchesPlayed,
      points: placing.points,
      won: placing.won,
      tied: placing.tied,
      lost: placing.lost,
      benched: placing.benched,
    })),
  );
}

/**
 * The players this round benched: in the session for it, and left off every court in it.
 *
 * Availability is what separates a bench from an absence (ADR-0023 §3) — a player who had not
 * arrived, or who has gone home, is not on the bench and is owed nothing.
 *
 * Team Americano asks it one level up instead. There, a player is off court because *their team*
 * is, and the only team-shaped way to be off court and unpaid is to be orphaned: reading the bench
 * off the bye keeps the stranded half of a broken pair out of it, which asking about players
 * directly would not (decision #2b).
 */
function benchedIn(session: Session, round: Round): readonly PlayerId[] {
  if (teamPlayIn(session).plays) {
    return teamsOnByeIn(session, round.number).flatMap((team) =>
      teamLineupIn(team, session.roster, round.number),
    );
  }

  const onCourt = new Set(round.matches.flatMap((match) => [...match.sideA, ...match.sideB]));

  return availableIn(session, round.number)
    .map((entry) => entry.id)
    .filter((id) => !onCourt.has(id));
}

/** Both sides of a played match: who was on it, what it scored, and who it was against for how much. */
function sidesOf(
  match: PlayedMatch,
): readonly (readonly [readonly PlayerId[], number, readonly PlayerId[], number])[] {
  return [
    [match.sideA, match.score.sideA, match.sideB, match.score.sideB],
    [match.sideB, match.score.sideB, match.sideA, match.score.sideA],
  ];
}
