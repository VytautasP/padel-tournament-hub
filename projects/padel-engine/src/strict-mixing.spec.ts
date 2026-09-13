import {
  addRound,
  assertSessionValid,
  createSession,
  finishSession,
  generateRemaining,
  recordScore,
  removePlayer,
} from './public-api';
import type { Session, SessionConfig } from './public-api';
import { damaged } from './test-support/damaged-session';
import { mixedRoster, mixicanoConfig } from './test-support/mixicano-fixtures';
import { americanoConfig } from './test-support/session-fixtures';
import { teamAmericanoConfig } from './test-support/team-fixtures';

/** A strict Mixicano for any gender split, generated. */
function strictSplit(women: number, men: number, courtCount: number, roundCount = 5): Session {
  return generateRemaining(
    createSession(
      mixicanoConfig({
        players: mixedRoster(women, men),
        courtCount,
        roundCount,
        strictMixing: true,
      }),
    ),
  );
}

/** How many courts each round of this session actually filled. */
function courtsFilled(session: Session): number[] {
  return session.rounds.map((round) => round.matches.length);
}

/** Every match of one round scored, so a roster change cannot redraw it. */
function scoredRound(session: Session, roundNumber: number): Session {
  return session.rounds[roundNumber - 1].matches.reduce(
    (scored, match) => recordScore(scored, { matchId: match.id, side: 'A', points: 12 }),
    session,
  );
}

/**
 * The words a refusal used, so two call sites can be held to the same ones.
 *
 * The rule is that a configuration the engine refuses to build reads exactly like a session that
 * has drifted into the same state — which is a claim about the text and can only be tested by
 * comparing the text.
 */
function refusalFrom(act: () => unknown): string {
  try {
    act();
  } catch (error) {
    return (error as Error).message;
  }

  throw new Error('Expected a refusal, and nothing was thrown.');
}

describe('createSession — the strict-mixing flag', () => {
  it('carries the organizer’s choice onto the session, either way', () => {
    const strict = createSession(mixicanoConfig({ strictMixing: true }));
    const hybrid = createSession(mixicanoConfig({ strictMixing: false }));

    expect(strict.strictMixing).toBe(true);
    expect(hybrid.strictMixing).toBe(false);

    assertSessionValid(strict);
    assertSessionValid(hybrid);
  });

  it('writes no flag at all when the configuration carries none', () => {
    const session = createSession(mixicanoConfig());

    expect('strictMixing' in session).toBe(false);

    assertSessionValid(session);
  });

  it('refuses the flag outside Mixicano, whichever way it is set', () => {
    expect(() => createSession(americanoConfig({ strictMixing: true }))).toThrow(
      /only mixicano mixes strictly/i,
    );
    expect(() => createSession(americanoConfig({ strictMixing: false }))).toThrow(
      /only mixicano mixes strictly/i,
    );
    expect(() => createSession(teamAmericanoConfig({ strictMixing: true }))).toThrow(
      /only mixicano mixes strictly/i,
    );

    // The rejection has to be about the flag and nothing else, so the test ends by validating
    // the sessions the same fixtures build without it.
    assertSessionValid(createSession(americanoConfig()));
    assertSessionValid(createSession(teamAmericanoConfig()));
  });

  it('refuses a session that drifted into a flag its mode has no use for', () => {
    const americano = createSession(americanoConfig());

    expect(() =>
      assertSessionValid(
        damaged(americano, (copy) => {
          copy.strictMixing = true;
        }),
      ),
    ).toThrow(/only mixicano mixes strictly/i);

    assertSessionValid(americano);
  });
});

describe('createSession — the roster strict mixing refuses', () => {
  it('refuses a strict roster with fewer than two of either gender', () => {
    const tooFewMen = mixicanoConfig({ players: mixedRoster(9, 1), strictMixing: true });
    const noMenAtAll = mixicanoConfig({ players: mixedRoster(8, 0), strictMixing: true });
    const tooFewWomen = mixicanoConfig({ players: mixedRoster(1, 9), strictMixing: true });

    expect(() => createSession(tooFewMen)).toThrow(/at least 2 women and 2 men/i);
    expect(() => createSession(noMenAtAll)).toThrow(/at least 2 women and 2 men/i);
    expect(() => createSession(tooFewWomen)).toThrow(/at least 2 women and 2 men/i);

    // It is the strictness that refuses these rosters, not the rosters themselves.
    assertSessionValid(createSession({ ...tooFewMen, strictMixing: false }));
  });

  it('refuses it in the same words the referee uses', () => {
    const config = mixicanoConfig({ players: mixedRoster(9, 1), strictMixing: true });
    const hybrid = createSession({ ...config, strictMixing: false });
    const drifted = damaged(hybrid, (copy) => {
      copy.strictMixing = true;
    });

    expect(refusalFrom(() => assertSessionValid(drifted))).toBe(
      refusalFrom(() => createSession(config)),
    );

    assertSessionValid(hybrid);
  });

  it('takes a roster with exactly two of each, which is one court’s worth', () => {
    const session = strictSplit(2, 2, 2);

    expect(courtsFilled(session)).toEqual([1, 1, 1, 1, 1]);

    assertSessionValid(session);
  });

  it('leaves hybrid fill free to schedule the rosters strictness refuses', () => {
    const hybrid = generateRemaining(
      createSession(
        mixicanoConfig({ players: mixedRoster(9, 1), courtCount: 2, strictMixing: false }),
      ),
    );

    expect(courtsFilled(hybrid)).toEqual([2, 2, 2, 2, 2]);

    assertSessionValid(hybrid);
  });
});

describe('the courts a strict session fills', () => {
  it('plays the courts the smaller gender can staff', () => {
    // Seven women and three men make one mixed court and bench six, where hybrid fill would have
    // played two courts and benched two (ADR-0036 §2).
    const session = strictSplit(7, 3, 2);

    expect(courtsFilled(session)).toEqual([1, 1, 1, 1, 1]);

    assertSessionValid(session);
  });

  it('is still bound by the courts the organizer booked', () => {
    const session = strictSplit(6, 6, 2);

    expect(courtsFilled(session)).toEqual([2, 2, 2, 2, 2]);

    assertSessionValid(session);
  });

  it('fills every booked court when the split can staff them', () => {
    const session = strictSplit(4, 4, 2);

    expect(courtsFilled(session)).toEqual([2, 2, 2, 2, 2]);

    assertSessionValid(session);
  });

  it('leaves every other session counting its courts off the roster', () => {
    const hybrid = generateRemaining(
      createSession(
        mixicanoConfig({ players: mixedRoster(7, 3), courtCount: 2, strictMixing: false }),
      ),
    );
    const americano = generateRemaining(
      createSession(americanoConfig({ players: mixedRoster(7, 3), courtCount: 2 })),
    );

    expect(courtsFilled(hybrid)).toEqual([2, 2, 2, 2, 2]);
    expect(courtsFilled(americano)).toEqual([2, 2, 2, 2, 2]);

    assertSessionValid(hybrid);
    assertSessionValid(americano);
  });

  it('asks the count per round, so a departure changes it from that round onward', () => {
    const session = strictSplit(4, 4, 2, 5);
    const afterRoundOne = removePlayer(scoredRound(session, 1), 'p8');

    // p8 is one of the four men, so from round two there are three — and three men make one
    // mixed court, not two. The round they played keeps the two courts it played on.
    expect(courtsFilled(afterRoundOne)).toEqual([2, 1, 1, 1, 1]);

    assertSessionValid(afterRoundOne);
  });
});

describe('a Mixicano written before strict mixing existed', () => {
  /** Seven women and three men: two courts under hybrid fill, and one under strict mixing. */
  const legacy: SessionConfig = mixicanoConfig({
    players: mixedRoster(7, 3),
    courtCount: 2,
    roundCount: 6,
  });

  it('schedules exactly as hybrid fill does', () => {
    const stored = generateRemaining(createSession(legacy));
    const hybrid = generateRemaining(createSession({ ...legacy, strictMixing: false }));

    expect(stored.rounds).toEqual(hybrid.rounds);

    assertSessionValid(stored);
    assertSessionValid(hybrid);
  });

  it('comes back off the wire as the document it was stored as, and regenerates to itself', () => {
    const stored = generateRemaining(createSession(legacy));
    // What the app actually holds: a document that went to storage as JSON and came back. A
    // field the engine never wrote cannot appear on the way back, and an absent one means what
    // it meant the day it was written.
    const readBack = JSON.parse(JSON.stringify(stored)) as Session;

    expect('strictMixing' in readBack).toBe(false);
    expect(generateRemaining(readBack)).toEqual(stored);

    assertSessionValid(readBack);
  });

  it('is extended under the rule its played rounds were scheduled by', () => {
    // The case ADR-0036 §7 names: an organizer tapping `+ add round` on a live hybrid evening.
    // The round they get is a hybrid round — two courts — and nothing behind it moves.
    const played = scoredRound(generateRemaining(createSession(legacy)), 1);
    const extended = generateRemaining(addRound(played));

    expect(extended.rounds.slice(0, played.rounds.length)).toEqual(played.rounds);
    expect(courtsFilled(extended)).toEqual([2, 2, 2, 2, 2, 2, 2]);

    assertSessionValid(extended);
  });
});

describe('the flag is fixed at creation', () => {
  it('is carried by every operation and changed by none', () => {
    const session = strictSplit(4, 4, 2, 3);
    const scored = scoredRound(session, 1);
    const carried = [
      generateRemaining(session),
      addRound(session),
      scored,
      removePlayer(scored, 'p8'),
      finishSession(scored),
    ];

    expect(carried.map((amended) => amended.strictMixing)).toEqual([true, true, true, true, true]);

    for (const amended of carried) {
      assertSessionValid(amended);
    }
  });
});
