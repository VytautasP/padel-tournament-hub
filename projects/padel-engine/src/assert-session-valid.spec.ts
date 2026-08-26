import { assertSessionValid, createSession, finishSession, generateRemaining } from './public-api';
import type { PlayerId, Session } from './public-api';
import { damaged } from './test-support/damaged-session';
import type { MutableMatch, MutableSession } from './test-support/damaged-session';
import { mixedRoster, mixicanoConfig } from './test-support/mixicano-fixtures';
import { americanoConfig, roster } from './test-support/session-fixtures';

function valid(): Session {
  return generateRemaining(createSession(americanoConfig({ courtCount: 2, roundCount: 6 })));
}

/** Nine players on two courts: one sits out each round, so eight of nine still staff both. */
function benched(): Session {
  return generateRemaining(
    createSession(americanoConfig({ players: roster(9), courtCount: 2, roundCount: 6 })),
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
function womenOf(copy: MutableSession): Set<PlayerId> {
  return new Set(copy.roster.filter((entry) => entry.gender === 'woman').map((entry) => entry.id));
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

describe('assertSessionValid — Mixicano', () => {
  it('accepts a generated Mixicano session, evenly split or not', () => {
    for (const session of [evenlyMixed(), unevenlyMixed()]) {
      expect(() => assertSessionValid(session)).not.toThrow();
    }
  });

  it('rejects a same-gender pair the roster did not force', () => {
    // Four women and four men pair cleanly. Trading two players of the same gender across the net
    // on court one leaves the same eight players on the same two courts, and two pairs that did
    // not have to exist.
    const session = damaged(evenlyMixed(), (copy) => {
      const women = womenOf(copy);
      const [sideA, sideB] = sidesOf(copy.rounds[0]);
      const swappable = sideB.findIndex((id) => women.has(id) === women.has(sideA[1]));
      const moving = sideB[swappable];

      sideB[swappable] = sideA[0];
      sideA[0] = moving;
    });

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
