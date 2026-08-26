import {
  addPlayer,
  addRound,
  assertSessionValid,
  createSession,
  formatSchedule,
  generateRemaining,
} from './public-api';
import type { PlayerId, Session, SessionConfig, TeamId } from './public-api';
import { damaged } from './test-support/damaged-session';
import { americanoConfig, roster } from './test-support/session-fixtures';
import { teamAmericanoConfig, teamsOf } from './test-support/team-fixtures';

function scheduled(config: SessionConfig): Session {
  return generateRemaining(createSession(config));
}

/** Every match of the session as the pair of team ids it put across the net. */
function meetings(session: Session): { round: number; teams: [TeamId, TeamId] }[] {
  return session.rounds.flatMap((round) =>
    round.matches.map((match) => ({
      round: round.number,
      teams: [match.teams?.sideA ?? '?', match.teams?.sideB ?? '?'] as [TeamId, TeamId],
    })),
  );
}

/** Each meeting as a `"a|b"` key with the team ids in a stable order. */
function meetingKeys(session: Session): string[] {
  return meetings(session).map(({ teams }) => [...teams].sort().join('|'));
}

/** Which teams sat out each round, in round order. */
function byesByRound(session: Session): TeamId[][] {
  const teams = (session.teams ?? []).map((team) => team.id);

  return session.rounds.map((round) => {
    const playing = new Set(
      round.matches.flatMap((match) => [match.teams?.sideA, match.teams?.sideB]),
    );

    return teams.filter((id) => !playing.has(id));
  });
}

/** Who each player partnered, across the whole session. */
function partnersOf(session: Session): Map<PlayerId, Set<PlayerId>> {
  const partners = new Map<PlayerId, Set<PlayerId>>();

  for (const round of session.rounds) {
    for (const match of round.matches) {
      for (const side of [match.sideA, match.sideB]) {
        for (const [player, partner] of [side, [...side].reverse()]) {
          partners.set(player, (partners.get(player) ?? new Set()).add(partner));
        }
      }
    }
  }

  return partners;
}

describe('createSession — Team Americano', () => {
  it('carries the pairs the organizer assigned onto the session', () => {
    const session = createSession(teamAmericanoConfig({ teamCount: 3, roundCount: 4 }));

    expect(session.mode).toBe('team-americano');
    expect(session.teams).toEqual([
      { id: 't1', playerIds: ['p1', 'p2'] },
      { id: 't2', playerIds: ['p3', 'p4'] },
      { id: 't3', playerIds: ['p5', 'p6'] },
    ]);

    assertSessionValid(session);
  });

  it('refuses an odd roster, because the last player has nobody to pair with', () => {
    const players = roster(7);

    expect(() => createSession(teamAmericanoConfig({ players, teams: teamsOf(players) }))).toThrow(
      /"p7" is in no team/,
    );
  });

  it('refuses a player who is in two teams', () => {
    const teams = teamsOf(roster(8)).map((team, index) =>
      index === 1 ? { ...team, playerIds: ['p1', 'p4'] as const } : team,
    );

    expect(() => createSession(teamAmericanoConfig({ teams }))).toThrow(/"p1" is in 2 teams/);
  });

  it('refuses a player who is in no team', () => {
    const teams = teamsOf(roster(8)).slice(0, 3);

    expect(() => createSession(teamAmericanoConfig({ teams }))).toThrow(/"p7" is in no team/);
  });

  it('refuses a team whose two halves are the same player', () => {
    const teams = teamsOf(roster(8)).map((team, index) =>
      index === 0 ? { ...team, playerIds: ['p1', 'p1'] as const } : team,
    );

    expect(() => createSession(teamAmericanoConfig({ teams }))).toThrow(/two different players/);
  });

  it('refuses a team naming somebody who is not on the roster', () => {
    const teams = teamsOf(roster(8)).map((team, index) =>
      index === 3 ? { ...team, playerIds: ['p7', 'p99'] as const } : team,
    );

    expect(() => createSession(teamAmericanoConfig({ teams }))).toThrow(/"p99".*not on the roster/);
  });

  it('refuses two teams sharing an id', () => {
    const teams = teamsOf(roster(8)).map((team) => ({ ...team, id: 't1' }));

    expect(() => createSession(teamAmericanoConfig({ teams }))).toThrow(/Duplicate team id/);
  });

  it('refuses Team Americano with no pairing at all', () => {
    expect(() => createSession(teamAmericanoConfig({ teams: undefined }))).toThrow(
      /needs its players paired into teams/,
    );
  });

  it('refuses teams on a mode that rotates partners', () => {
    const players = roster(8);

    expect(() =>
      createSession(teamAmericanoConfig({ mode: 'americano', teams: teamsOf(players) })),
    ).toThrow(/Only Team Americano has teams/);
  });
});

describe('generateRemaining — Team Americano', () => {
  it('puts a team on each side of every court', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 5 }));
    const teams = new Map((session.teams ?? []).map((team) => [team.id, team.playerIds]));

    for (const round of session.rounds) {
      for (const match of round.matches) {
        expect(match.teams).toBeDefined();
        expect(match.sideA).toEqual(teams.get(match.teams?.sideA ?? ''));
        expect(match.sideB).toEqual(teams.get(match.teams?.sideB ?? ''));
      }
    }

    assertSessionValid(session);
  });

  it('never changes who partners whom, however long the evening runs', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 9 }));

    for (const [player, partners] of partnersOf(session)) {
      expect([...partners]).toHaveLength(1);
      expect(session.teams?.find((team) => team.playerIds.includes(player))?.playerIds).toContain(
        [...partners][0],
      );
    }

    assertSessionValid(session);
  });

  it('never schedules a team on two courts in the same round', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 6, courtCount: 3, roundCount: 6 }));

    for (const round of session.rounds) {
      const playing = round.matches.flatMap((match) => [match.teams?.sideA, match.teams?.sideB]);

      expect(playing).toHaveLength(6);
      expect(new Set(playing).size).toBe(6);
    }

    assertSessionValid(session);
  });

  it('benches a whole team when there are more teams than courts, and rotates the bye', () => {
    // Five teams on two courts: four play, one sits out, and over five rounds each team sits
    // out exactly once (decision #2c).
    const session = scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 5 }));
    const byes = byesByRound(session);

    expect(byes.map((round) => round.length)).toEqual([1, 1, 1, 1, 1]);
    expect(new Set(byes.flat())).toEqual(new Set(['t1', 't2', 't3', 't4', 't5']));

    assertSessionValid(session);
  });

  it('keeps team bench counts within one of each other at every round prefix', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 8 }));
    const counts = new Map((session.teams ?? []).map((team) => [team.id, 0]));

    for (const round of byesByRound(session)) {
      for (const id of round) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }

      const spread = Math.max(...counts.values()) - Math.min(...counts.values());
      expect(spread).toBeLessThanOrEqual(1);
    }

    assertSessionValid(session);
  });

  it('benches nobody while every team fits on a court', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 6 }));

    expect(byesByRound(session).flat()).toEqual([]);

    assertSessionValid(session);
  });

  it('faces every other team before facing any of them twice', () => {
    // Four teams is six fixtures, and three rounds of two courts is exactly six slots.
    const session = scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 3 }));
    const played = meetingKeys(session);

    expect(played).toHaveLength(6);
    expect(new Set(played).size).toBe(6);

    assertSessionValid(session);
  });

  it('repeats a fixture only once every other one has been played', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 6 }));
    const counts = new Map<string, number>();
    for (const key of meetingKeys(session)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    expect(new Set(counts.keys()).size).toBe(6);
    expect(Math.max(...counts.values())).toBe(2);

    assertSessionValid(session);
  });

  it('spreads the fixtures where a bye means not every team meets every round', () => {
    // Five teams sharing two courts play two of the other four each round, so no team should be
    // met a second time while a third is still unplayed.
    const session = scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 5 }));
    const played = meetingKeys(session);

    expect(played).toHaveLength(10);
    expect(new Set(played).size).toBe(10);

    assertSessionValid(session);
  });

  it.each([
    { teamCount: 7, courtCount: 3, roundCount: 14 },
    { teamCount: 9, courtCount: 4, roundCount: 13 },
    { teamCount: 3, courtCount: 2, roundCount: 9 },
  ])(
    'holds every rule for $teamCount teams on $courtCount courts over $roundCount rounds',
    ({ teamCount, courtCount, roundCount }) => {
      // Odd team counts, more courts booked than the roster can staff, and evenings run well past
      // a full rotation: the shapes where a bench rule that only held at the end would show itself.
      const session = scheduled(teamAmericanoConfig({ teamCount, courtCount, roundCount }));
      const counts = new Map((session.teams ?? []).map((team) => [team.id, 0]));

      for (const round of byesByRound(session)) {
        for (const id of round) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }

        expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
      }

      assertSessionValid(session);
    },
  );

  it('schedules a known pairing exactly this way, run after run', () => {
    // Pinned expectations, not a self-comparison: two sessions built in one process would agree
    // even if the seed were drawn once at module load.
    const session = scheduled(
      teamAmericanoConfig({ id: 'friday', teamCount: 3, courtCount: 1, roundCount: 3 }),
    );

    expect(
      session.rounds.map((round) =>
        round.matches.map((match) => `${match.teams?.sideA} v ${match.teams?.sideB}`),
      ),
    ).toEqual([['t1 v t2'], ['t3 v t2'], ['t3 v t1']]);

    assertSessionValid(session);
  });

  it('is deterministic — the same input yields an identical schedule', () => {
    const first = scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 7 }));
    const second = scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 7 }));

    expect(second).toEqual(first);

    assertSessionValid(second);
  });

  it('leaves already-generated rounds byte-identical when run again', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 6 }));

    expect(generateRemaining(session)).toEqual(session);

    assertSessionValid(session);
  });
});

describe('assertSessionValid — Team Americano', () => {
  it('accepts a session the engine generated', () => {
    expect(() =>
      assertSessionValid(scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 7 }))),
    ).not.toThrow();
  });

  it('catches a side that is not the team the match says it is', () => {
    const session = damaged(
      scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 3 })),
      (copy) => {
        const [first, second] = copy.rounds[0].matches;
        [first.sideA[0], second.sideA[0]] = [second.sideA[0], first.sideA[0]];
      },
    );

    expect(() => assertSessionValid(session)).toThrow(/who are not that team/);
  });

  it('catches a match that does not say which teams played it', () => {
    const session = damaged(
      scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 3 })),
      (copy) => {
        delete copy.rounds[1].matches[0].teams;
      },
    );

    expect(() => assertSessionValid(session)).toThrow(/does not say which teams played it/);
  });

  it('catches a player who belongs to no team', () => {
    const session = damaged(
      scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 3 })),
      (copy) => {
        copy.teams = copy.teams?.slice(0, 3);
      },
    );

    expect(() => assertSessionValid(session)).toThrow(/is in no team/);
  });

  it('catches a team named on a match that the session has never heard of', () => {
    const session = damaged(
      scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 3 })),
      (copy) => {
        const teams = copy.rounds[0].matches[0].teams;
        if (teams) {
          teams.sideA = 't9';
        }
      },
    );

    expect(() => assertSessionValid(session)).toThrow(/which this session has not/);
  });

  it('catches a bye that keeps falling on the same team', () => {
    // Round one played three times over: the team that took the first bye takes all of them.
    const session = damaged(
      scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 3 })),
      (copy) => {
        for (const round of copy.rounds.slice(1)) {
          round.matches = copy.rounds[0].matches.map((match, court) => ({
            ...structuredClone(match),
            id: `r${round.number}c${court + 1}`,
          }));
        }
      },
    );

    expect(() => assertSessionValid(session)).toThrow(/bench counts differ by 2 — team/);
  });

  it('catches a fixture repeated while a team has an opponent it has never faced', () => {
    const session = damaged(
      scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 2 })),
      (copy) => {
        copy.rounds[1].matches = copy.rounds[0].matches.map((match, court) => ({
          ...structuredClone(match),
          id: `r2c${court + 1}`,
        }));
      },
    );

    expect(() => assertSessionValid(session)).toThrow(/for the 2 time\(s\) while/);
  });

  it('catches teams named on a session that plays no teams', () => {
    const session = damaged(scheduled(americanoConfig({ roundCount: 3 })), (copy) => {
      copy.rounds[0].matches[0].teams = { sideA: 't1', sideB: 't2' };
    });

    expect(() => assertSessionValid(session)).toThrow(/names teams, but this session is americano/);
  });
});

describe('the rest of the engine — Team Americano', () => {
  it('adds a round mid-evening, planned against everything already played', () => {
    const session = addRound(scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 4 })));

    expect(session.rounds).toHaveLength(5);
    expect(new Set(byesByRound(session).flat())).toEqual(new Set(['t1', 't2', 't3', 't4', 't5']));

    assertSessionValid(session);
  });

  it('sends a player arriving on their own to the operation that pairs them', () => {
    // Losing and replacing half a pair is decision #2b, and lives in `orphaned-partner.spec.ts`.
    const session = scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 3 }));

    expect(() => addPlayer(session, { id: 'p99', name: 'Zoe' })).toThrow(/use assignPartner/);
  });

  it('prints a schedule a human can read', () => {
    // No assertion on the text (ADR-0005) — only that a paired session renders at all.
    const printed = formatSchedule(scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 4 })));

    expect(printed).toContain('Team Americano');
    expect(printed.length).toBeGreaterThan(0);
  });
});
