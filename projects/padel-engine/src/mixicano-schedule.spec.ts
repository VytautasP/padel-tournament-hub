import {
  addPlayer,
  assertSessionValid,
  createSession,
  formatSchedule,
  generateRemaining,
  sameGenderSides,
} from './public-api';
import type { Gender, PlayerId, Session, SessionConfig } from './public-api';
import { mixedRoster, mixicanoConfig } from './test-support/mixicano-fixtures';
import { americanoConfig } from './test-support/session-fixtures';

function scheduled(config: SessionConfig): Session {
  return generateRemaining(createSession(config));
}

/** A generated Mixicano session for any gender split, on any number of courts. */
function scheduledSplit(
  women: number,
  men: number,
  courtCount: number,
  roundCount: number,
  id = 'session-1',
): Session {
  return scheduled(
    mixicanoConfig({ id, players: mixedRoster(women, men), courtCount, roundCount }),
  );
}

function genderOf(session: Session): (id: PlayerId) => Gender | undefined {
  const genders = new Map(session.roster.map((entry) => [entry.id, entry.gender]));

  return (id) => genders.get(id);
}

/** Every pair the session schedules, round by round. */
function pairs(session: Session): (readonly [PlayerId, PlayerId])[][] {
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

  return pairs(session).map((round) => round.filter(([a, b]) => gender(a) === gender(b)));
}

/** How many same-gender pairs the players on court in this round cannot avoid. */
function forcedInRound(session: Session, roundIndex: number): number {
  const gender = genderOf(session);
  const playing = session.rounds[roundIndex].matches.flatMap((match) => [
    ...match.sideA,
    ...match.sideB,
  ]);
  const women = playing.filter((id) => gender(id) === 'woman').length;

  return Math.abs(women - (playing.length - women)) / 2;
}

/** How often each player has been in a same-gender pair, after each round prefix. */
function compromisesByPrefix(session: Session): Map<PlayerId, number>[] {
  const counts = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));

  return sameGenderPairs(session).map((round) => {
    for (const id of round.flat()) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return new Map(counts);
  });
}

/**
 * The fewest same-gender pairs a round could possibly have made — the minimum over *every* bench
 * that keeps bench counts within one of each other, not merely over the bench that was chosen.
 *
 * This is the ticket's "never one more than arithmetic demands" read at its strongest, and it is
 * a stronger claim than the referee makes: `assertSessionValid` holds a round to the players who
 * were on court, because bench fairness is structural and is never traded for mixing (ADR-0010).
 * The scheduler nonetheless spends whatever slack the bench rule leaves on mixing, and this
 * oracle is how that is held to account.
 *
 * The bench rule is restated here rather than asked of the engine: anyone below the cut-off count
 * must sit out, the choice is among the players tied at it, and how many of those are women is
 * the only thing that moves the answer.
 */
function fewestPossible(session: Session, benched: ReadonlyMap<PlayerId, number>): number {
  const gender = genderOf(session);
  const roster = session.roster.map((entry) => entry.id);
  const courts = Math.min(session.courtCount, Math.floor(roster.length / 4));
  const benchSize = roster.length - courts * 4;

  const satOut = (id: PlayerId): number => benched.get(id) ?? 0;
  const inOrder = [...roster].sort((a, b) => satOut(a) - satOut(b));
  const cutOff = benchSize > 0 ? satOut(inOrder[benchSize - 1]) : Number.NEGATIVE_INFINITY;
  const mustSit = roster.filter((id) => satOut(id) < cutOff);
  const maySit = roster.filter((id) => satOut(id) === cutOff);
  const slots = benchSize - mustSit.length;

  const women = (ids: readonly PlayerId[]): number =>
    ids.filter((id) => gender(id) === 'woman').length;
  const onCourtWomen = women(roster) - women(mustSit);
  const onCourtMen = roster.length - women(roster) - (mustSit.length - women(mustSit));

  const options: number[] = [];
  for (let benchedWomen = 0; benchedWomen <= slots; benchedWomen++) {
    const benchedMen = slots - benchedWomen;
    if (benchedWomen > women(maySit) || benchedMen > maySit.length - women(maySit)) {
      continue;
    }

    options.push(Math.abs(onCourtWomen - benchedWomen - (onCourtMen - benchedMen)) / 2);
  }

  return Math.min(...options);
}

describe('createSession — Mixicano', () => {
  it('carries each roster entry’s gender onto the session', () => {
    const session = createSession(mixicanoConfig({ players: mixedRoster(5, 3), roundCount: 4 }));

    expect(session.mode).toBe('mixicano');
    expect(session.roster.map((entry) => entry.gender)).toEqual([
      'woman',
      'woman',
      'woman',
      'woman',
      'woman',
      'man',
      'man',
      'man',
    ]);

    assertSessionValid(session);
  });

  it('refuses a Mixicano roster with a gender missing from any entry', () => {
    const players = mixedRoster(4, 4).map((entry, index) =>
      index === 5 ? { id: entry.id, name: entry.name } : entry,
    );

    expect(() => createSession(mixicanoConfig({ players }))).toThrow(
      /Mixicano needs a gender on every roster entry/,
    );
  });

  it('refuses a gender it does not understand, in either mode', () => {
    const players = mixedRoster(4, 4).map((entry, index) =>
      index === 2 ? { ...entry, gender: 'unspecified' as Gender } : entry,
    );

    expect(() => createSession(mixicanoConfig({ players }))).toThrow(/unknown gender/i);
  });

  it('leaves Americano free to schedule a roster with no genders on it', () => {
    // The field is Mixicano's, and Americano neither needs it nor is refused for lacking it.
    const session = createSession(americanoConfig({ roundCount: 4 }));

    expect(session.roster.every((entry) => entry.gender === undefined)).toBe(true);

    assertSessionValid(generateRemaining(session));
  });

  it('keeps a gender it was given even where the mode has no use for it', () => {
    // A roster carried over from a Mixicano session, or one the app collects up front whatever
    // the mode: the entries are stored as they came, because dropping a field on the way in is
    // how a session comes back from storage different from the one that was saved.
    const session = createSession(mixicanoConfig({ mode: 'americano' }));

    expect(session.roster.map((entry) => entry.gender)).toEqual(
      mixedRoster(4, 4).map((entry) => entry.gender),
    );

    assertSessionValid(generateRemaining(session));
  });
});

describe('generateRemaining — Mixicano on an even split', () => {
  it('mixes every pair when the roster divides evenly', () => {
    const session = scheduledSplit(4, 4, 2, 5);

    expect(sameGenderPairs(session).flat()).toEqual([]);

    assertSessionValid(session);
  });

  it('mixes every pair on three courts too', () => {
    const session = scheduledSplit(6, 6, 3, 6);

    expect(sameGenderPairs(session).flat()).toEqual([]);

    assertSessionValid(session);
  });

  it('keeps partnering across the roster once every eligible partner has been played', () => {
    // Four women and four men: every woman has partnered every man after four rounds, so rounds
    // five and six have to repeat — which they may, because a repeat is only unfair while an
    // eligible partner is unplayed, and in Mixicano the same gender is never eligible.
    const session = scheduledSplit(4, 4, 2, 6);

    expect(sameGenderPairs(session).flat()).toEqual([]);

    assertSessionValid(session);
  });
});

describe('generateRemaining — Mixicano on an unequal split', () => {
  it('fills the courts with mixed pairs first and leaves the surplus same-gender', () => {
    // Seven women and three men on two courts: eight on court, two benched.
    const session = scheduledSplit(7, 3, 2, 8);
    const gender = genderOf(session);

    session.rounds.forEach((round, index) => {
      const mixed = pairs(session)[index].filter(([a, b]) => gender(a) !== gender(b));

      expect(round.matches).toHaveLength(2);
      expect(mixed.length + sameGenderPairs(session)[index].length).toBe(4);
      expect(sameGenderPairs(session)[index]).toHaveLength(forcedInRound(session, index));
    });

    assertSessionValid(session);
  });

  it('never makes more same-gender pairs than the arithmetic forces', () => {
    for (const [women, men, courts] of [
      [7, 3, 2],
      [5, 3, 2],
      [6, 2, 2],
      [9, 3, 3],
      [5, 1, 1],
      [10, 2, 2],
    ] as const) {
      const session = scheduledSplit(women, men, courts, 8, `session-${women}w${men}m`);

      session.rounds.forEach((_, index) => {
        expect(sameGenderPairs(session)[index]).toHaveLength(forcedInRound(session, index));
      });

      assertSessionValid(session);
    }
  });

  it('benches whoever mixes best, over every bench the fairness rule allows', () => {
    // The strongest reading of the ticket: not merely as few same-gender pairs as the players on
    // court force, but as few as any bench-fair round could have forced. The oracle re-derives
    // that minimum from the roster; the engine has to match it every round.
    for (const [women, men, courts, rounds] of [
      [7, 3, 2, 10],
      [5, 3, 2, 8],
      [6, 2, 2, 8],
      [9, 1, 2, 8],
      [9, 3, 3, 8],
    ] as const) {
      const session = scheduledSplit(women, men, courts, rounds, `bench-${women}w${men}m`);
      const benched = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));

      session.rounds.forEach((round, index) => {
        expect(sameGenderPairs(session)[index]).toHaveLength(fewestPossible(session, benched));

        const onCourt = new Set(round.matches.flatMap((match) => [...match.sideA, ...match.sideB]));
        for (const entry of session.roster) {
          if (!onCourt.has(entry.id)) {
            benched.set(entry.id, (benched.get(entry.id) ?? 0) + 1);
          }
        }
      });

      assertSessionValid(session);
    }
  });

  it('spends the bench on mixing while the bench is free to choose', () => {
    // Seven women and three men bench two, and in round one nobody has sat out yet, so which two
    // is entirely free. Benching two women leaves five and three on court and one same-gender
    // pair; benching one of the three men would leave two and force two pairs.
    const session = scheduledSplit(7, 3, 2, 8);

    expect(sameGenderPairs(session)[0]).toHaveLength(1);

    // Later rounds are not held to that number, and deliberately so: bench fairness is
    // structural and is never traded for mixing (decision #7 makes the gender term a cost, not a
    // constraint). By round five the only two players still owed a bench may both be men, and
    // then a round of seven women and one man is what the evening has to schedule.
    session.rounds.forEach((_, index) => {
      expect(sameGenderPairs(session)[index]).toHaveLength(forcedInRound(session, index));
    });

    assertSessionValid(session);
  });

  it('rotates the compromise instead of concentrating it on the same players', () => {
    const session = scheduledSplit(7, 3, 2, 14);
    const totals = compromisesByPrefix(session).at(-1) ?? new Map<PlayerId, number>();
    const women = session.roster.filter((entry) => entry.gender === 'woman');
    const counts = women.map((entry) => totals.get(entry.id) ?? 0);

    // Every woman carries a share, and no woman carries a materially larger one. The counts do
    // not land dead level, because the rounds are not all the same shape: bench fairness
    // sometimes puts seven women and one man on court, and that round compromises six of them.
    // What the ticket rules out is two women being the ones compromised every single round.
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);

    assertSessionValid(session);
  });

  it('compromises the least-compromised players on court, at every round', () => {
    // The rotation rule itself, restated from the roster rather than asked of the engine: nobody
    // is put in a same-gender pair while a player of their gender is on court, out of one, and
    // has been in fewer. That player could have taken their place — within a gender the surplus
    // is interchangeable — so this holding round after round is what rotation means.
    for (const session of [scheduledSplit(7, 3, 2, 14), scheduledSplit(9, 1, 2, 10)]) {
      const gender = genderOf(session);
      const before = [new Map<PlayerId, number>(), ...compromisesByPrefix(session)];

      session.rounds.forEach((round, index) => {
        const carried = new Set(sameGenderPairs(session)[index].flat());
        const playing = round.matches.flatMap((match) => [...match.sideA, ...match.sideB]);
        const burden = (id: PlayerId): number => before[index].get(id) ?? 0;

        for (const id of carried) {
          const spared = playing.filter(
            (other) =>
              !carried.has(other) && gender(other) === gender(id) && burden(other) < burden(id),
          );

          expect(spared).toEqual([]);
        }
      });

      assertSessionValid(session);
    }
  });

  it('schedules a roster with a single player of one gender', () => {
    // The degenerate case: one man among nine women. Every round he plays is one mixed pair and
    // the rest same-gender, and the evening still has to run.
    const session = scheduledSplit(9, 1, 2, 10);

    session.rounds.forEach((round, index) => {
      expect(round.matches).toHaveLength(2);
      expect(sameGenderPairs(session)[index]).toHaveLength(forcedInRound(session, index));
    });

    assertSessionValid(session);
  });

  it('schedules a roster with nobody of one gender at all', () => {
    const session = scheduledSplit(8, 0, 2, 6);

    session.rounds.forEach((_, index) => {
      expect(sameGenderPairs(session)[index]).toHaveLength(4);
    });

    assertSessionValid(session);
  });

  it('keeps bench counts within one of each other while it does it', () => {
    const session = scheduledSplit(7, 3, 2, 11);
    const benched = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));

    for (const round of session.rounds) {
      const onCourt = new Set(round.matches.flatMap((match) => [...match.sideA, ...match.sideB]));
      for (const entry of session.roster) {
        if (!onCourt.has(entry.id)) {
          benched.set(entry.id, (benched.get(entry.id) ?? 0) + 1);
        }
      }

      const counts = [...benched.values()];
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }

    assertSessionValid(session);
  });
});

describe('Mixicano — marking the compromise', () => {
  it('names the sides that had to be paired same-gender', () => {
    const session = scheduledSplit(7, 3, 2, 6);
    const gender = genderOf(session);

    for (const round of session.rounds) {
      for (const match of round.matches) {
        const marked = sameGenderSides(session, match);

        expect(marked.includes('A')).toBe(gender(match.sideA[0]) === gender(match.sideA[1]));
        expect(marked.includes('B')).toBe(gender(match.sideB[0]) === gender(match.sideB[1]));
      }
    }
  });

  it('marks nothing when every pair is mixed, and nothing at all in Americano', () => {
    const mixicano = scheduledSplit(4, 4, 2, 5);
    const americano = scheduled(mixicanoConfig({ mode: 'americano', roundCount: 5 }));

    for (const session of [mixicano, americano]) {
      for (const round of session.rounds) {
        for (const match of round.matches) {
          expect(sameGenderSides(session, match)).toEqual([]);
        }
      }
    }
  });

  it('shows the mark in the printout, with a line saying what it means', () => {
    const printed = formatSchedule(scheduledSplit(7, 3, 2, 3));

    expect(printed).toContain('* same-gender pair');
  });
});

describe('Mixicano — a roster that moves', () => {
  it('takes a late arrival with a gender and reschedules around them', () => {
    const session = scheduledSplit(4, 4, 2, 6);
    const grown = addPlayer(session, { id: 'late', name: 'Rita', gender: 'woman' });

    expect(grown.roster.find((entry) => entry.id === 'late')?.gender).toBe('woman');

    assertSessionValid(grown);
  });

  it('refuses a late arrival with no gender', () => {
    const session = scheduledSplit(4, 4, 2, 6);

    expect(() => addPlayer(session, { id: 'late', name: 'Rita' })).toThrow(
      /Mixicano needs a gender on every roster entry/,
    );
  });
});
