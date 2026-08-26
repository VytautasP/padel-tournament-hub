import { computeStandings, createSession, generateRemaining, recordScore } from './public-api';
import type { PlayerId, Session, Standing } from './public-api';
import { damaged } from './test-support/damaged-session';
import { americanoConfig } from './test-support/session-fixtures';
import { scoredSession } from './test-support/standings-fixtures';

function standingOf(standings: readonly Standing[], playerId: PlayerId): Standing {
  const standing = standings.find((candidate) => candidate.playerId === playerId);
  if (!standing) {
    throw new Error(`Standings have no player "${playerId}".`);
  }

  return standing;
}

function positionOf(standings: readonly Standing[], playerId: PlayerId): number {
  return standingOf(standings, playerId).position;
}

function orderOf(standings: readonly Standing[]): PlayerId[] {
  return standings.map((standing) => standing.playerId);
}

describe('computeStandings', () => {
  it('ranks the roster on the scores recorded in the rounds', () => {
    const session = scoredSession([
      [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
      [{ sideA: ['p1', 'p3'], sideB: ['p2', 'p4'], score: [20, 4] }],
    ]);

    const standings = computeStandings(session);

    expect(orderOf(standings)).toEqual(['p1', 'p3', 'p2', 'p4']);
    expect(standingOf(standings, 'p1')).toEqual({
      playerId: 'p1',
      name: 'Ana',
      position: 1,
      joint: false,
      matchesPlayed: 2,
      points: 36,
      pointsPerMatch: 18,
    });
  });

  it('ranks by points per match, so a player who sat out is not overtaken on volume', () => {
    // p2 scores nearly twice p1's total — over twice as many matches. Points per match is what
    // decides, so the bench costs p1 nothing.
    const standings = computeStandings(
      scoredSession([
        [{ sideA: ['p1', 'p5'], sideB: ['p3', 'p4'], score: [20, 4] }],
        [{ sideA: ['p2', 'p5'], sideB: ['p3', 'p4'], score: [18, 6] }],
        [{ sideA: ['p2', 'p6'], sideB: ['p3', 'p4'], score: [18, 6] }],
      ]),
    );

    expect(orderOf(standings).slice(0, 3)).toEqual(['p1', 'p5', 'p2']);
    expect(standingOf(standings, 'p1').points).toBe(20);
    expect(standingOf(standings, 'p2').points).toBe(36);
  });

  it('counts only the matches actually played in a partly scored session', () => {
    const standings = computeStandings(
      scoredSession([
        [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
        [{ sideA: ['p1', 'p3'], sideB: ['p2', 'p4'] }],
      ]),
    );

    expect(standingOf(standings, 'p1')).toMatchObject({
      matchesPlayed: 1,
      points: 16,
      pointsPerMatch: 16,
    });
  });

  it('gives a player who has not been on court no matches and no points', () => {
    const standings = computeStandings(
      scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }]], {
        playerCount: 5,
      }),
    );

    expect(standingOf(standings, 'p5')).toMatchObject({
      position: 5,
      matchesPlayed: 0,
      points: 0,
      pointsPerMatch: 0,
    });
  });

  describe('tie-breaks', () => {
    it('breaks a tie on points per match by total points', () => {
      // p1 and p5 both average 16. Nothing else separates them: they never met, so head-to-head
      // has nothing to say, and the two rounds p1 played are the difference.
      const standings = computeStandings(
        scoredSession([
          [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
          [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
          [{ sideA: ['p5', 'p6'], sideB: ['p7', 'p8'], score: [16, 8] }],
        ]),
      );

      expect(standingOf(standings, 'p1').pointsPerMatch).toBe(
        standingOf(standings, 'p5').pointsPerMatch,
      );
      expect(positionOf(standings, 'p1')).toBe(1);
      expect(positionOf(standings, 'p5')).toBe(3);
    });

    it('breaks a tie on points per match and total points by head-to-head', () => {
      // p1 and p2 finish on 36 points from three matches each. They met once, in round 1, and
      // p1 took that meeting 20-4.
      const standings = computeStandings(
        scoredSession([
          [{ sideA: ['p1', 'p5'], sideB: ['p2', 'p6'], score: [20, 4] }],
          [{ sideA: ['p1', 'p7'], sideB: ['p3', 'p4'], score: [8, 16] }],
          [{ sideA: ['p1', 'p7'], sideB: ['p3', 'p4'], score: [8, 16] }],
          [{ sideA: ['p2', 'p8'], sideB: ['p3', 'p4'], score: [16, 8] }],
          [{ sideA: ['p2', 'p8'], sideB: ['p3', 'p4'], score: [16, 8] }],
        ]),
      );

      expect(standingOf(standings, 'p1')).toMatchObject({ points: 36, pointsPerMatch: 12 });
      expect(standingOf(standings, 'p2')).toMatchObject({ points: 36, pointsPerMatch: 12 });
      expect(positionOf(standings, 'p1')).toBe(positionOf(standings, 'p2') - 1);
      expect(standingOf(standings, 'p1').joint).toBe(false);
    });

    it('ranks three tied players on how they did against each other', () => {
      // p1, p2 and p3 all finish on 48 from four matches. They met each other once apiece: p1
      // won both of its meetings, p2 won the one that was left, and p3 lost both.
      const standings = computeStandings(
        scoredSession([
          [{ sideA: ['p1', 'p5'], sideB: ['p2', 'p6'], score: [20, 4] }],
          [{ sideA: ['p1', 'p5'], sideB: ['p3', 'p6'], score: [20, 4] }],
          [{ sideA: ['p2', 'p5'], sideB: ['p3', 'p6'], score: [20, 4] }],
          [{ sideA: ['p1', 'p7'], sideB: ['p5', 'p6'], score: [4, 20] }],
          [{ sideA: ['p1', 'p7'], sideB: ['p5', 'p6'], score: [4, 20] }],
          [{ sideA: ['p2', 'p7'], sideB: ['p5', 'p6'], score: [12, 12] }],
          [{ sideA: ['p2', 'p7'], sideB: ['p5', 'p6'], score: [12, 12] }],
          [{ sideA: ['p3', 'p7'], sideB: ['p5', 'p6'], score: [20, 4] }],
          [{ sideA: ['p3', 'p7'], sideB: ['p5', 'p6'], score: [20, 4] }],
        ]),
      );

      for (const playerId of ['p1', 'p2', 'p3']) {
        expect(standingOf(standings, playerId)).toMatchObject({
          points: 48,
          pointsPerMatch: 12,
          joint: false,
        });
      }
      expect(positionOf(standings, 'p1')).toBeLessThan(positionOf(standings, 'p2'));
      expect(positionOf(standings, 'p2')).toBeLessThan(positionOf(standings, 'p3'));
    });

    it('declares a joint position when every tier is level', () => {
      const standings = computeStandings(
        scoredSession([[{ sideA: ['p1', 'p3'], sideB: ['p2', 'p4'], score: [12, 12] }]]),
      );

      expect(standings.map((standing) => standing.position)).toEqual([1, 1, 1, 1]);
      expect(standings.every((standing) => standing.joint)).toBe(true);
    });

    it('declares a joint position when the tied players never met each other', () => {
      // p1, p2 and p8 all finish on 36 from three matches, and none of them ever faced another.
      // There is no evidence to separate them, so the standings say so rather than pick one.
      const standings = computeStandings(
        scoredSession([
          [{ sideA: ['p1', 'p5'], sideB: ['p3', 'p4'], score: [20, 4] }],
          [{ sideA: ['p1', 'p7'], sideB: ['p3', 'p4'], score: [8, 16] }],
          [{ sideA: ['p1', 'p7'], sideB: ['p3', 'p4'], score: [8, 16] }],
          [{ sideA: ['p2', 'p8'], sideB: ['p3', 'p4'], score: [12, 12] }],
          [{ sideA: ['p2', 'p8'], sideB: ['p3', 'p4'], score: [12, 12] }],
          [{ sideA: ['p2', 'p8'], sideB: ['p3', 'p4'], score: [12, 12] }],
        ]),
      );

      const shared = positionOf(standings, 'p1');
      expect(positionOf(standings, 'p2')).toBe(shared);
      expect(positionOf(standings, 'p8')).toBe(shared);
      expect(standingOf(standings, 'p1').joint).toBe(true);
    });

    it('declines head-to-head for the whole group when one member never met it', () => {
      // p1, p2 and p8 all finish on 24 from two matches. p1 and p2 met, and p1 took the meeting —
      // but p8 met neither of them, and there is no place to put a player with no record. Half a
      // tier would rank p8 on nothing, so the tier declines and all three stand joint.
      const standings = computeStandings(
        scoredSession([
          [{ sideA: ['p1', 'p5'], sideB: ['p2', 'p6'], score: [20, 4] }],
          [{ sideA: ['p1', 'p7'], sideB: ['p3', 'p4'], score: [4, 20] }],
          [{ sideA: ['p2', 'p7'], sideB: ['p3', 'p4'], score: [20, 4] }],
          [{ sideA: ['p8', 'p5'], sideB: ['p3', 'p4'], score: [12, 12] }],
          [{ sideA: ['p8', 'p5'], sideB: ['p3', 'p4'], score: [12, 12] }],
        ]),
      );

      const shared = positionOf(standings, 'p1');
      expect(positionOf(standings, 'p2')).toBe(shared);
      expect(positionOf(standings, 'p8')).toBe(shared);
      expect(standingOf(standings, 'p1').joint).toBe(true);
    });

    it('leaves the places a joint position occupies empty below it', () => {
      const standings = computeStandings(
        scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }]]),
      );

      expect(standings.map((standing) => standing.position)).toEqual([1, 1, 3, 3]);
    });
  });

  it('does not rank a benched player above or below one who played and scored nothing', () => {
    // p5 has been on the bench all evening and p3 and p4 were whitewashed. Neither has a point,
    // and nothing in a session says which of them is better, so the standings do not pretend.
    const standings = computeStandings(
      scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [24, 0] }]], {
        playerCount: 5,
      }),
    );

    const shared = positionOf(standings, 'p5');
    expect(positionOf(standings, 'p3')).toBe(shared);
    expect(standingOf(standings, 'p5').joint).toBe(true);
  });

  describe('as a derived view', () => {
    it('stores nothing on the session it was computed from', () => {
      const session = scoredSession([
        [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
      ]);

      computeStandings(session);

      expect(Object.keys(session).sort()).toEqual([
        'courtCount',
        'id',
        'mode',
        'roster',
        'rounds',
        'status',
        'targetScore',
      ]);
    });

    it('reflects a corrected score with no step in between', () => {
      const session: Session = generateRemaining(createSession(americanoConfig()));
      const match = session.rounds[0].matches[0];
      const winner = match.sideA[0];

      const typo = recordScore(session, { matchId: match.id, side: 'A', points: 2 });
      const corrected = recordScore(typo, { matchId: match.id, side: 'A', points: 22 });

      expect(standingOf(computeStandings(typo), winner).points).toBe(2);
      expect(standingOf(computeStandings(corrected), winner).points).toBe(22);
    });

    it('returns a frozen list, like every other engine result', () => {
      const standings = computeStandings(
        scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }]]),
      );

      expect(Object.isFrozen(standings)).toBe(true);
      expect(Object.isFrozen(standings[0])).toBe(true);
    });

    it('refuses a session that is not a session', () => {
      const session = scoredSession([
        [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
      ]);

      expect(() =>
        computeStandings(damaged(session, (copy) => (copy.roster[1].id = 'p1'))),
      ).toThrow(/duplicate roster id/i);
    });
  });
});
