import { assertSessionValid, createSession, formatSchedule, generateRemaining } from './public-api';
import type { PlayerId, Session, SessionConfig } from './public-api';
import { americanoConfig, roster } from './test-support/session-fixtures';

function scheduled(config: SessionConfig): Session {
  return generateRemaining(createSession(config));
}

/** A generated session for a roster of any size against any number of courts. */
function scheduledSession(
  players: number,
  courtCount: number,
  roundCount: number,
  id = 'session-1',
): Session {
  return scheduled(americanoConfig({ id, players: roster(players), courtCount, roundCount }));
}

/** Who is scheduled in this round — a Set, so a benched player is simply absent. */
function playing(session: Session, roundIndex: number): Set<PlayerId> {
  return new Set(
    session.rounds[roundIndex].matches.flatMap((match) => [...match.sideA, ...match.sideB]),
  );
}

/** How often each player has sat out after each round: one map per round prefix. */
function benchCountsByPrefix(session: Session): Map<PlayerId, number>[] {
  const counts = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));

  return session.rounds.map((_, index) => {
    const onCourt = playing(session, index);
    for (const entry of session.roster) {
      if (!onCourt.has(entry.id)) {
        counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
      }
    }

    return new Map(counts);
  });
}

function spread(counts: Map<PlayerId, number>): number {
  return Math.max(...counts.values()) - Math.min(...counts.values());
}

/**
 * Courts a roster can actually staff, worked out here rather than asked of the engine: an oracle
 * that shared the engine's own rule could not catch the engine getting that rule wrong.
 */
function expectedCourts(players: number, courtCount: number): number {
  return Math.min(courtCount, Math.floor(players / 4));
}

describe('generateRemaining — rosters that have to bench', () => {
  it('fills every court it can staff and benches the rest', () => {
    // Six players on two courts: one court in play, two on the bench, every round.
    const session = scheduledSession(6, 2, 5);

    for (let index = 0; index < session.rounds.length; index++) {
      expect(session.rounds[index].matches).toHaveLength(1);
      expect(playing(session, index).size).toBe(4);
    }

    assertSessionValid(session);
  });

  it('schedules nobody who is on the bench that round', () => {
    const session = scheduledSession(11, 2, 8);

    for (let index = 0; index < session.rounds.length; index++) {
      const onCourt = playing(session, index);

      expect(onCourt.size).toBe(8);
      expect(session.roster.filter((entry) => !onCourt.has(entry.id))).toHaveLength(3);
    }

    assertSessionValid(session);
  });

  it('keeps bench counts within one of each other after every round, not just the last', () => {
    const session = scheduledSession(11, 2, 11);

    for (const counts of benchCountsByPrefix(session)) {
      expect(spread(counts)).toBeLessThanOrEqual(1);
    }

    assertSessionValid(session);
  });

  it('gives nobody a second turn on the bench before everyone has had a first', () => {
    // The point of the spread rule, said in the organizer's words rather than the engine's.
    const session = scheduledSession(11, 2, 4);
    const afterFourRounds = benchCountsByPrefix(session)[3];

    expect(Math.min(...afterFourRounds.values())).toBe(1);

    assertSessionValid(session);
  });

  it('holds fairness for every roster of 4 to 16 against 1 to 4 courts', () => {
    // The acceptance range, walked in full: `assertSessionValid` is itself a prefix check, so
    // every one of these sessions is being asserted round by round rather than only at the end.
    for (let players = 4; players <= 16; players++) {
      for (let courtCount = 1; courtCount <= 4; courtCount++) {
        const session = scheduledSession(players, courtCount, 11, `s-${players}-${courtCount}`);
        const courts = expectedCourts(players, courtCount);

        expect(() => assertSessionValid(session)).not.toThrow();
        for (const round of session.rounds) {
          expect(round.matches).toHaveLength(courts);
        }
        for (const counts of benchCountsByPrefix(session)) {
          expect(spread(counts)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('gives out exactly where ADR-0006 says it does, and the referee says so', () => {
    // The tightest cell in the grid: twelve players on one court, where eight of twelve sit out
    // and the bench rule leaves the planner no choice of who plays. Eleven rounds is clean; the
    // twelfth has to repeat a partnership. Pinned rather than hidden — the grid above stops at
    // eleven for this one reason, and improving the search should fail this test, not pass it
    // silently.
    expect(() => assertSessionValid(scheduledSession(12, 1, 11))).not.toThrow();
    expect(() => assertSessionValid(scheduledSession(12, 1, 12))).toThrow(/partner/i);
  });

  it('keeps the structural rules even past the point partner variety gives out', () => {
    // Long past a complete rotation, where the planner is spending its search budget and settling
    // for repeats: bench spread and court staffing are constructed, not searched for, so they hold
    // whatever the soft costs do.
    const session = scheduledSession(14, 3, 20);

    for (const round of session.rounds) {
      expect(round.matches).toHaveLength(3);
    }
    for (const counts of benchCountsByPrefix(session)) {
      expect(spread(counts)).toBeLessThanOrEqual(1);
    }
  });

  it('is fair at every round an eleven-player evening might stop at', () => {
    const session = scheduledSession(11, 2, 11);

    for (let stopAfter = 1; stopAfter <= session.rounds.length; stopAfter++) {
      const cutShort = { ...session, rounds: session.rounds.slice(0, stopAfter) };

      expect(() => assertSessionValid(cutShort)).not.toThrow();
    }
  });

  it('prints an eleven-player evening in a form a human can read', () => {
    // ADR-0005: no assertion on the layout, only that the awkward case renders at all — the
    // point of the printout is that a person can look at this schedule and believe it.
    const printed = formatSchedule(scheduledSession(11, 2, 11));

    expect(printed).toContain('Bench');
    expect(printed).toContain('11 players');
  });

  it('is deterministic — a benched roster schedules identically run after run', () => {
    expect(scheduledSession(11, 2, 9)).toEqual(scheduledSession(11, 2, 9));
  });

  it('gives two sessions with different ids different fixture lists', () => {
    const friday = scheduledSession(11, 2, 6, 'friday');
    const sunday = scheduledSession(11, 2, 6, 'sunday');

    expect(sunday.rounds).not.toEqual(friday.rounds);
  });

  it('schedules around the rounds a benched session has already played', () => {
    const played = scheduledSession(11, 2, 9);
    // A session as it comes back from storage mid-evening: three rounds played, six to fill.
    const partGenerated = {
      ...played,
      rounds: played.rounds.map((round, index) => (index < 3 ? round : { ...round, matches: [] })),
    };

    const session = generateRemaining(partGenerated);

    expect(session.rounds.slice(0, 3)).toEqual(played.rounds.slice(0, 3));
    expect(session.rounds.every((round) => round.matches.length === 2)).toBe(true);

    assertSessionValid(session);
  });

  it('rotates the bench around a roster that leaves one player out', () => {
    // Five players on one court: exactly one sits out each round, so after five rounds
    // everyone has sat out exactly once.
    const session = scheduledSession(5, 1, 5);
    const afterAll = benchCountsByPrefix(session)[4];

    expect([...afterAll.values()]).toEqual([1, 1, 1, 1, 1]);

    assertSessionValid(session);
  });
});
