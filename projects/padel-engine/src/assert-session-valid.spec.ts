import { assertSessionValid, createSession, generateRemaining } from './public-api';
import type { PlayerId, Session } from './public-api';
import { americanoConfig } from './test-support/session-fixtures';

/** A structural copy of a session that tests are free to damage. */
interface MutableMatch {
  id: string;
  courtNumber: number;
  sideA: [PlayerId, PlayerId];
  sideB: [PlayerId, PlayerId];
}

interface MutableSession extends Omit<Session, 'id' | 'roster' | 'rounds'> {
  id: string;
  roster: { id: string; name: string }[];
  rounds: { id: string; number: number; matches: MutableMatch[] }[];
}

function valid(): Session {
  return generateRemaining(createSession(americanoConfig({ courtCount: 2, roundCount: 6 })));
}

/** Clone a valid session, break it in one specific way, and hand it back for validation. */
function broken(damage: (session: MutableSession) => void): Session {
  const copy = structuredClone(valid()) as unknown as MutableSession;
  damage(copy);
  return copy as unknown as Session;
}

describe('assertSessionValid', () => {
  it('accepts a generated session', () => {
    const session = valid();

    expect(() => assertSessionValid(session)).not.toThrow();

    assertSessionValid(session);
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

  it('rejects a generated round that follows an unplayed one', () => {
    const session = broken((copy) => {
      copy.rounds[0].matches = [];
    });

    expect(() => assertSessionValid(session)).toThrow(/unplayed/i);

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
