/*
 * One line of the table, whoever the competitor is.
 *
 * The engine ranks players and teams on the same ladder and says so twice: `Standing` carries a
 * `playerId`, `TeamStanding` a `teamId`, and every other field on the two is identical, means the
 * same thing and was computed by the same code (`ranking.ts`, ADR-0011). The Standings tab is the
 * same table for both — position, name, total, and the three figures behind a tap — so it renders
 * this rather than one of them, and the mode is read once, in the store, rather than in every
 * template that shows a row.
 *
 * `id` is what a row is addressed by: which row is expanded, which is on the podium. It is a
 * player's id in the rotating modes and a team's in Team Americano, which is exactly the shift
 * decision #2c describes — the competitor changes, and nothing else does.
 */
import {
  computeStandings,
  computeTeamStandings,
  type PlayerId,
  type Session,
  type Standing,
  type TeamId,
  type TeamStanding,
} from 'padel-engine';
import { teamNameOf } from '../session/teams';

export interface StandingRow {
  /** The competitor's id: a player's, or a team's where the team is the unit. */
  readonly id: PlayerId | TeamId;
  /** `Ana`, or `Ana & Ben` where the competitor is a pair. */
  readonly name: string;
  /** 1-based place, shared by everyone in a joint position (decision #8). */
  readonly position: number;
  readonly joint: boolean;
  readonly matchesPlayed: number;
  /** The ranking figure: points scored, plus a bench credit for every round sat out (ADR-0023). */
  readonly points: number;
  readonly won: number;
  readonly tied: number;
  readonly lost: number;
  readonly benched: number;
}

/**
 * The one ladder, asked of whichever competitor this evening ranks (ADR-0011).
 *
 * The mode is read here and nowhere else. Team Americano ranks teams and every other mode ranks
 * players, the engine refuses the wrong question of either, and a screen asking both and picking
 * one would be this check in a second place. Both screens that show a table — the organizer's tab
 * through the store, the spectator's route directly — come through this function, so there is one
 * answer to "who is on the ladder" rather than one each.
 *
 * It is computed on every read and stored nowhere (decision #17): a corrected score changes the
 * session, and the table is whatever the engine says about it now.
 */
export function rowsOf(session: Session): readonly StandingRow[] {
  return session.mode === 'team-americano'
    ? rowsOfTeams(computeTeamStandings(session), (teamId) => teamNameOf(session, teamId))
    : rowsOfPlayers(computeStandings(session));
}

/** The players' table as a row apiece. */
export function rowsOfPlayers(standings: readonly Standing[]): readonly StandingRow[] {
  return standings.map((standing) => row(standing.playerId, standing));
}

/**
 * The teams' table as a row apiece, named by the caller rather than by the engine.
 *
 * The engine names a team too, and it names it identically — but every word the organizer reads
 * comes from the copy dictionary (decision #20), and two independent spellings of `Ana & Ben` are
 * two chances for the bye strip and the table to disagree about what a pair is called.
 */
export function rowsOfTeams(
  standings: readonly TeamStanding[],
  nameOf: (teamId: TeamId) => string,
): readonly StandingRow[] {
  return standings.map((standing) => ({
    ...row(standing.teamId, standing),
    name: nameOf(standing.teamId),
  }));
}

function row(id: PlayerId | TeamId, standing: Omit<Standing, 'playerId'>): StandingRow {
  return {
    id,
    name: standing.name,
    position: standing.position,
    joint: standing.joint,
    matchesPlayed: standing.matchesPlayed,
    points: standing.points,
    won: standing.won,
    tied: standing.tied,
    lost: standing.lost,
    benched: standing.benched,
  };
}
