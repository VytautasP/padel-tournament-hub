import {
  addRound,
  assertSessionValid,
  createSession,
  finishSession,
  generateRemaining,
} from './public-api';
import type { PlayerId, Session } from './public-api';
import { damaged } from './test-support/damaged-session';
import type { MutableMatch, MutableSession } from './test-support/damaged-session';
import { mixedRoster, mixicanoConfig } from './test-support/mixicano-fixtures';
import { americanoConfig, roster, scoredThrough } from './test-support/session-fixtures';

function valid(): Session {
  return generateRemaining(createSession(americanoConfig({ courtCount: 2, roundCount: 6 })));
}

/** Nine players on two courts: one sits out each round, so eight of nine still staff both. */
function benched(): Session {
  return generateRemaining(
    createSession(americanoConfig({ players: roster(9), courtCount: 2, roundCount: 6 })),
  );
}

/** A session with one round generated and the rest still empty slots. */
function ungenerated(): Session {
  return addRound(
    generateRemaining(createSession(americanoConfig({ courtCount: 2, roundCount: 1 }))),
  );
}

/** Clone a valid session, break it in one specific way, and hand it back for validation. */
function broken(damage: (copy: MutableSession) => void): Session {
  return damaged(valid(), damage);
}

describe('assertSessionValid', () => {
  it('accepts a generated session', () => {
    const session = valid();

    expect(() => assertSessionValid(session)).not.toThrow();

    assertSessionValid(session);
  });

  it('accepts a finished session', () => {
    // Finishing closes a session to changes, not to reading: the referee still has to answer.
    const session = finishSession(valid());

    expect(() => assertSessionValid(session)).not.toThrow();

    assertSessionValid(session);
  });

  it('rejects a status the engine never sets', () => {
    const session = broken((copy) => {
      copy.status = 'abandoned';
    });

    expect(() => assertSessionValid(session)).toThrow(/status "abandoned"/);

    assertSessionValid(valid());
  });

  it('rejects a player scheduled on two courts in the same round', () => {
    const session = broken((copy) => {
      const [first, second] = copy.rounds[0].matches;
      second.sideA = [first.sideA[0], second.sideA[1]];
    });

    expect(() => assertSessionValid(session)).toThrow(/two courts/i);

    assertSessionValid(valid());
  });

  it('rejects a match without four distinct players', () => {
    const session = broken((copy) => {
      const match = copy.rounds[0].matches[0];
      match.sideB = [match.sideA[0], match.sideB[1]];
    });

    expect(() => assertSessionValid(session)).toThrow(/four distinct players/i);

    assertSessionValid(valid());
  });

  it('rejects a match referring to a player who is not on the roster', () => {
    const session = broken((copy) => {
      const match = copy.rounds[0].matches[0];
      match.sideA = ['ghost', match.sideA[1]];
    });

    expect(() => assertSessionValid(session)).toThrow(/not on the roster/i);

    assertSessionValid(valid());
  });

  it('rejects a partnership repeated while an unplayed partner remains', () => {
    const session = broken((copy) => {
      copy.rounds[1].matches = copy.rounds[0].matches.map((match) => ({
        ...match,
        id: `${match.id}-copy`,
      }));
    });

    expect(() => assertSessionValid(session)).toThrow(/partner/i);

    assertSessionValid(valid());
  });

  it('rejects a round that does not use every court', () => {
    const session = broken((copy) => {
      copy.rounds[0].matches = copy.rounds[0].matches.slice(0, 1);
    });

    expect(() => assertSessionValid(session)).toThrow(/court/i);

    assertSessionValid(valid());
  });

  it('rejects a generated round that follows an ungenerated one', () => {
    const session = broken((copy) => {
      copy.rounds[0].matches = [];
    });

    expect(() => assertSessionValid(session)).toThrow(/ungenerated/i);

    assertSessionValid(valid());
  });

  it('rejects a roster too small to fill a single court', () => {
    const session = broken((copy) => {
      copy.roster = copy.roster.slice(0, 3);
    });

    expect(() => assertSessionValid(session)).toThrow(/at least 4 players/);

    assertSessionValid(valid());
  });

  it('rejects a round that fills more courts than the roster can staff', () => {
    // Four players left of eight: one court is in play, so a second match is a player short
    // however its ids are arranged.
    const session = broken((copy) => {
      copy.roster = copy.roster.slice(0, 4);
    });

    expect(() => assertSessionValid(session)).toThrow(/fills 2 of 1 court/);

    assertSessionValid(valid());
  });

  it('rejects a match scheduling someone who had not arrived yet', () => {
    // Nine players on two courts, so closing one player's window still leaves both courts
    // staffed: the round is the right size, and the only thing wrong with it is who is on it.
    const session = damaged(benched(), (copy) => {
      copy.roster[0].joinedAtRound = 3;
    });

    expect(() => assertSessionValid(session)).toThrow(/not in the session for round [12]/);

    assertSessionValid(benched());
  });

  it('rejects a match scheduling someone who had already left', () => {
    const session = damaged(benched(), (copy) => {
      copy.roster[0].leftAfterRound = 2;
    });

    expect(() => assertSessionValid(session)).toThrow(/not in the session for round 3/);

    assertSessionValid(benched());
  });

  it('rejects an availability window that closes before it opens', () => {
    const session = broken((copy) => {
      copy.roster[0].joinedAtRound = 4;
      copy.roster[0].leftAfterRound = 2;
    });

    expect(() => assertSessionValid(session)).toThrow(/leaves before it joins/);

    assertSessionValid(valid());
  });

  it('rejects a round left without the players to fill a court', () => {
    // Five of the eight go home after round 2, so round 3 has nobody to schedule.
    const session = broken((copy) => {
      for (const entry of copy.roster.slice(0, 5)) {
        entry.leftAfterRound = 2;
      }
    });

    expect(() => assertSessionValid(session)).toThrow(/Round 3 has 3 player\(s\) available/);

    assertSessionValid(valid());
  });

  it('rejects a session with no id', () => {
    const session = broken((copy) => {
      copy.id = '  ';
    });

    expect(() => assertSessionValid(session)).toThrow(/needs an id/);

    assertSessionValid(valid());
  });

  it('rejects duplicate match ids', () => {
    const session = broken((copy) => {
      copy.rounds[1].matches[0].id = copy.rounds[0].matches[0].id;
    });

    expect(() => assertSessionValid(session)).toThrow(/duplicate match id/i);

    assertSessionValid(valid());
  });

  it('accepts a compensation flag on a session that has an abandoned round to pay for', () => {
    const session = broken((copy) => {
      copy.status = 'finished';
      copy.compensatedUnplayed = true;
    });

    expect(() => assertSessionValid(session)).not.toThrow();

    assertSessionValid(valid());
  });

  it('rejects a compensation flag on a session with nothing to compensate', () => {
    // A promise the document cannot keep (ADR-0037 §7): every generated round is scored, so
    // the flag pays nobody and says the evening owes somebody something.
    const session = damaged(scoredThrough(valid()), (copy) => {
      copy.status = 'finished';
      copy.compensatedUnplayed = true;
    });

    expect(() => assertSessionValid(session)).toThrow(/nothing to compensate/);

    assertSessionValid(scoredThrough(valid()));
  });

  it('rejects a compensation flag on a session whose only unplayed rounds are ungenerated', () => {
    // A round slot is a number in a form field, not a fixture, so it is not abandoned and does
    // not rescue the flag (ADR-0037 §2).
    const session = damaged(scoredThrough(ungenerated()), (copy) => {
      copy.status = 'finished';
      copy.compensatedUnplayed = true;
    });

    expect(() => assertSessionValid(session)).toThrow(/nothing to compensate/);
  });
});

/*
 * The Mixicano branches, damaged one at a time.
 *
 * Both rules the referee adds are about a choice the scheduler made — how many same-gender pairs
 * it formed, and which players it asked to carry them — so neither can be provoked by a session
 * the engine builds. Each test therefore takes a valid one and rearranges the players on court,
 * leaving everyone in the same round they were already in so that the bench spread it is checked
 * against first stays untouched.
 */

/** An even split on two courts: nothing forces a same-gender pair, so any of them is one too many. */
function evenlyMixed(): Session {
  return generateRemaining(
    createSession(mixicanoConfig({ players: mixedRoster(4, 4), courtCount: 2, roundCount: 5 })),
  );
}

/** Seven women and three men: one same-gender pair a round, and seven women to spread it over. */
function unevenlyMixed(): Session {
  return generateRemaining(
    createSession(mixicanoConfig({ players: mixedRoster(7, 3), courtCount: 2, roundCount: 6 })),
  );
}

/** The ids the roster calls women — read off the document, not asked of the engine. */
function womenOf(session: GenderedRoster): Set<PlayerId> {
  return new Set(
    session.roster.filter((entry) => entry.gender === 'woman').map((entry) => entry.id),
  );
}

/**
 * A document with genders on it, damaged or not.
 *
 * `MutableSession` widens `gender` to `string` so a test can write one the engine never sets, and a
 * `Session` narrows it to the two the engine knows. The question every helper below asks — which
 * of these ids are women — is the same either way, so it is asked of the shape they share.
 */
interface GenderedRoster {
  readonly roster: readonly { readonly id: string; readonly gender?: string }[];
}

/** Every side of a round, so a test can find the compromised pair or a mixed one. */
function sidesOf(round: { matches: MutableMatch[] }): [PlayerId, PlayerId][] {
  return round.matches.flatMap((match) => [match.sideA, match.sideB]);
}

/** Put `arriving` wherever `leaving` is standing in this round. */
function substitute(
  round: { matches: MutableMatch[] },
  leaving: PlayerId,
  arriving: PlayerId,
): void {
  for (const side of sidesOf(round)) {
    const index = side.indexOf(leaving);
    if (index !== -1) {
      side[index] = arriving;
    }
  }
}

/**
 * Make two pairs same-gender that had no need to be, by trading a woman on one mixed side of
 * round one for a man on another.
 *
 * Everybody stays in the round they were already in and on a court, so the bench has not moved and
 * the genders on court are exactly what they were — the only thing that differs is how they were
 * paired up, which is the one choice both pairing clauses are about. Two more same-gender pairs
 * than the round had is one too many under hybrid fill whatever its roster forced, and any at all
 * is one too many under strict mixing.
 */
function pairTwoTogether(copy: MutableSession): void {
  const women = womenOf(copy);
  const mixed = sidesOf(copy.rounds[0]).filter((side) => women.has(side[0]) !== women.has(side[1]));
  const [one, other] = mixed;

  if (one === undefined || other === undefined) {
    throw new Error('The fixture no longer sets this scenario up.');
  }

  const hers = one.findIndex((id) => women.has(id));
  const his = other.findIndex((id) => !women.has(id));
  const moving = one[hers];

  one[hers] = other[his];
  other[his] = moving;
}

/** The first side of a round that holds two players of one gender, read off the document. */
function firstSameGenderSide(session: Session): readonly PlayerId[] {
  const women = womenOf(session);
  const side = session.rounds[0].matches
    .flatMap((match) => [match.sideA, match.sideB])
    .find((pair) => women.has(pair[0]) === women.has(pair[1]));

  if (side === undefined) {
    throw new Error('The fixture no longer sets this scenario up.');
  }

  return side;
}

/** Everyone available who is not on court in this round, read off the document. */
function benchOf(copy: MutableSession, roundIndex: number): PlayerId[] {
  const onCourt = new Set(sidesOf(copy.rounds[roundIndex]).flat());

  return copy.roster.map((entry) => entry.id).filter((id) => !onCourt.has(id));
}

/**
 * Make whoever sat out round one sit out round two as well, by swapping them for someone of their
 * own gender who sat round two.
 *
 * Staying inside one gender is what makes this a bench fault and nothing else: the courts hold the
 * same number of women and men they held, so every pairing rule above and below the spread check
 * answers exactly as it did before the damage.
 */
function benchTwiceRunning(copy: MutableSession): void {
  const women = womenOf(copy);
  const first = benchOf(copy, 0);
  const second = benchOf(copy, 1);

  const stepsOut = first.find((id) => !second.includes(id));
  const stepsIn =
    stepsOut === undefined
      ? undefined
      : second.find((id) => !first.includes(id) && women.has(id) === women.has(stepsOut));

  if (stepsOut === undefined || stepsIn === undefined) {
    throw new Error('The fixture no longer sets this scenario up.');
  }

  substitute(copy.rounds[1], stepsOut, stepsIn);
}

describe('assertSessionValid — Mixicano', () => {
  it('accepts a generated Mixicano session, evenly split or not', () => {
    for (const session of [evenlyMixed(), unevenlyMixed()]) {
      expect(() => assertSessionValid(session)).not.toThrow();
    }
  });

  it('rejects a same-gender pair the roster did not force', () => {
    // Four women and four men pair cleanly, so every pair the round made was a choice. Trading one
    // of them across the net leaves the same eight players on the same two courts, benched exactly
    // as they were, and two pairs that did not have to exist.
    const session = damaged(evenlyMixed(), pairTwoTogether);

    expect(() => assertSessionValid(session)).toThrow(/same-gender pair\(s\) where 0 is forced/);

    assertSessionValid(evenlyMixed());
  });

  it('rejects a compromise handed to a player who has already carried more of them', () => {
    // Seven women and three men compromise somebody every round, and the referee's rule is that
    // it is whoever has carried least. So the damage is a swap between two women on court in the
    // same round: the one in the same-gender pair steps out, and one who has carried more steps
    // in. It is invisible to every other check — the same players are on the same courts, the
    // bench has not moved, and the number of same-gender pairs is exactly what it was.
    const valid = unevenlyMixed();
    const session = damaged(valid, (copy) => {
      const women = womenOf(copy);
      const carried = new Map<PlayerId, number>();
      const burden = (id: PlayerId): number => carried.get(id) ?? 0;

      for (const round of copy.rounds) {
        const sides = sidesOf(round);
        const compromised = sides.filter((side) => women.has(side[0]) && women.has(side[1]));
        const inAPair = new Set(compromised.flat());
        const stepsOut = compromised.flat().sort((a, b) => burden(a) - burden(b))[0];
        const stepsIn = sides
          .flat()
          .find((id) => women.has(id) && !inAPair.has(id) && burden(id) > burden(stepsOut));

        if (stepsIn !== undefined) {
          substitute(round, stepsOut, 'placeholder');
          substitute(round, stepsIn, stepsOut);
          substitute(round, 'placeholder', stepsIn);

          return;
        }

        for (const id of inAPair) {
          carried.set(id, burden(id) + 1);
        }
      }

      throw new Error('The fixture no longer sets this scenario up.');
    });

    expect(() => assertSessionValid(session)).toThrow(/same-gender pair for the \d+ time\(s\)/);

    assertSessionValid(valid);
  });

  it('rejects a Mixicano roster entry with no gender on it', () => {
    const session = damaged(evenlyMixed(), (copy) => {
      delete copy.roster[2].gender;
    });

    expect(() => assertSessionValid(session)).toThrow(/needs a gender on every roster entry/);

    assertSessionValid(evenlyMixed());
  });
});

/*
 * The strict branch, damaged the same way.
 *
 * Strictness changes two of the referee's questions and no others (ADR-0036). Where hybrid fill
 * asks whether a round made more same-gender pairs than its players forced, strictness asks
 * whether it made any at all; and where hybrid fill asks whether the bench is level across the
 * roster, strictness asks it inside each gender, because three men among seven women are on court
 * every round by arithmetic rather than by favour.
 *
 * So each test below pairs a damaged strict session with the hybrid session built from the same
 * roster, and the hybrid one has to answer exactly as it always has.
 */

/** A generated strict Mixicano, which is what every test below damages. */
function strict(women: number, men: number, courtCount: number, roundCount: number): Session {
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

/** A strict Mixicano on an even split: every pair mixes, so any same-gender pair is a fault. */
function strictlyMixed(): Session {
  return strict(4, 4, 2, 5);
}

/**
 * Seven women and three men on one court — the roster the per-gender bench queue exists for.
 *
 * The three men are on court every round and the women sit five in six, so the spread across the
 * roster runs away while the spread inside each gender stays at one. One court rather than two
 * deliberately: it is the count hybrid fill and strict mixing both arrive at for this roster
 * (`min(1, ...)` either way), which is what lets the same document be judged under either rule.
 */
function skewed(): Session {
  return strict(7, 3, 1, 6);
}

/**
 * Hybrid fill on a roster strictness would play one court of.
 *
 * `writesTheFlag` is the ADR-0036 §7 distinction and not the choice itself: both sessions play by
 * hybrid fill, and they differ only in whether the document says so out loud or is old enough to
 * have been written before there was anything to say.
 */
function hybridlyMixed(writesTheFlag: boolean): Session {
  const config = mixicanoConfig({ players: mixedRoster(7, 3), courtCount: 2, roundCount: 6 });

  return generateRemaining(
    createSession(writesTheFlag ? { ...config, strictMixing: false } : config),
  );
}

/** Both ways a session can be playing by hybrid fill, which must be judged identically. */
const EITHER_WAY_HYBRID = [
  { what: 'carrying the flag', writesTheFlag: true },
  { what: 'carrying no flag at all', writesTheFlag: false },
] as const;

/**
 * Bench a woman for the second round running while another plays both.
 *
 * Aimed at `skewed()`, where the roster-wide spread is already far past one and legal, so the only
 * thing this can provoke is the spread *inside* the women's queue. The men are not touched and the
 * courts hold the players they held, which is what leaves the per-gender clause as the one
 * remaining explanation for a refusal.
 */
function benchAWomanOutOfTurn(copy: MutableSession): void {
  const women = womenOf(copy);
  const firstBench = benchOf(copy, 0);

  // A woman who sat round one and is back on court in round two: sit her again, for two.
  const stepsOut = sidesOf(copy.rounds[1])
    .flat()
    .find((id) => women.has(id) && firstBench.includes(id));
  // A woman who played round one and is benched in round two: play her again, for none.
  const stepsIn = benchOf(copy, 1).find((id) => women.has(id) && !firstBench.includes(id));

  if (stepsOut === undefined || stepsIn === undefined) {
    throw new Error('The fixture no longer sets this scenario up.');
  }

  substitute(copy.rounds[1], stepsOut, stepsIn);
}

describe('assertSessionValid — strict Mixicano', () => {
  it('accepts a generated strict session, and one that benches a whole gender unevenly', () => {
    // The second is the point of the per-gender queue, and half of the pair that proves it: this
    // session's bench counts differ by far more than one across the roster, and the referee takes
    // it anyway. The other half is the refusal two tests down, on this same fixture.
    for (const session of [strictlyMixed(), skewed()]) {
      expect(() => assertSessionValid(session)).not.toThrow();
    }
  });

  it('rejects a same-gender pair, naming the round and the two players', () => {
    const session = damaged(strictlyMixed(), pairTwoTogether);
    const names = new Map(session.roster.map((entry) => [entry.id, entry.name]));
    const [first, second] = firstSameGenderSide(session);

    expect(() => assertSessionValid(session)).toThrow(
      new RegExp(`Round 1 pairs ${names.get(first)} with ${names.get(second)}.*mixes strictly`),
    );

    assertSessionValid(strictlyMixed());
  });

  it('rejects a same-gender pair even where the players on court would have forced one', () => {
    // The clause strictness replaces, and the one damage that tells the two apart. Four of each on
    // one court plays four and sits four, so swapping a benched woman onto the court in a man's
    // place leaves three women and one man on it — a round hybrid fill judges entitled to exactly
    // one same-gender pair, and strict mixing judges entitled to none.
    const oneCourt = mixicanoConfig({ players: mixedRoster(4, 4), courtCount: 1, roundCount: 1 });
    const substituted = (strictMixing: boolean): Session =>
      damaged(generateRemaining(createSession({ ...oneCourt, strictMixing })), (copy) => {
        const women = womenOf(copy);
        const onCourt = new Set(sidesOf(copy.rounds[0]).flat());
        const stepsOut = [...onCourt].find((id) => !women.has(id));
        const stepsIn = benchOf(copy, 0).find((id) => women.has(id));

        if (stepsOut === undefined || stepsIn === undefined) {
          throw new Error('The fixture no longer sets this scenario up.');
        }

        substitute(copy.rounds[0], stepsOut, stepsIn);
      });

    expect(() => assertSessionValid(substituted(true))).toThrow(/same gender.*mixes strictly/);
    expect(() => assertSessionValid(substituted(false))).not.toThrow();
  });

  it('rejects a bench spread of more than one inside a gender, naming the player and the count', () => {
    // The other half of the pair. Nothing about the roster-wide bench has changed — it was already
    // lopsided in the accepted session and it is no worse here — so the women's queue going to two
    // is the only thing left that the refusal can be about.
    const session = damaged(skewed(), benchAWomanOutOfTurn);

    expect(() => assertSessionValid(session)).toThrow(
      /After round 2 bench counts differ by 2 — \w+ has sat out 2 time\(s\)/,
    );

    assertSessionValid(skewed());
  });

  it('asks the same roster the whole-bench question the moment it stops being strict', () => {
    // The clause boundary, drawn on one document. `skewed()` fills one court under either rule, so
    // dropping the flag changes nothing structural — and the evening the strict referee just
    // accepted is refused outright, because hybrid fill compares its three men against its seven
    // women and they have not sat out remotely alike.
    const asHybrid = damaged(skewed(), (copy) => {
      copy.strictMixing = false;
    });

    expect(() => assertSessionValid(asHybrid)).toThrow(/bench counts differ by/);

    assertSessionValid(skewed());
  });
});

describe('assertSessionValid — hybrid fill, judged as it always was', () => {
  it.each(EITHER_WAY_HYBRID)(
    'accepts the same-gender pairs its roster forces, $what',
    ({ writesTheFlag }) => {
      const session = hybridlyMixed(writesTheFlag);

      // Two courts and a same-gender pair in every round of it — the session strictness refuses
      // and hybrid fill is for. A flagless session is one written before the choice existed
      // (ADR-0036 §7), and reads as the rule it was scheduled under.
      expect(session.rounds.every((round) => round.matches.length === 2)).toBe(true);
      expect(() => assertSessionValid(session)).not.toThrow();
    },
  );

  it.each(EITHER_WAY_HYBRID)(
    'still refuses one more pair than the arithmetic forces, $what',
    ({ writesTheFlag }) => {
      const session = damaged(hybridlyMixed(writesTheFlag), pairTwoTogether);

      expect(() => assertSessionValid(session)).toThrow(
        /same-gender pair\(s\) where \d+ is forced/,
      );
    },
  );

  it.each(EITHER_WAY_HYBRID)(
    'still asks the bench question of the whole roster, $what',
    ({ writesTheFlag }) => {
      const session = damaged(hybridlyMixed(writesTheFlag), benchTwiceRunning);

      expect(() => assertSessionValid(session)).toThrow(/bench counts differ by 2/);

      assertSessionValid(hybridlyMixed(writesTheFlag));
    },
  );
});
