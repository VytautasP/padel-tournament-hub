import { assertSessionValid, createSession, generateRemaining, recordScore } from './public-api';
import type { Match, MatchId, Session } from './public-api';
import { damaged } from './test-support/damaged-session';
import type { MutableScore } from './test-support/damaged-session';
import { americanoConfig } from './test-support/session-fixtures';

/** A generated session: two courts, six rounds, target 24, nothing scored yet. */
function generated(): Session {
  return generateRemaining(createSession(americanoConfig({ courtCount: 2, roundCount: 6 })));
}

function matchAt(session: Session, roundNumber: number, courtNumber: number): Match {
  const match = session.rounds
    .find((round) => round.number === roundNumber)
    ?.matches.find((candidate) => candidate.courtNumber === courtNumber);
  if (!match) {
    throw new Error(`Fixture has no round ${roundNumber} court ${courtNumber}.`);
  }

  return match;
}

function firstMatchId(session: Session): MatchId {
  return matchAt(session, 1, 1).id;
}

function scoreOf(session: Session, matchId: MatchId): Match['score'] {
  return session.rounds.flatMap((round) => round.matches).find((match) => match.id === matchId)
    ?.score;
}

describe('recordScore', () => {
  it('derives the other side from the session target', () => {
    const session = generated();

    const scored = recordScore(session, { matchId: firstMatchId(session), side: 'A', points: 15 });

    expect(scoreOf(scored, firstMatchId(session))).toEqual({ sideA: 15, sideB: 9 });

    assertSessionValid(scored);
  });

  it('derives side A when side B is the one entered', () => {
    const session = generated();

    const scored = recordScore(session, { matchId: firstMatchId(session), side: 'B', points: 15 });

    expect(scoreOf(scored, firstMatchId(session))).toEqual({ sideA: 9, sideB: 15 });

    assertSessionValid(scored);
  });

  it('accepts both ends of the range the target allows', () => {
    const session = generated();
    const matchId = firstMatchId(session);

    const whitewash = recordScore(session, { matchId, side: 'A', points: 24 });
    const whitewashed = recordScore(session, { matchId, side: 'A', points: 0 });

    expect(scoreOf(whitewash, matchId)).toEqual({ sideA: 24, sideB: 0 });
    expect(scoreOf(whitewashed, matchId)).toEqual({ sideA: 0, sideB: 24 });

    assertSessionValid(whitewash);
    assertSessionValid(whitewashed);
  });

  it('rejects a score above the target', () => {
    const session = generated();

    expect(() =>
      recordScore(session, { matchId: firstMatchId(session), side: 'A', points: 25 }),
    ).toThrow(/between 0 and 24/i);

    assertSessionValid(session);
  });

  it('rejects a negative score', () => {
    const session = generated();

    expect(() =>
      recordScore(session, { matchId: firstMatchId(session), side: 'B', points: -1 }),
    ).toThrow(/between 0 and 24/i);

    assertSessionValid(session);
  });

  it('rejects a fractional score', () => {
    const session = generated();

    expect(() =>
      recordScore(session, { matchId: firstMatchId(session), side: 'A', points: 12.5 }),
    ).toThrow(/whole number/i);

    assertSessionValid(session);
  });

  it('rejects a match the session does not have', () => {
    const session = generated();

    expect(() => recordScore(session, { matchId: 'nope', side: 'A', points: 12 })).toThrow(/nope/);

    assertSessionValid(session);
  });

  it('refuses to score a session that has two matches with the same id', () => {
    // Not a session the engine can build, but one loaded from storage might be — and scoring two
    // courts from one entry is a worse answer than refusing.
    const session = damaged(generated(), (copy) => {
      copy.rounds[1].matches[0].id = copy.rounds[0].matches[0].id;
    });

    expect(() =>
      recordScore(session, { matchId: firstMatchId(session), side: 'A', points: 15 }),
    ).toThrow(/2 matches with id/i);

    assertSessionValid(generated());
  });

  it('overwrites a re-recorded score cleanly, with nothing accumulated', () => {
    const session = generated();
    const matchId = firstMatchId(session);

    const corrected = recordScore(recordScore(session, { matchId, side: 'A', points: 15 }), {
      matchId,
      side: 'A',
      points: 20,
    });

    expect(scoreOf(corrected, matchId)).toEqual({ sideA: 20, sideB: 4 });

    assertSessionValid(corrected);
  });

  it('corrects a score first entered against the wrong side', () => {
    const session = generated();
    const matchId = firstMatchId(session);

    const corrected = recordScore(recordScore(session, { matchId, side: 'A', points: 15 }), {
      matchId,
      side: 'B',
      points: 15,
    });

    expect(scoreOf(corrected, matchId)).toEqual({ sideA: 9, sideB: 15 });

    assertSessionValid(corrected);
  });

  it('scores matches in any order, including across rounds', () => {
    const session = generated();
    const late = matchAt(session, 4, 2).id;
    const early = matchAt(session, 1, 1).id;
    const unfinished = matchAt(session, 4, 1).id;

    const scored = recordScore(recordScore(session, { matchId: late, side: 'A', points: 20 }), {
      matchId: early,
      side: 'B',
      points: 13,
    });

    expect(scoreOf(scored, late)).toEqual({ sideA: 20, sideB: 4 });
    expect(scoreOf(scored, early)).toEqual({ sideA: 11, sideB: 13 });
    // The court on that round that has not finished yet is left alone.
    expect(scoreOf(scored, unfinished)).toBeUndefined();

    assertSessionValid(scored);
  });

  it('returns a new session and mutates nothing', () => {
    const session = generated();
    const matchId = firstMatchId(session);
    const before = structuredClone(session) as Session;

    const scored = recordScore(session, { matchId, side: 'A', points: 15 });

    expect(scored).not.toBe(session);
    expect(session).toEqual(before);
    expect(scoreOf(session, matchId)).toBeUndefined();
    expect(Object.isFrozen(scoreOf(scored, matchId))).toBe(true);

    assertSessionValid(scored);
  });

  it('keeps recorded scores when the remaining rounds are regenerated', () => {
    const session = generated();
    const matchId = firstMatchId(session);

    const regenerated = generateRemaining(recordScore(session, { matchId, side: 'A', points: 15 }));

    expect(scoreOf(regenerated, matchId)).toEqual({ sideA: 15, sideB: 9 });

    assertSessionValid(regenerated);
  });
});

describe('assertSessionValid on recorded scores', () => {
  /** A session with one match scored 15-9, its score then damaged in one specific way. */
  function broken(damage: (score: MutableScore) => void): Session {
    const session = generated();
    const scored = recordScore(session, { matchId: firstMatchId(session), side: 'A', points: 15 });

    return damaged(scored, (copy) => {
      const score = copy.rounds[0].matches[0].score;
      if (!score) {
        throw new Error('Fixture was meant to be scored.');
      }
      damage(score);
    });
  }

  it('accepts a session no match of which has been scored yet', () => {
    const unscored = generated();

    expect(
      unscored.rounds.flatMap((round) => round.matches).every((match) => match.score === undefined),
    ).toBe(true);

    assertSessionValid(unscored);
  });

  it('rejects a score pair that does not sum to the target', () => {
    const session = broken((score) => {
      score.sideB = 8;
    });

    expect(() => assertSessionValid(session)).toThrow(/sum to 24/i);

    assertSessionValid(generated());
  });

  it('rejects a score outside the range the target allows', () => {
    const session = broken((score) => {
      score.sideA = -1;
      score.sideB = 25;
    });

    expect(() => assertSessionValid(session)).toThrow(/between 0 and 24/i);

    assertSessionValid(generated());
  });

  it('rejects a fractional score pair', () => {
    const session = broken((score) => {
      score.sideA = 12.5;
      score.sideB = 11.5;
    });

    expect(() => assertSessionValid(session)).toThrow(/whole number/i);

    assertSessionValid(generated());
  });
});
