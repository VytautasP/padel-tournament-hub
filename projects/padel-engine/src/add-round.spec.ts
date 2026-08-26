import {
  addRound,
  assertSessionValid,
  createSession,
  generateRemaining,
  recordScore,
} from './public-api';
import type { Session } from './public-api';
import { americanoConfig, roster } from './test-support/session-fixtures';

/** A generated session: two courts, three rounds, target 24, nothing scored yet. */
function generated(): Session {
  return generateRemaining(createSession(americanoConfig({ courtCount: 2, roundCount: 3 })));
}

/** Every match in the session scored 15-9 to side A, so an added round has play behind it. */
function allScored(session: Session): Session {
  return session.rounds
    .flatMap((round) => round.matches)
    .reduce(
      (scored, match) => recordScore(scored, { matchId: match.id, side: 'A', points: 15 }),
      session,
    );
}

describe('addRound', () => {
  it('extends a session already in progress by one generated round', () => {
    const played = allScored(generated());

    const extended = addRound(played);

    expect(extended.rounds).toHaveLength(4);
    expect(extended.rounds[3].number).toBe(4);
    expect(extended.rounds[3].matches).toHaveLength(2);
    expect(new Set(extended.rounds.map((round) => round.id)).size).toBe(4);

    assertSessionValid(extended);
  });

  it('leaves the rounds already played exactly as they were', () => {
    const played = allScored(generated());

    const extended = addRound(played);

    expect(extended.rounds.slice(0, 3)).toEqual(played.rounds);

    assertSessionValid(extended);
  });

  it('keeps bench and partner fairness intact round after added round', () => {
    // Five players on one court: someone sits out every round, so the bench has to keep moving
    // for the session to stay valid — and each added round is planned knowing only the rounds
    // before it.
    let session = generateRemaining(
      createSession(americanoConfig({ players: roster(5), courtCount: 1, roundCount: 2 })),
    );

    for (let round = 3; round <= 12; round++) {
      session = addRound(allScored(session));

      expect(session.rounds).toHaveLength(round);
      assertSessionValid(session);
    }
  });

  it('fills any round left ungenerated before the one it adds', () => {
    const session = createSession(americanoConfig({ courtCount: 2, roundCount: 3 }));

    const extended = addRound(session);

    expect(extended.rounds).toHaveLength(4);
    expect(extended.rounds.every((round) => round.matches.length === 2)).toBe(true);

    assertSessionValid(extended);
  });

  it('leaves the session it was given untouched', () => {
    const session = generated();

    addRound(session);

    expect(session.rounds).toHaveLength(3);

    assertSessionValid(session);
  });

  it('returns a session that cannot be mutated', () => {
    const extended = addRound(generated());

    expect(() => {
      (extended.rounds as unknown as unknown[]).push({});
    }).toThrow();

    assertSessionValid(extended);
  });

  it('refuses a session that is not playable in the first place', () => {
    const session = generated();
    const shortRoster = { ...session, roster: session.roster.slice(0, 3) };

    expect(() => addRound(shortRoster)).toThrow(/at least 4 players/);

    assertSessionValid(session);
  });
});
