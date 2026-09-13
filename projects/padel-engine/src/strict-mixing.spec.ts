import {
  addRound,
  assertSessionValid,
  courtsUnusedByStrictMixing,
  createSession,
  finishSession,
  generateRemaining,
  recordScore,
  removePlayer,
} from './public-api';
import type { Gender, PlayerId, Session, SessionConfig } from './public-api';
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

describe('the courts strict mixing left empty', () => {
  it('names the booked court the smaller gender could not staff', () => {
    // Seven women and three men on two courts: hybrid fill would have played both, so court 2 is
    // empty because of the rule and the round can say which rule (ADR-0036 §8).
    const session = strictSplit(7, 3, 2);

    expect(courtsUnusedByStrictMixing(session, 1)).toEqual([2]);
  });

  it('names nothing when the roster fills every court it booked', () => {
    expect(courtsUnusedByStrictMixing(strictSplit(4, 4, 2), 1)).toEqual([]);
  });

  it('does not blame strictness for a court nobody could have filled', () => {
    // Six women and six men on four courts play three: the fourth court is empty because there
    // are twelve players, which is true under every rule there is.
    const session = strictSplit(6, 6, 4);

    expect(courtsFilled(session)).toEqual([3, 3, 3, 3, 3]);
    expect(courtsUnusedByStrictMixing(session, 1)).toEqual([]);
  });

  it('names nothing at all on a session that does not mix strictly', () => {
    const hybrid = generateRemaining(
      createSession(
        mixicanoConfig({ players: mixedRoster(7, 3), courtCount: 2, strictMixing: false }),
      ),
    );

    expect(courtsUnusedByStrictMixing(hybrid, 1)).toEqual([]);
  });

  it('answers per round, so a departure changes which courts are empty', () => {
    // Six women and four men fill both courts. p10 is one of the four men, so from round two
    // three men staff one court — and the nine still here could have filled two.
    const afterRoundOne = removePlayer(scoredRound(strictSplit(6, 4, 2, 5), 1), 'p10');

    expect(courtsUnusedByStrictMixing(afterRoundOne, 1)).toEqual([]);
    expect(courtsUnusedByStrictMixing(afterRoundOne, 2)).toEqual([2]);

    assertSessionValid(afterRoundOne);
  });
});

describe('a departure that takes a gender below two', () => {
  /*
   * The evening ADR-0036 §5 says the engine does not rescue. Two women and six men play one
   * court; one woman going home leaves a roster nothing can staff strictly — and the engine
   * schedules no matches rather than falling back to hybrid fill behind the organizer.
   */
  const stranded = (): Session => removePlayer(scoredRound(strictSplit(2, 6, 2, 4), 1), 'p1');

  it('plans no courts at all from the round it happens in', () => {
    expect(courtsFilled(stranded())).toEqual([1, 0, 0, 0]);
  });

  it('leaves the round they played exactly as it was played', () => {
    const played = scoredRound(strictSplit(2, 6, 2, 4), 1);

    expect(stranded().rounds[0]).toEqual(played.rounds[0]);
  });

  it('is a session the referee still accepts, because nothing in it is wrong', () => {
    // The rounds it cannot staff read as ungenerated, which is what they are: slots waiting for
    // a roster that could fill them. The organizer keeps the player or ends the evening.
    expect(() => assertSessionValid(stranded())).not.toThrow();
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

/** The gender of each player, read off the roster rather than asked of the engine. */
function genderOf(session: Session): (id: PlayerId) => Gender | undefined {
  const genders = new Map(session.roster.map((entry) => [entry.id, entry.gender]));

  return (id) => genders.get(id);
}

/** Every pair the session schedules, round by round. */
function pairsByRound(session: Session): (readonly [PlayerId, PlayerId])[][] {
  return session.rounds.map((round) =>
    round.matches.flatMap((match) => [match.sideA, match.sideB]),
  );
}

/**
 * The same-gender pairs of each round, worked out from the roster rather than asked of the
 * engine: an oracle that shared the engine's own rule could not catch it getting that rule wrong.
 */
function sameGenderPairs(session: Session): (readonly [PlayerId, PlayerId])[][] {
  const gender = genderOf(session);

  return pairsByRound(session).map((round) => round.filter(([a, b]) => gender(a) === gender(b)));
}

/** How often each player had sat out, after each round prefix. */
function benchCountsByPrefix(session: Session): Map<PlayerId, number>[] {
  const counts = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));

  return session.rounds.map((round) => {
    const playing = new Set(round.matches.flatMap((match) => [...match.sideA, ...match.sideB]));
    for (const entry of session.roster) {
      if (!playing.has(entry.id)) {
        counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
      }
    }

    return new Map(counts);
  });
}

/** The populations a bench spread is asked of: everybody, or each gender on its own. */
const everybody = (session: Session): PlayerId[][] => [session.roster.map((entry) => entry.id)];
const byGender = (session: Session): PlayerId[][] => {
  const gender = genderOf(session);

  return (['woman', 'man'] as const).map((one) =>
    session.roster.filter((entry) => gender(entry.id) === one).map((entry) => entry.id),
  );
};

/**
 * The widest gap, over every prefix, between two players of one queue in how often they have sat
 * out — the bench question asked of the population that could have answered it (ADR-0036 §3).
 */
function widestBenchGapAcross(
  session: Session,
  queuesOf: (session: Session) => PlayerId[][],
): number {
  const queues = queuesOf(session).filter((queue) => queue.length > 0);

  return Math.max(
    ...benchCountsByPrefix(session).flatMap((counts) =>
      queues.map((queue) => {
        const sat = queue.map((id) => counts.get(id) ?? 0);

        return Math.max(...sat) - Math.min(...sat);
      }),
    ),
  );
}

/** How often each player took the court. */
function roundsPlayed(session: Session): Map<PlayerId, number> {
  const played = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));
  for (const round of session.rounds) {
    for (const id of round.matches.flatMap((match) => [...match.sideA, ...match.sideB])) {
      played.set(id, (played.get(id) ?? 0) + 1);
    }
  }

  return played;
}

/** Every gender split the shape check admits a strict session for, up to `most` of each. */
function everyStrictSplit(most: number): readonly (readonly [number, number])[] {
  const splits: (readonly [number, number])[] = [];
  for (let women = 2; women <= most; women++) {
    for (let men = 2; men <= most; men++) {
      splits.push([women, men]);
    }
  }

  return splits;
}

describe('the pairs a strict session forms', () => {
  it('forms no same-gender pair, on any roster the shape check admits, at any prefix', () => {
    const sessions = everyStrictSplit(8).map((split) => strictSplit(...split, 3, 4));
    const offending = sessions
      .map((session, index) => [everyStrictSplit(8)[index], sameGenderPairs(session).flat()])
      .filter(([, pairs]) => (pairs as unknown[]).length > 0);

    expect(offending).toEqual([]);

    for (const session of sessions) {
      assertSessionValid(session);
    }
  });

  it('still pairs a roster it could pair with a same-gender pair in it', () => {
    // Five women and three men: hybrid fill would put two women together and play two courts.
    const session = strictSplit(5, 3, 2, 4);

    expect(sameGenderPairs(session).flat()).toEqual([]);
    expect(courtsFilled(session)).toEqual([1, 1, 1, 1]);

    assertSessionValid(session);
  });

  it('keeps partner variety among the partners a strict session is allowed', () => {
    // Four of each on two courts: every woman can partner every man, and over four rounds the
    // search has room to do it without repeating one.
    const session = strictSplit(4, 4, 2, 4);
    const partnered = pairsByRound(session)
      .flat()
      .map(([a, b]) => [a, b].sort().join('+'));

    expect(new Set(partnered).size).toBe(partnered.length);

    assertSessionValid(session);
  });

  it('leaves hybrid fill pairing and benching exactly as it did', () => {
    // The one branch that could leak: hybrid fill still makes the same-gender pair its arithmetic
    // forces, and still benches the whole roster as one queue rather than one per gender.
    const hybrid = generateRemaining(
      createSession(
        mixicanoConfig({
          players: mixedRoster(7, 3),
          courtCount: 2,
          roundCount: 6,
          strictMixing: false,
        }),
      ),
    );

    // Two courts from a roster strictness would have played one court of, a same-gender pair in
    // every round of it, and — the queue itself — a bench spread of one across the whole ten,
    // which is exactly what per-gender queueing would break.
    expect(courtsFilled(hybrid)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(sameGenderPairs(hybrid).every((round) => round.length > 0)).toBe(true);
    expect(widestBenchGapAcross(hybrid, everybody)).toBe(1);

    assertSessionValid(hybrid);
  });
});

describe('the bench a strict session rotates', () => {
  it('keeps bench counts within one inside each gender, after every round', () => {
    const sessions = everyStrictSplit(8).map((split) => strictSplit(...split, 3, 4));
    const uneven = sessions
      .map((session, index) => [
        everyStrictSplit(8)[index],
        widestBenchGapAcross(session, byGender),
      ])
      .filter(([, gap]) => (gap as number) > 1);

    expect(uneven).toEqual([]);

    for (const session of sessions) {
      assertSessionValid(session);
    }
  });

  it('rotates seven women and three men through the one court they staff', () => {
    // Seven rounds of one court is fourteen slots per gender: exactly two each for the women,
    // and four or five each for the three men, who are on court almost every round (ADR-0036 §4).
    // Six sit every round — five women and the third man — which is the price §2 accepts.
    const session = strictSplit(7, 3, 2, 7);
    const played = roundsPlayed(session);
    const women = session.roster.slice(0, 7).map((entry) => played.get(entry.id));
    const men = session.roster.slice(7).map((entry) => played.get(entry.id));

    expect(courtsFilled(session)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(women).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect([...men].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([4, 5, 5]);
    expect(widestBenchGapAcross(session, byGender)).toBe(1);

    assertSessionValid(session);
  });

  it('fills every court the gender split can staff, on every roster it admits', () => {
    // A bench queue that ran out of sets would leave a round short of the courts it is entitled
    // to, so this is where "the generator always yields a set" is visible from outside.
    const splits = everyStrictSplit(8);
    const sessions = splits.map((split) => strictSplit(...split, 3, 4));
    const entitled = splits.map(([women, men]) =>
      Array.from({ length: 4 }, () => Math.min(3, Math.floor(Math.min(women, men) / 2))),
    );

    expect(sessions.map(courtsFilled)).toEqual(entitled);

    for (const session of sessions) {
      assertSessionValid(session);
    }
  });
});

describe('the schedule a strict session is a function of', () => {
  it('schedules the same evening twice from the same roster and history', () => {
    const once = strictSplit(6, 6, 2, 8);

    expect(strictSplit(6, 6, 2, 8).rounds).toEqual(once.rounds);
    expect(generateRemaining(once).rounds).toEqual(once.rounds);

    assertSessionValid(once);
  });
});
