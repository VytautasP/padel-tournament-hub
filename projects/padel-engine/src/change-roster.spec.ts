import {
  addPlayer,
  addRound,
  assertSessionValid,
  computeStandings,
  createSession,
  finishSession,
  generateRemaining,
  recordScore,
  removePlayer,
} from './public-api';
import type { PlayerId, Session } from './public-api';
import { americanoConfig, roster } from './test-support/session-fixtures';

/** A generated session of `players` on `courtCount` courts, nothing scored yet. */
function generated(
  players: number,
  courtCount: number,
  roundCount: number,
  id = 'session-1',
): Session {
  return generateRemaining(
    createSession(americanoConfig({ id, players: roster(players), courtCount, roundCount })),
  );
}

/** Score every match in rounds 1..`through`, so those rounds count as played. */
function playThrough(session: Session, through: number): Session {
  return session.rounds
    .slice(0, through)
    .flatMap((round) => round.matches)
    .reduce(
      (scored, match) => recordScore(scored, { matchId: match.id, side: 'A', points: 15 }),
      session,
    );
}

/** Who is scheduled in this round — a Set, so anyone off court is simply absent. */
function playing(session: Session, roundNumber: number): Set<PlayerId> {
  const round = session.rounds[roundNumber - 1];

  return new Set(round.matches.flatMap((match) => [...match.sideA, ...match.sideB]));
}

/** Every round from `from` onwards, as sets of who is on court. */
function playingFrom(session: Session, from: number): Set<PlayerId>[] {
  return session.rounds.slice(from - 1).map((_, index) => playing(session, from + index));
}

/** How many rounds from `from` onwards each player was on court for. */
function matchesFrom(session: Session, from: number): Map<PlayerId, number> {
  const counts = new Map<PlayerId, number>(session.roster.map((entry) => [entry.id, 0]));
  for (const onCourt of playingFrom(session, from)) {
    for (const id of onCourt) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}

/** Every prefix of the session is valid — the fairness question asked at every stopping point. */
function expectFairAtEveryPrefix(session: Session): void {
  for (let stopAfter = 1; stopAfter <= session.rounds.length; stopAfter++) {
    const cutShort = { ...session, rounds: session.rounds.slice(0, stopAfter) };

    expect(() => assertSessionValid(cutShort)).not.toThrow();
  }
}

describe('addPlayer', () => {
  it('puts a late arrival into the rounds still to come', () => {
    const played = playThrough(generated(8, 2, 6), 2);

    const widened = addPlayer(played, { id: 'late', name: 'Late' });

    expect(widened.roster.map((entry) => entry.id)).toContain('late');
    expect(playingFrom(widened, 3).some((onCourt) => onCourt.has('late'))).toBe(true);

    assertSessionValid(widened);
  });

  it('leaves the rounds already played byte-identical', () => {
    const played = playThrough(generated(8, 2, 6), 2);

    const widened = addPlayer(played, { id: 'late', name: 'Late' });

    expect(widened.rounds.slice(0, 2)).toEqual(played.rounds.slice(0, 2));

    assertSessionValid(widened);
  });

  it('schedules the arrival into no round that was played before they got there', () => {
    const played = playThrough(generated(8, 2, 6), 2);

    const widened = addPlayer(played, { id: 'late', name: 'Late' });

    for (let round = 1; round <= 2; round++) {
      expect(playing(widened, round).has('late')).toBe(false);
    }

    assertSessionValid(widened);
  });

  it('regenerates the unplayed rounds rather than leaving them as they were', () => {
    // Rounds 3 to 6 were generated for eight players; with nine they cannot stay as they were.
    const played = playThrough(generated(8, 2, 6), 2);

    const widened = addPlayer(played, { id: 'late', name: 'Late' });

    expect(widened.rounds.slice(2)).not.toEqual(played.rounds.slice(2));
    expect(widened.rounds.every((round) => round.matches.length === 2)).toBe(true);

    assertSessionValid(widened);
  });

  it('does not flood a late arrival with matches to make up rounds they could not play', () => {
    // Eight rounds of twelve played, on a roster that always benches: judged from the start the
    // arrival has sat out eight rounds and everyone else two or three, so a bench rule reading
    // raw counts would put them on court every remaining round.
    const played = playThrough(generated(11, 2, 12), 8);

    const widened = addPlayer(played, { id: 'late', name: 'Late' });
    const remaining = matchesFrom(widened, 9);
    const others = [...remaining.entries()].filter(([id]) => id !== 'late');

    expect(remaining.get('late')).toBeLessThanOrEqual(
      Math.max(...others.map(([, count]) => count)),
    );

    assertSessionValid(widened);
  });

  it('holds bench spread and partner variety at every prefix after the arrival', () => {
    expectFairAtEveryPrefix(
      addPlayer(playThrough(generated(8, 2, 10), 3), { id: 'late', name: 'Late' }),
    );
  });

  it('keeps the standings of the rounds played before the arrival', () => {
    const played = playThrough(generated(8, 2, 6), 2);
    const before = computeStandings(played);

    const widened = addPlayer(played, { id: 'late', name: 'Late' });
    const after = computeStandings(widened);

    for (const line of before) {
      const same = after.find((entry) => entry.playerId === line.playerId);
      expect(same?.points).toBe(line.points);
      expect(same?.matchesPlayed).toBe(line.matchesPlayed);
    }
    expect(after.find((entry) => entry.playerId === 'late')?.matchesPlayed).toBe(0);
  });

  it('takes a player onto a session where nothing has been played yet', () => {
    const session = generated(8, 2, 4);

    const widened = addPlayer(session, { id: 'late', name: 'Late' });

    expect(widened.roster).toHaveLength(9);
    expect(playingFrom(widened, 1).every((onCourt) => onCourt.size === 8)).toBe(true);

    assertSessionValid(widened);
  });

  it('refuses a player already on the roster', () => {
    const session = generated(8, 2, 4);

    expect(() => addPlayer(session, { id: 'p3', name: 'Twin' })).toThrow(/already on the roster/i);

    assertSessionValid(session);
  });

  it('refuses a roster change on a finished session', () => {
    const finished = finishSession(playThrough(generated(8, 2, 3), 3));

    expect(() => addPlayer(finished, { id: 'late', name: 'Late' })).toThrow(/finished/);

    assertSessionValid(finished);
  });

  it('leaves the session it was given untouched', () => {
    const played = playThrough(generated(8, 2, 6), 2);

    addPlayer(played, { id: 'late', name: 'Late' });

    expect(played.roster).toHaveLength(8);

    assertSessionValid(played);
  });

  it('returns a session that cannot be mutated', () => {
    const widened = addPlayer(generated(8, 2, 4), { id: 'late', name: 'Late' });

    expect(() => {
      (widened.roster as unknown as unknown[]).push({});
    }).toThrow();

    assertSessionValid(widened);
  });
});

describe('removePlayer', () => {
  it('schedules a departing player into no round still to come', () => {
    const played = playThrough(generated(9, 2, 6), 2);

    const narrowed = removePlayer(played, 'p3');

    expect(playingFrom(narrowed, 3).some((onCourt) => onCourt.has('p3'))).toBe(false);

    assertSessionValid(narrowed);
  });

  it('leaves the rounds already played byte-identical', () => {
    const played = playThrough(generated(9, 2, 6), 2);

    const narrowed = removePlayer(played, 'p3');

    expect(narrowed.rounds.slice(0, 2)).toEqual(played.rounds.slice(0, 2));

    assertSessionValid(narrowed);
  });

  it('keeps the departing player on the roster, so their matches still have a name on them', () => {
    const played = playThrough(generated(9, 2, 6), 2);

    const narrowed = removePlayer(played, 'p3');

    expect(narrowed.roster.map((entry) => entry.id)).toContain('p3');

    assertSessionValid(narrowed);
  });

  it('keeps the departing player in the standings, counting for everyone else', () => {
    const played = playThrough(generated(9, 2, 6), 2);
    const before = computeStandings(played).find((line) => line.playerId === 'p3');

    const narrowed = removePlayer(played, 'p3');
    const after = computeStandings(narrowed).find((line) => line.playerId === 'p3');

    expect(after?.matchesPlayed).toBeGreaterThan(0);
    expect(after?.points).toBe(before?.points);
    expect(after?.matchesPlayed).toBe(before?.matchesPlayed);
  });

  it('drops a court the roster can no longer staff', () => {
    // Nine players on two courts fill both, and so do eight; taking two away leaves seven —
    // one court, three on the bench — from the first unplayed round onwards.
    const played = playThrough(generated(9, 2, 6), 2);

    const narrowed = removePlayer(removePlayer(played, 'p3'), 'p4');

    expect(narrowed.rounds[0].matches).toHaveLength(2);
    expect(narrowed.rounds[2].matches).toHaveLength(1);

    assertSessionValid(narrowed);
  });

  it('holds bench spread and partner variety at every prefix after the departure', () => {
    expectFairAtEveryPrefix(removePlayer(playThrough(generated(11, 2, 10), 4), 'p5'));
  });

  it('refuses to leave a round without the players to fill a court', () => {
    const played = playThrough(generated(5, 1, 6), 2);

    expect(() => removePlayer(removePlayer(played, 'p1'), 'p2')).toThrow(/at least 4/i);

    assertSessionValid(played);
  });

  it('refuses a player who is not on the roster', () => {
    const session = generated(8, 2, 4);

    expect(() => removePlayer(session, 'ghost')).toThrow(/not on the roster/i);

    assertSessionValid(session);
  });

  it('refuses a player who has already left', () => {
    const played = playThrough(generated(9, 2, 6), 2);
    const narrowed = removePlayer(played, 'p3');

    expect(() => removePlayer(narrowed, 'p3')).toThrow(/already left/i);

    assertSessionValid(narrowed);
  });

  it('refuses a roster change on a finished session', () => {
    const finished = finishSession(playThrough(generated(9, 2, 3), 3));

    expect(() => removePlayer(finished, 'p3')).toThrow(/finished/);

    assertSessionValid(finished);
  });

  it('leaves the session it was given untouched', () => {
    const played = playThrough(generated(9, 2, 6), 2);

    removePlayer(played, 'p3');

    expect(playingFrom(played, 3).some((onCourt) => onCourt.has('p3'))).toBe(true);

    assertSessionValid(played);
  });
});

describe('a roster that moves all evening', () => {
  it('stays fair through arrivals, departures and rounds added between them', () => {
    // The evening as it actually goes: eight turn up, one arrives late, someone twists an ankle,
    // another arrives, and the organizer keeps adding rounds while there is court time left.
    let session = playThrough(generated(8, 2, 4), 2);

    session = addPlayer(session, { id: 'late-1', name: 'Late One' });
    session = playThrough(session, 3);
    session = removePlayer(session, 'p2');
    session = addRound(session);
    session = playThrough(session, 5);
    session = addPlayer(session, { id: 'late-2', name: 'Late Two' });
    session = addRound(session);

    expect(session.rounds).toHaveLength(6);
    expect(playingFrom(session, 4).some((onCourt) => onCourt.has('p2'))).toBe(false);
    expect(playingFrom(session, 6).some((onCourt) => onCourt.has('late-2'))).toBe(true);

    expectFairAtEveryPrefix(session);
  });

  it('holds for every roster of 5 to 13 against 1 to 3 courts, arrival and departure included', () => {
    // The acceptance grid, walked with the roster moving underneath it: three rounds played, a
    // player arrives, three more played, a player leaves. Every cell is asserted at every prefix,
    // so the fairness question is asked at each of the eight rounds rather than only at the end.
    for (let players = 5; players <= 13; players++) {
      for (let courtCount = 1; courtCount <= 3; courtCount++) {
        const id = `s-${players}-${courtCount}`;
        let session = playThrough(generated(players, courtCount, 8, id), 3);

        session = addPlayer(session, { id: 'late', name: 'Late' });
        session = playThrough(session, 6);
        session = removePlayer(session, 'p2');

        expectFairAtEveryPrefix(session);
      }
    }
  });

  it('gives out where a moving roster runs out of partnerships, and the referee says so', () => {
    // The tightest cell in the grid: seven players on one court, joined by an eighth, where four
    // of eight sit out every round and the bench rule leaves the planner almost no choice of who
    // plays. Eight rounds are clean; the ninth has to repeat a partnership. Pinned rather than
    // hidden, in the same spirit as ADR-0006's twelve-on-one — the grid above stops at eight for
    // this one reason, and improving the search should fail this test rather than pass it
    // silently.
    const upTo = (rounds: number): Session => {
      const arrived = addPlayer(playThrough(generated(7, 1, rounds, 's-7-1'), 3), {
        id: 'late',
        name: 'Late',
      });

      return removePlayer(playThrough(arrived, 6), 'p2');
    };

    expect(() => assertSessionValid(upTo(8))).not.toThrow();
    expect(() => assertSessionValid(upTo(9))).toThrow(/partner/i);
  });

  it('is deterministic — the same sequence of roster changes schedules identically', () => {
    const change = (): Session => {
      const played = playThrough(generated(9, 2, 8), 3);

      return removePlayer(addPlayer(played, { id: 'late', name: 'Late' }), 'p4');
    };

    expect(change()).toEqual(change());
  });
});
