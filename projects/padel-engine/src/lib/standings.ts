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
 *   - **Points per match played, not total points** (decision #4). A player who sat out a round
 *     scored nothing that round, and ranking on totals would charge them for it. Rate is what
 *     makes the bench free to rotate, which is what makes it possible to seat any roster at all.
 *   - **Ties are resolved on evidence and then stop** (decision #8). Total points, then
 *     head-to-head, and if two players are still level the standings say they are joint rather
 *     than inventing a separator. Roster order is not evidence.
 *
 * Both live in `ranking.ts`, because Team Americano ranks teams by exactly the same ladder. What
 * this file owns is the other half: who is being ranked, and what a result of theirs is. Here a
 * result belongs to the two players on a side — which is true in every mode, Team Americano
 * included, where a player's line is their team's evening read off their own name.
 */
import { deepFreeze } from './freeze';
import type { PlayerId, Session } from './model';
import { playedMatches } from './played-matches';
import type { PlayedMatch } from './played-matches';
import { placings } from './ranking';
import { assertSessionShape } from './session-shape';

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
  /** Points scored across those matches. */
  readonly points: number;
  /** `points / matchesPlayed`, or 0 for a player who has not been on court yet. */
  readonly pointsPerMatch: number;
}

/** The standings, ranked, one line per roster entry. Frozen, like every other engine result. */
export function computeStandings(session: Session): readonly Standing[] {
  assertSessionShape(session);

  const entrants = session.roster.map((entry) => ({ id: entry.id, name: entry.name }));
  const results = playedMatches(session).flatMap((match) =>
    sidesOf(match).map(([players, points, opponents]) => ({
      ids: players,
      points,
      against: opponents,
    })),
  );

  return deepFreeze(
    placings(entrants, results).map((placing) => ({
      playerId: placing.id,
      name: placing.name,
      position: placing.position,
      joint: placing.joint,
      matchesPlayed: placing.matchesPlayed,
      points: placing.points,
      pointsPerMatch: placing.pointsPerMatch,
    })),
  );
}

/** Both sides of a played match: who was on it, what it scored, and who it was against. */
function sidesOf(
  match: PlayedMatch,
): readonly (readonly [readonly PlayerId[], number, readonly PlayerId[]])[] {
  return [
    [match.sideA, match.score.sideA, match.sideB],
    [match.sideB, match.score.sideB, match.sideA],
  ];
}
