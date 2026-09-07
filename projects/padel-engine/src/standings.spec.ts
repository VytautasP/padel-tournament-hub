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
      won: 2,
      tied: 0,
      lost: 0,
      benched: 0,
    });
  });

  it('ranks on total points, so playing more is worth more than averaging more', () => {
    // p1 sat out two of the three rounds and won the one they played by the length of the court;
    // p2 played twice and scored more in total. Under a rate p1 would lead the table on one
    // result. Under a total, the evening is what counts (ADR-0023 §1).
    const standings = computeStandings(
      scoredSession([
        [{ sideA: ['p1', 'p5'], sideB: ['p3', 'p4'], score: [20, 4] }],
        [{ sideA: ['p2', 'p5'], sideB: ['p3', 'p4'], score: [18, 6] }],
        [{ sideA: ['p2', 'p6'], sideB: ['p3', 'p4'], score: [18, 6] }],
      ]),
    );

    expect(orderOf(standings).slice(0, 3)).toEqual(['p5', 'p2', 'p1']);
    expect(standingOf(standings, 'p1')).toMatchObject({ points: 44, matchesPlayed: 1, benched: 2 });
    expect(standingOf(standings, 'p2')).toMatchObject({ points: 48, matchesPlayed: 2, benched: 1 });
  });

  it('records a win, a tie and a loss from the score of each match', () => {
    const standings = computeStandings(
      scoredSession([
        [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
        [{ sideA: ['p1', 'p3'], sideB: ['p2', 'p4'], score: [12, 12] }],
        [{ sideA: ['p1', 'p4'], sideB: ['p2', 'p3'], score: [8, 16] }],
      ]),
    );

    expect(standingOf(standings, 'p1')).toMatchObject({
      matchesPlayed: 3,
      won: 1,
      tied: 1,
      lost: 1,
      benched: 0,
    });
  });

  describe('the bench credit', () => {
    it('pays a benched player half the target score for the round they sat out', () => {
      const standings = computeStandings(
        scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }]], {
          playerCount: 5,
        }),
      );

      expect(standingOf(standings, 'p5')).toMatchObject({
        points: 12,
        benched: 1,
        matchesPlayed: 0,
        won: 0,
        tied: 0,
        lost: 0,
      });
    });

    it('pays half of a target score that does not halve', () => {
      const standings = computeStandings(
        scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [11, 10] }]], {
          playerCount: 5,
          targetScore: 21,
        }),
      );

      expect(standingOf(standings, 'p5').points).toBe(10.5);
    });

    it('pays nothing for a round whose courts have not all reported', () => {
      const standings = computeStandings(
        scoredSession(
          [
            [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
            [{ sideA: ['p1', 'p3'], sideB: ['p2', 'p4'] }],
          ],
          { playerCount: 5 },
        ),
      );

      expect(standingOf(standings, 'p5')).toMatchObject({ points: 12, benched: 1 });
      expect(standingOf(standings, 'p1')).toMatchObject({ matchesPlayed: 1, points: 16 });
    });

    it('pays nobody for a round that has not been generated', () => {
      // The slot exists because the organizer asked for the rounds, not because anyone played
      // one. Every match in it is scored only in the sense that there are none.
      const standings = computeStandings(
        scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }], []], {
          playerCount: 5,
        }),
      );

      expect(standingOf(standings, 'p1')).toMatchObject({ points: 16, benched: 0 });
      expect(standingOf(standings, 'p5')).toMatchObject({ points: 12, benched: 1 });
    });

    it('pays nobody for the rounds they were not in the session for', () => {
      // p5 arrives for round 3 and p6 goes home after round 1. Being absent is not being benched
      // (ADR-0023 §3): p6 is paid for the round they were here and sat out, p5 for nothing.
      const standings = computeStandings(
        scoredSession(
          [
            [{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] }],
            [{ sideA: ['p1', 'p3'], sideB: ['p2', 'p4'], score: [16, 8] }],
          ],
          {
            playerCount: 6,
            arrivals: { p5: { joinedAtRound: 3 }, p6: { leftAfterRound: 1 } },
          },
        ),
      );

      expect(standingOf(standings, 'p6')).toMatchObject({ points: 12, benched: 1 });
      expect(standingOf(standings, 'p5')).toMatchObject({ points: 0, benched: 0 });
    });

    it('ranks a benched player above one who played and scored nothing', () => {
      // The bench is paid a drawn match; a whitewash is paid what it scored. This is the whole
      // shape of the decision, and it is worth stating rather than leaving to arithmetic.
      const standings = computeStandings(
        scoredSession([[{ sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [24, 0] }]], {
          playerCount: 5,
        }),
      );

      expect(standingOf(standings, 'p5').points).toBe(12);
      expect(positionOf(standings, 'p5')).toBeLessThan(positionOf(standings, 'p3'));
    });
  });

  describe('tie-breaks', () => {
    it('breaks a tie on total points by head-to-head', () => {
      // p1 and p2 finish on 36 from three matches each, nobody benched. They met once, in round
      // one, and p1 took that meeting 20-4.
      const standings = computeStandings(
        scoredSession([
          [
            { sideA: ['p1', 'p5'], sideB: ['p2', 'p6'], score: [20, 4] },
            { sideA: ['p3', 'p7'], sideB: ['p4', 'p8'], score: [12, 12] },
          ],
          [
            { sideA: ['p1', 'p7'], sideB: ['p3', 'p4'], score: [8, 16] },
            { sideA: ['p2', 'p8'], sideB: ['p5', 'p6'], score: [20, 4] },
          ],
          [
            { sideA: ['p1', 'p5'], sideB: ['p4', 'p8'], score: [8, 16] },
            { sideA: ['p2', 'p3'], sideB: ['p6', 'p7'], score: [12, 12] },
          ],
        ]),
      );

      expect(standingOf(standings, 'p1')).toMatchObject({
        points: 36,
        matchesPlayed: 3,
        benched: 0,
      });
      expect(standingOf(standings, 'p2')).toMatchObject({
        points: 36,
        matchesPlayed: 3,
        benched: 0,
      });
      expect(positionOf(standings, 'p1')).toBe(positionOf(standings, 'p2') - 1);
      expect(standingOf(standings, 'p1').joint).toBe(false);
    });

    it('ranks three tied players on how they did against each other', () => {
      // p1, p2 and p3 all finish on 58 from five matches, nobody benched. They met each other
      // once apiece — p1 beat p2, p1 beat p3, p2 beat p3 — and the last two rounds level their
      // totals without any of the three facing another.
      const standings = computeStandings(
        scoredSession([
          [
            { sideA: ['p1', 'p5'], sideB: ['p2', 'p6'], score: [14, 10] },
            { sideA: ['p3', 'p7'], sideB: ['p4', 'p8'], score: [12, 12] },
          ],
          [
            { sideA: ['p1', 'p6'], sideB: ['p3', 'p5'], score: [14, 10] },
            { sideA: ['p2', 'p7'], sideB: ['p4', 'p8'], score: [12, 12] },
          ],
          [
            { sideA: ['p2', 'p5'], sideB: ['p3', 'p6'], score: [14, 10] },
            { sideA: ['p1', 'p7'], sideB: ['p4', 'p8'], score: [12, 12] },
          ],
          [
            { sideA: ['p1', 'p2'], sideB: ['p5', 'p6'], score: [8, 16] },
            { sideA: ['p3', 'p7'], sideB: ['p4', 'p8'], score: [16, 8] },
          ],
          [
            { sideA: ['p1', 'p3'], sideB: ['p5', 'p7'], score: [10, 14] },
            { sideA: ['p2', 'p6'], sideB: ['p4', 'p8'], score: [14, 10] },
          ],
        ]),
      );

      for (const playerId of ['p1', 'p2', 'p3']) {
        expect(standingOf(standings, playerId)).toMatchObject({ points: 58, joint: false });
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
      // Two courts, one round: the winners of each are level on points and have no evidence
      // between them, because they were never on the same court.
      const standings = computeStandings(
        scoredSession([
          [
            { sideA: ['p1', 'p2'], sideB: ['p3', 'p4'], score: [16, 8] },
            { sideA: ['p5', 'p6'], sideB: ['p7', 'p8'], score: [16, 8] },
          ],
        ]),
      );

      expect(positionOf(standings, 'p5')).toBe(positionOf(standings, 'p1'));
      expect(standingOf(standings, 'p1').joint).toBe(true);
    });

    it('declines head-to-head for the whole group when one member never met it', () => {
      // p1, p2, p5 and p8 all finish on 24. p8 partnered p2 and faced neither of the others, so
      // there is no place to put them: half a tier would rank p8 on nothing, and the tie stands.
      const standings = computeStandings(
        scoredSession([
          [
            { sideA: ['p1', 'p5'], sideB: ['p2', 'p6'], score: [20, 4] },
            { sideA: ['p3', 'p4'], sideB: ['p7', 'p8'], score: [20, 4] },
          ],
          [
            { sideA: ['p1', 'p5'], sideB: ['p3', 'p4'], score: [4, 20] },
            { sideA: ['p2', 'p8'], sideB: ['p6', 'p7'], score: [20, 4] },
          ],
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
