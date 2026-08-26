/*
 * Fixture builders for Team Americano, so a test can say "five teams on two courts" and be read.
 *
 * Test support only: excluded from the library build, never exported from the public API. They
 * build *inputs* — every assertion still runs against what the engine returns through
 * `public-api.ts`.
 */
import type { PlayerId, RosterEntry, Session, SessionConfig, Team, TeamId } from '../public-api';
import { roster } from './session-fixtures';

/**
 * The roster paired up in the order it was given: `p1` with `p2`, `p3` with `p4`, and so on.
 *
 * This is the organizer's pairing screen (decision #2a) standing in for a test — the pairs are
 * assigned rather than drawn, so a fixture that pairs adjacent entries is as faithful as any
 * other and has the advantage that a reader can see which team a player is in.
 */
export function teamsOf(players: readonly RosterEntry[]): Team[] {
  return Array.from({ length: Math.floor(players.length / 2) }, (_, index) => ({
    id: `t${index + 1}`,
    playerIds: [players[index * 2].id, players[index * 2 + 1].id] as const,
  }));
}

/**
 * A Team Americano session config. Defaults to four teams on two courts over five rounds, which
 * fills every court and benches nobody; passing `teamCount` on its own is how a test asks for a
 * roster that has to bench a whole team.
 */
export function teamAmericanoConfig(
  overrides: Partial<SessionConfig> & { readonly teamCount?: number } = {},
): SessionConfig {
  const courtCount = overrides.courtCount ?? 2;
  const { teamCount = courtCount * 2, ...rest } = overrides;
  const players = overrides.players ?? roster(teamCount * 2);

  return {
    id: 'session-1',
    mode: 'team-americano',
    players,
    teams: teamsOf(players),
    courtCount,
    targetScore: 24,
    roundCount: 5,
    ...rest,
  };
}

/** One court of a hand-built Team Americano round: the two teams, and the score if it was played. */
export interface TeamMatchSpec {
  readonly sideA: TeamId;
  readonly sideB: TeamId;
  readonly score?: readonly [number, number];
}

/**
 * A Team Americano session whose rounds are exactly what the test asked for.
 *
 * The scheduler decides the fixture list for itself, which is what makes a generated session the
 * wrong instrument for testing a tie-break: isolating head-to-head means putting two specific
 * teams across the net and picking the score. So this builds the rounds outright, from team ids —
 * the players follow, because in this format a side *is* a team.
 */
export function scoredTeamSession(
  rounds: readonly (readonly TeamMatchSpec[])[],
  options: { readonly teamCount?: number; readonly targetScore?: number } = {},
): Session {
  const teamCount = options.teamCount ?? highestTeamMentioned(rounds);
  const players = roster(teamCount * 2);
  const teams = teamsOf(players);
  const playersOf = (id: TeamId): readonly [PlayerId, PlayerId] =>
    teams.find((team) => team.id === id)?.playerIds ?? [id, id];

  return {
    id: 'session-1',
    mode: 'team-americano',
    status: 'in-progress',
    roster: players,
    teams,
    courtCount: Math.max(1, ...rounds.map((round) => round.length)),
    targetScore: options.targetScore ?? 24,
    rounds: rounds.map((matches, index) => ({
      id: `r${index + 1}`,
      number: index + 1,
      matches: matches.map((match, court) => ({
        id: `r${index + 1}c${court + 1}`,
        courtNumber: court + 1,
        sideA: playersOf(match.sideA),
        sideB: playersOf(match.sideB),
        teams: { sideA: match.sideA, sideB: match.sideB },
        ...(match.score ? { score: { sideA: match.score[0], sideB: match.score[1] } } : {}),
      })),
    })),
  };
}

/** How many teams the rounds imply: the highest `tN` played, not the count of distinct ids. */
function highestTeamMentioned(rounds: readonly (readonly TeamMatchSpec[])[]): number {
  const played = rounds.flatMap((round) => round.flatMap((match) => [match.sideA, match.sideB]));

  return Math.max(...played.map((id) => Number(id.replace('t', ''))));
}
