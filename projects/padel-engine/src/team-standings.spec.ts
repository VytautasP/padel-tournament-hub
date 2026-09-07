import {
  assertSessionValid,
  computeStandings,
  computeTeamStandings,
  createSession,
  generateRemaining,
  recordScore,
} from './public-api';
import type { Session, TeamId, TeamStanding } from './public-api';
import { americanoConfig } from './test-support/session-fixtures';
import { scoredTeamSession, teamAmericanoConfig } from './test-support/team-fixtures';

function standingOf(standings: readonly TeamStanding[], teamId: TeamId): TeamStanding {
  const standing = standings.find((candidate) => candidate.teamId === teamId);
  if (!standing) {
    throw new Error(`Standings have no team "${teamId}".`);
  }

  return standing;
}

function orderOf(standings: readonly TeamStanding[]): TeamId[] {
  return standings.map((standing) => standing.teamId);
}

/** Every match of a generated session scored, so the table has a full evening behind it. */
function scoredThrough(session: Session, points: (index: number) => number): Session {
  return session.rounds
    .flatMap((round) => round.matches)
    .reduce(
      (scored, match, index) =>
        recordScore(scored, { matchId: match.id, side: 'A', points: points(index) }),
      session,
    );
}

describe('computeTeamStandings', () => {
  it('ranks the teams on the scores recorded in the rounds', () => {
    const session = scoredTeamSession([
      [{ sideA: 't1', sideB: 't2', score: [16, 8] }],
      [{ sideA: 't1', sideB: 't3', score: [20, 4] }],
      [{ sideA: 't2', sideB: 't3', score: [14, 10] }],
    ]);

    const standings = computeTeamStandings(session);

    expect(orderOf(standings)).toEqual(['t1', 't2', 't3']);
    expect(standingOf(standings, 't1')).toEqual({
      teamId: 't1',
      name: 'Ana & Ben',
      position: 1,
      joint: false,
      matchesPlayed: 2,
      points: 48,
      won: 2,
      tied: 0,
      lost: 0,
      benched: 1,
    });

    assertSessionValid(session);
  });

  it('ranks on total points, so the team that played more is not overtaken on rate', () => {
    // t1 took two byes and won the one match it played; t3 played twice and scored more. The
    // byes are paid for rather than divided out, and the evening is what counts (ADR-0023).
    const standings = computeTeamStandings(
      scoredTeamSession([
        [{ sideA: 't1', sideB: 't2', score: [20, 4] }],
        [{ sideA: 't3', sideB: 't2', score: [18, 6] }],
        [{ sideA: 't3', sideB: 't2', score: [18, 6] }],
      ]),
    );

    expect(orderOf(standings).slice(0, 2)).toEqual(['t3', 't1']);
    expect(standingOf(standings, 't1')).toMatchObject({ points: 44, matchesPlayed: 1, benched: 2 });
    expect(standingOf(standings, 't3')).toMatchObject({ points: 48, matchesPlayed: 2, benched: 1 });
  });

  it('separates teams level on total points by what they did to each other', () => {
    // Two courts, so nobody takes a bye. t1 and t2 both score 24 over two matches; they met
    // once, and t1 won that meeting, so the second place is t1s and the third is t2s.
    const standings = computeTeamStandings(
      scoredTeamSession([
        [
          { sideA: 't1', sideB: 't2', score: [16, 8] },
          { sideA: 't3', sideB: 't4', score: [12, 12] },
        ],
        [
          { sideA: 't1', sideB: 't3', score: [8, 16] },
          { sideA: 't2', sideB: 't4', score: [16, 8] },
        ],
      ]),
    );

    expect(standingOf(standings, 't1').points).toBe(standingOf(standings, 't2').points);
    expect(orderOf(standings)).toEqual(['t3', 't1', 't2', 't4']);
    expect(standingOf(standings, 't1').joint).toBe(false);
  });

  it('declares a joint position where nothing separates two teams', () => {
    // t1 and t2 each beat t3 by the same margin and never met, so no tier can speak.
    const standings = computeTeamStandings(
      scoredTeamSession([
        [{ sideA: 't1', sideB: 't3', score: [16, 8] }],
        [{ sideA: 't2', sideB: 't3', score: [16, 8] }],
      ]),
    );

    expect(standingOf(standings, 't1')).toMatchObject({ position: 1, joint: true });
    expect(standingOf(standings, 't2')).toMatchObject({ position: 1, joint: true });
    expect(standingOf(standings, 't3')).toMatchObject({ position: 3, joint: false });
  });

  it('pays a bye what a bench is paid, because the bye is the bench one level up', () => {
    const standings = computeTeamStandings(
      scoredTeamSession([[{ sideA: 't1', sideB: 't2', score: [16, 8] }]], { teamCount: 3 }),
    );

    expect(standingOf(standings, 't3')).toMatchObject({
      matchesPlayed: 0,
      points: 12,
      benched: 1,
      position: 2,
    });
  });

  it('pays a bye nothing until the round it was taken in is finished', () => {
    const standings = computeTeamStandings(
      scoredTeamSession(
        [[{ sideA: 't1', sideB: 't2', score: [16, 8] }], [{ sideA: 't1', sideB: 't2' }]],
        { teamCount: 3 },
      ),
    );

    expect(standingOf(standings, 't3')).toMatchObject({ points: 12, benched: 1 });
  });

  it('counts a match only once it has been scored', () => {
    const standings = computeTeamStandings(
      scoredTeamSession([
        [{ sideA: 't1', sideB: 't2', score: [16, 8] }],
        [{ sideA: 't1', sideB: 't2' }],
      ]),
    );

    expect(standingOf(standings, 't1').matchesPlayed).toBe(1);
  });

  it('refuses to rank teams in a mode that has none', () => {
    const session = generateRemaining(createSession(americanoConfig()));

    expect(() => computeTeamStandings(session)).toThrow(/Only Team Americano ranks teams/);
  });

  it('ranks a whole generated evening, and agrees with the players in it', () => {
    // The team table and the player table are two readings of the same matches: a player's
    // record is their team's, so both put the same pair at the top.
    const scored = scoredThrough(
      generateRemaining(createSession(teamAmericanoConfig({ teamCount: 5, roundCount: 6 }))),
      (index) => 12 + (index % 5) * 3,
    );

    const teams = computeTeamStandings(scored);
    const players = computeStandings(scored);
    const winners = scored.teams?.find((team) => team.id === teams[0].teamId)?.playerIds ?? [];

    expect(teams).toHaveLength(5);
    expect(teams.map((standing) => standing.position)).toEqual([1, 2, 3, 4, 5]);
    expect(
      players
        .slice(0, 2)
        .map((standing) => standing.playerId)
        .sort(),
    ).toEqual([...winners].sort());

    assertSessionValid(scored);
  });
});
