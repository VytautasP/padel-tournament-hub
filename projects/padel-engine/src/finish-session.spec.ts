import {
  addRound,
  assertSessionValid,
  computeStandings,
  createSession,
  finishSession,
  generateRemaining,
  recordScore,
} from './public-api';
import type { RosterEntry, Session } from './public-api';
import { americanoConfig } from './test-support/session-fixtures';

/** A generated session: two courts, three rounds, target 24, nothing scored yet. */
function generated(): Session {
  return generateRemaining(createSession(americanoConfig({ courtCount: 2, roundCount: 3 })));
}

/** The same session with every match of round 1 scored, so there is a table to freeze. */
function partlyPlayed(): Session {
  const session = generated();

  return session.rounds[0].matches.reduce(
    (scored, match) => recordScore(scored, { matchId: match.id, side: 'A', points: 15 }),
    session,
  );
}

describe('finishSession', () => {
  it('starts a session in progress and marks it finished on request', () => {
    const session = generated();

    expect(session.status).toBe('in-progress');
    expect(finishSession(session).status).toBe('finished');

    assertSessionValid(finishSession(session));
  });

  it('finishes a session whose last round was abandoned unscored', () => {
    const finished = finishSession(partlyPlayed());

    expect(finished.status).toBe('finished');
    expect(finished.rounds[2].matches.every((match) => match.score === undefined)).toBe(true);

    assertSessionValid(finished);
  });

  it('leaves the standings computable and identical to the moment it froze', () => {
    const played = partlyPlayed();

    expect(computeStandings(finishSession(played))).toEqual(computeStandings(played));

    assertSessionValid(finishSession(played));
  });

  it('rejects a score recorded on a finished session', () => {
    const finished = finishSession(partlyPlayed());
    const matchId = finished.rounds[1].matches[0].id;

    expect(() => recordScore(finished, { matchId, side: 'A', points: 15 })).toThrow(
      /session-1.*finished/,
    );

    assertSessionValid(finished);
  });

  it('rejects generating rounds on a finished session', () => {
    const finished = finishSession(createSession(americanoConfig()));

    expect(() => generateRemaining(finished)).toThrow(/session-1.*finished/);

    assertSessionValid(finished);
  });

  it('rejects adding a round to a finished session', () => {
    const finished = finishSession(generated());

    expect(() => addRound(finished)).toThrow(/session-1.*finished/);

    assertSessionValid(finished);
  });

  it('rejects finishing a session that is already finished', () => {
    const finished = finishSession(generated());

    expect(() => finishSession(finished)).toThrow(/session-1.*finished/);

    assertSessionValid(finished);
  });

  it('rejects a roster changed on the session it returns', () => {
    const finished = finishSession(generated());

    expect(() => (finished.roster as RosterEntry[]).push({ id: 'p9', name: 'Iris' })).toThrow();
    expect(() => {
      (finished.roster[0] as { name: string }).name = 'Someone else';
    }).toThrow();

    assertSessionValid(finished);
  });

  it('leaves the session it was given untouched', () => {
    const session = generated();

    finishSession(session);

    expect(session.status).toBe('in-progress');

    assertSessionValid(session);
  });

  it('refuses a session that is not playable in the first place', () => {
    const session = generated();
    const noRounds = { ...session, rounds: [] };

    expect(() => finishSession(noRounds)).toThrow(/at least one round/);

    assertSessionValid(session);
  });
});
