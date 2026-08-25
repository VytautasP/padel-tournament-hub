import { assertSessionValid, createSession, generateRemaining } from './public-api';
import type { PlayerId, Session, SessionConfig } from './public-api';
import { americanoConfig } from './test-support/session-fixtures';

/** Every partnership in the session, as a `"a|b"` key with the ids in a stable order. */
function partnerships(session: Session): string[] {
  return session.rounds.flatMap((round) =>
    round.matches.flatMap((match) =>
      [match.sideA, match.sideB].map((side) => [...side].sort().join('|')),
    ),
  );
}

/** Everyone scheduled in a round, one entry per appearance — so double-booking shows up. */
function appearances(session: Session, roundIndex: number): PlayerId[] {
  return session.rounds[roundIndex].matches.flatMap((match) => [...match.sideA, ...match.sideB]);
}

function scheduled(config: SessionConfig): Session {
  return generateRemaining(createSession(config));
}

describe('generateRemaining — exact-fit Americano', () => {
  it.each([
    { courtCount: 1, players: 4 },
    { courtCount: 2, players: 8 },
    { courtCount: 3, players: 12 },
  ])('fills every unplayed round for $players players on $courtCount courts', ({ courtCount }) => {
    const session = scheduled(americanoConfig({ courtCount, roundCount: 5 }));

    expect(session.rounds).toHaveLength(5);
    for (const round of session.rounds) {
      expect(round.matches).toHaveLength(courtCount);
      expect(round.matches.map((match) => match.courtNumber)).toEqual(
        Array.from({ length: courtCount }, (_, index) => index + 1),
      );
    }

    assertSessionValid(session);
  });

  it('gives every match exactly four distinct players', () => {
    const session = scheduled(americanoConfig({ courtCount: 3, roundCount: 6 }));

    for (const round of session.rounds) {
      for (const match of round.matches) {
        const players = [...match.sideA, ...match.sideB];
        expect(new Set(players).size).toBe(4);
      }
    }

    assertSessionValid(session);
  });

  it('never schedules a player on two courts in the same round', () => {
    const session = scheduled(americanoConfig({ courtCount: 3, roundCount: 6 }));

    for (let index = 0; index < session.rounds.length; index++) {
      const played = appearances(session, index);

      expect(played).toHaveLength(12);
      expect(new Set(played).size).toBe(12);
    }

    assertSessionValid(session);
  });

  it('benches nobody when the roster fills every court', () => {
    const session = scheduled(americanoConfig({ courtCount: 2, roundCount: 4 }));
    const everyone = session.roster.map((entry) => entry.id);

    for (let index = 0; index < session.rounds.length; index++) {
      expect(new Set(appearances(session, index))).toEqual(new Set(everyone));
    }

    assertSessionValid(session);
  });

  it('varies partners — 8 players over 7 rounds partner everyone exactly once', () => {
    const session = scheduled(americanoConfig({ courtCount: 2, roundCount: 7 }));
    const pairs = partnerships(session);

    // C(8,2) = 28 partnerships, and 7 rounds of 4 pairs is exactly 28 slots.
    expect(pairs).toHaveLength(28);
    expect(new Set(pairs).size).toBe(28);

    assertSessionValid(session);
  });

  it('repeats a partnership only once no unplayed partner is left', () => {
    const session = scheduled(americanoConfig({ courtCount: 2, roundCount: 9 }));
    const counts = new Map<string, number>();
    for (const pair of partnerships(session)) {
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }

    // Nine rounds is two past a complete rotation, so every partnership has been played
    // before any is played a third time.
    expect(new Set(counts.keys()).size).toBe(28);
    expect(Math.max(...counts.values())).toBe(2);

    assertSessionValid(session);
  });

  it('schedules a known roster exactly this way, run after run', () => {
    // Pinned expectations, not a self-comparison: two sessions built in one process would agree
    // even if the seed were drawn once at module load. This fails the moment anything but the
    // session's own data reaches the scheduler.
    const session = scheduled(americanoConfig({ id: 'friday', courtCount: 1, roundCount: 3 }));

    expect(
      session.rounds.map((round) =>
        round.matches.map((match) => `${match.sideA.join('+')} v ${match.sideB.join('+')}`),
      ),
    ).toEqual([['p2+p3 v p4+p1'], ['p2+p4 v p1+p3'], ['p2+p1 v p3+p4']]);

    assertSessionValid(session);
  });

  it('is deterministic — the same input yields an identical schedule', () => {
    const first = scheduled(americanoConfig({ courtCount: 3, roundCount: 8 }));
    const second = scheduled(americanoConfig({ courtCount: 3, roundCount: 8 }));

    expect(second).toEqual(first);

    assertSessionValid(second);
  });

  it('leaves already-generated rounds byte-identical when run again', () => {
    const session = scheduled(americanoConfig({ courtCount: 2, roundCount: 6 }));

    expect(generateRemaining(session)).toEqual(session);

    assertSessionValid(session);
  });

  it('fills the unplayed rounds of a part-generated session and leaves the played ones alone', () => {
    const played = scheduled(americanoConfig({ courtCount: 2, roundCount: 6 }));
    // A session as it comes back from storage mid-evening: two rounds played, four still to fill.
    const partGenerated = {
      ...played,
      rounds: played.rounds.map((round, index) => (index < 2 ? round : { ...round, matches: [] })),
    };

    const session = generateRemaining(partGenerated);

    expect(session.rounds.slice(0, 2)).toEqual(played.rounds.slice(0, 2));
    expect(session.rounds.every((round) => round.matches.length === 2)).toBe(true);

    assertSessionValid(session);
  });

  it('is fair at every round it might stop at, not only at the last one', () => {
    const played = scheduled(americanoConfig({ courtCount: 2, roundCount: 9 }));

    // The evening can end whenever the court time does, so every prefix has to stand on its own.
    for (let stopAfter = 1; stopAfter <= played.rounds.length; stopAfter++) {
      const cutShort = { ...played, rounds: played.rounds.slice(0, stopAfter) };

      expect(() => assertSessionValid(cutShort)).not.toThrow();
    }

    assertSessionValid(played);
  });

  it('leaves the arrays of a session it was handed alone', () => {
    const played = scheduled(americanoConfig({ courtCount: 2, roundCount: 3 }));
    // An app-built session owns its own arrays; the engine may not freeze them out from under it.
    const caller = {
      ...played,
      roster: played.roster.map((entry) => ({ ...entry })),
      rounds: played.rounds.map((round) => ({ ...round, matches: [] })),
    };

    const session = generateRemaining(caller);

    expect(Object.isFrozen(caller.roster)).toBe(false);
    expect(() => caller.roster.push({ id: 'p9', name: 'Late' })).not.toThrow();

    assertSessionValid(session);
  });

  it('returns a new session and mutates neither the input nor its rounds', () => {
    const created = createSession(americanoConfig({ roundCount: 4 }));
    const before = structuredClone(created);

    const generated = generateRemaining(created);

    expect(generated).not.toBe(created);
    expect(created).toEqual(before);
    expect(created.rounds.every((round) => round.matches.length === 0)).toBe(true);

    assertSessionValid(generated);
  });

  it('gives every match a unique id', () => {
    const session = scheduled(americanoConfig({ courtCount: 3, roundCount: 5 }));
    const ids = session.rounds.flatMap((round) => round.matches.map((match) => match.id));

    expect(ids).toHaveLength(15);
    expect(new Set(ids).size).toBe(15);

    assertSessionValid(session);
  });

  it('refers to players by id only — every scheduled id is a roster id', () => {
    const session = scheduled(americanoConfig({ courtCount: 2, roundCount: 5 }));
    const rosterIds = new Set(session.roster.map((entry) => entry.id));
    const played = session.rounds.flatMap((_, index) => appearances(session, index));

    expect(played.every((id) => rosterIds.has(id))).toBe(true);

    assertSessionValid(session);
  });
});
