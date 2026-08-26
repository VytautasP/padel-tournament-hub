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
      points: 36,
      pointsPerMatch: 18,
    });

    assertSessionValid(session);
  });

  it('ranks by points per match, so the team that took a bye is not overtaken on volume', () => {
    // t3 scores more in total, over twice as many matches. Points per match is what decides, so
    // the bye costs t1 nothing — decision #4, one level up.
    const standings = computeTeamStandings(
      scoredTeamSession([
        [{ sideA: 't1', sideB: 't2', score: [20, 4] }],
        [{ sideA: 't3', sideB: 't2', score: [18, 6] }],
        [{ sideA: 't3', sideB: 't2', score: [18, 6] }],
      ]),
    );

    expect(orderOf(standings).slice(0, 2)).toEqual(['t1', 't3']);
    expect(standingOf(standings, 't1').points).toBe(20);
    expect(standingOf(standings, 't3').points).toBe(36);
  });

  it('separates teams level on rate and on total points by what they did to each other', () => {
    // t1 and t2 both score 24 over two matches. They met once, and t1 won that meeting, so the
    // second place is t1s and the third is t2s — a tie the evidence can speak to.
    const standings = computeTeamStandings(
      scoredTeamSession([
        [{ sideA: 't1', sideB: 't2', score: [16, 8] }],
        [{ sideA: 't1', sideB: 't3', score: [8, 16] }],
        [{ sideA: 't2', sideB: 't3', score: [16, 8] }],
        [{ sideA: 't3', sideB: 't4', score: [24, 0] }],
      ]),
    );

    expect(standingOf(standings, 't1').points).toBe(standingOf(standings, 't2').points);
    expect(standingOf(standings, 't1').pointsPerMatch).toBe(
      standingOf(standings, 't2').pointsPerMatch,
    );
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

  it('gives a team that has not been on court a line of zeroes rather than no line', () => {
    const standings = computeTeamStandings(
      scoredTeamSession([[{ sideA: 't1', sideB: 't2', score: [16, 8] }]], { teamCount: 3 }),
    );

    expect(standingOf(standings, 't3')).toMatchObject({
      matchesPlayed: 0,
      points: 0,
      pointsPerMatch: 0,
      position: 3,
    });
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
