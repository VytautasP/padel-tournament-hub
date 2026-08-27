/*
 * One line of the table, whoever the competitor is.
 *
 * The engine ranks players and teams on the same ladder and says so twice: `Standing` carries a
 * `playerId`, `TeamStanding` a `teamId`, and every other field on the two is identical, means the
 * same thing and was computed by the same code (`ranking.ts`, ADR-0011). The Standings tab is the
 * same table for both — position, name, rate, and the two figures behind a tap — so it renders
 * this rather than one of them, and the mode is read once, in the store, rather than in every
 * template that shows a row.
 *
 * `id` is what a row is addressed by: which row is expanded, which is on the podium. It is a
 * player's id in the rotating modes and a team's in Team Americano, which is exactly the shift
 * decision #2c describes — the competitor changes, and nothing else does.
 */
import type { Standing, TeamStanding } from 'padel-engine';

export interface StandingRow {
  /** The competitor's id: a player's, or a team's where the team is the unit. */
  readonly id: string;
  /** `Ana`, or `Ana & Ben` where the competitor is a pair. */
  readonly name: string;
  /** 1-based place, shared by everyone in a joint position (decision #8). */
  readonly position: number;
  readonly joint: boolean;
  readonly matchesPlayed: number;
  readonly points: number;
  readonly pointsPerMatch: number;
}

/** The players' table as a row apiece. */
export function rowsOfPlayers(standings: readonly Standing[]): readonly StandingRow[] {
  return standings.map((standing) => row(standing.playerId, standing));
}

/** The teams' table as a row apiece, named the way a pair is named: `Ana & Ben`. */
export function rowsOfTeams(standings: readonly TeamStanding[]): readonly StandingRow[] {
  return standings.map((standing) => row(standing.teamId, standing));
}

function row(id: string, standing: Omit<Standing, 'playerId'>): StandingRow {
  return {
    id,
    name: standing.name,
    position: standing.position,
    joint: standing.joint,
    matchesPlayed: standing.matchesPlayed,
    points: standing.points,
    pointsPerMatch: standing.pointsPerMatch,
  };
}
