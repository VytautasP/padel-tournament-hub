/*
 * The leaderboard of Team Americano, where the competitor is a pair rather than a person.
 *
 * Everything decisions #4 and #8 say about ranking players is said here about teams and means the
 * same thing — points per match played, then total points, then head-to-head, then a declared
 * joint position — because it is literally the same ladder: `ranking.ts` is handed teams instead
 * of players and never notices the difference. Decision #2c is that shift stated once; this file
 * is one of the places it lands.
 *
 * What is genuinely different is where a result comes from. A team's points are read off
 * `match.teams` rather than off the players on court, and that is the whole reason the field is
 * stored (ADR-0011): a team repaired after losing half its pair keeps every point it has already
 * won, because the matches still name the team that won them. Deriving the team from the players
 * would hand those points to nobody.
 */
import { deepFreeze } from './freeze';
import type { Session, TeamId } from './model';
import { playedMatches } from './played-matches';
import { placings } from './ranking';
import { assertSessionShape } from './session-shape';
import { teamPlayIn } from './teams';

/** One team's line in the table — a player's `Standing`, one level up. */
export interface TeamStanding {
  readonly teamId: TeamId;
  /** The pair, as a reader knows them: `Ana & Ben`. */
  readonly name: string;
  /** 1-based place, shared by every team in a joint position. */
  readonly position: number;
  /** Whether this place is shared with another team. */
  readonly joint: boolean;
  /** Matches with a recorded score. A court still playing counts for nothing. */
  readonly matchesPlayed: number;
  /** Points scored across those matches. */
  readonly points: number;
  /** `points / matchesPlayed`, or 0 for a team that has not been on court yet. */
  readonly pointsPerMatch: number;
}

/** The team standings, ranked, one line per team. Frozen, like every other engine result. */
export function computeTeamStandings(session: Session): readonly TeamStanding[] {
  assertSessionShape(session);

  const play = teamPlayIn(session);
  if (!play.plays) {
    throw new Error(`Only Team Americano ranks teams — this session is ${session.mode}.`);
  }

  const entrants = play.teams.map((team) => ({ id: team.id, name: play.nameOf(team.id) }));
  const results = playedMatches(session).flatMap((match) =>
    match.teams
      ? [
          { ids: [match.teams.sideA], points: match.score.sideA, against: [match.teams.sideB] },
          { ids: [match.teams.sideB], points: match.score.sideB, against: [match.teams.sideA] },
        ]
      : [],
  );

  return deepFreeze(
    placings(entrants, results).map((placing) => ({
      teamId: placing.id,
      name: placing.name,
      position: placing.position,
      joint: placing.joint,
      matchesPlayed: placing.matchesPlayed,
      points: placing.points,
      pointsPerMatch: placing.pointsPerMatch,
    })),
  );
}
