import { assertSessionValid, createSession, finishSession, generateRemaining } from './public-api';
import type { Session } from './public-api';
import { damaged } from './test-support/damaged-session';
import type { MutableSession } from './test-support/damaged-session';
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
