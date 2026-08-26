import {
  addPlayer,
  addRound,
  assertSessionValid,
  assignPartner,
  computeTeamStandings,
  createSession,
  formatSchedule,
  generateRemaining,
  recordScore,
  removePlayer,
  teamsNeedingPartner,
} from './public-api';
import type { PlayerId, Session, SessionConfig, TeamId, TeamStanding } from './public-api';
import { damaged } from './test-support/damaged-session';
import { americanoConfig } from './test-support/session-fixtures';
import { teamAmericanoConfig } from './test-support/team-fixtures';

function scheduled(config: SessionConfig): Session {
  return generateRemaining(createSession(config));
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

/** Which teams took the court in each round, in round order. */
function teamsByRound(session: Session): TeamId[][] {
  return session.rounds.map((round) =>
    round.matches.flatMap((match) => [match.teams?.sideA ?? '?', match.teams?.sideB ?? '?']),
  );
}

/** Who was on court in each round, in round order. */
function playersByRound(session: Session): Set<PlayerId>[] {
  return session.rounds.map(
    (round) => new Set(round.matches.flatMap((match) => [...match.sideA, ...match.sideB])),
  );
}

/** One team's line in the table, by id. */
function lineFor(standings: readonly TeamStanding[], teamId: TeamId): TeamStanding {
  const line = standings.find((standing) => standing.teamId === teamId);
  if (!line) {
    throw new Error(`No standings line for team "${teamId}".`);
  }

  return line;
}

/** Every prefix of the session is valid — the fairness question asked at every stopping point. */
function expectFairAtEveryPrefix(session: Session): void {
  for (let stopAfter = 1; stopAfter <= session.rounds.length; stopAfter++) {
    const cutShort = { ...session, rounds: session.rounds.slice(0, stopAfter) };

    expect(() => assertSessionValid(cutShort)).not.toThrow();
  }
}

/** Five teams on two courts over six rounds, with rounds 1–2 played. */
function fiveTeamsTwoPlayed(): Session {
  return playThrough(scheduled(teamAmericanoConfig({ teamCount: 5, roundCount: 6 })), 2);
}

describe('losing half a pair', () => {
  it('flags the remaining player and keeps their team in the session', () => {
    const orphaned = removePlayer(fiveTeamsTwoPlayed(), 'p1');

    expect(orphaned.teams?.map((team) => team.id)).toContain('t1');
    expect(teamsNeedingPartner(orphaned)).toEqual([{ teamId: 't1', playerId: 'p2' }]);
    assertSessionValid(orphaned);
  });

  it('leaves the rounds already played exactly as they were', () => {
    const played = fiveTeamsTwoPlayed();

    const orphaned = removePlayer(played, 'p1');

    expect(orphaned.rounds.slice(0, 2)).toEqual(played.rounds.slice(0, 2));
  });

  it('schedules the orphaned team into no later round', () => {
    const orphaned = removePlayer(fiveTeamsTwoPlayed(), 'p1');

    expect(teamsByRound(orphaned).slice(2).flat()).not.toContain('t1');
  });

  it('puts the stranded player on no court', () => {
    const orphaned = removePlayer(fiveTeamsTwoPlayed(), 'p1');

    expect(
      playersByRound(orphaned)
        .slice(2)
        .some((onCourt) => onCourt.has('p2')),
    ).toBe(false);
  });

  it('is caught by the referee when a stranded player is scheduled anyway', () => {
    const orphaned = removePlayer(fiveTeamsTwoPlayed(), 'p1');
    const broken = damaged(orphaned, (copy) => {
      const match = copy.rounds[2].matches[0];
      match.sideA = ['p2', match.sideA[1]];
    });

    expect(() => assertSessionValid(broken)).toThrow(/needs a partner/);
  });

  it('keeps every prefix of the session fair', () => {
    expectFairAtEveryPrefix(removePlayer(fiveTeamsTwoPlayed(), 'p1'));
  });

  it('leaves the teams still playing free to add a round', () => {
    const extended = addRound(removePlayer(fiveTeamsTwoPlayed(), 'p1'));

    expect(extended.rounds).toHaveLength(7);
    assertSessionValid(extended);
  });

  it('prints a schedule that says who needs a partner', () => {
    // No assertion on the text (ADR-0005) — only that an orphaned session renders at all.
    const printed = formatSchedule(removePlayer(fiveTeamsTwoPlayed(), 'p1'));

    expect(printed).toContain('needs partner');
  });

  it('refuses a removal that would leave too few teams to play', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 2, roundCount: 3 }));

    expect(() => removePlayer(session, 'p1')).toThrow(/team\(s\) available/);
  });

  it('refuses the removal that would orphan the last team with an opponent', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 3, courtCount: 1, roundCount: 3 }));
    const orphaned = removePlayer(session, 'p1');

    expect(() => removePlayer(orphaned, 'p3')).toThrow(/team\(s\) available/);
    assertSessionValid(orphaned);
  });

  it('still refuses a lone arrival, pointing at the operation that pairs one', () => {
    const session = scheduled(teamAmericanoConfig({ teamCount: 4, roundCount: 3 }));

    expect(() => addPlayer(session, { id: 'p99', name: 'Zoe' })).toThrow(/assignPartner/);
  });
});

describe('assigning a new partner', () => {
  /** Five teams, rounds 1–2 played, p1 gone home and rounds 3–6 replanned without team t1. */
  function orphanedSession(): Session {
    return removePlayer(fiveTeamsTwoPlayed(), 'p1');
  }

  it('repairs the team, which plays again from the next unplayed round', () => {
    const repaired = assignPartner(orphanedSession(), 't1', { id: 'p11', name: 'Kaja' });

    expect(teamsNeedingPartner(repaired)).toEqual([]);
    expect(teamsByRound(repaired).slice(2).flat()).toContain('t1');
    assertSessionValid(repaired);
  });

  it('fields the stranded player alongside their new partner', () => {
    const repaired = assignPartner(orphanedSession(), 't1', { id: 'p11', name: 'Kaja' });
    const sides = repaired.rounds
      .slice(2)
      .flatMap((round) => round.matches)
      .flatMap((match) => [match.sideA, match.sideB])
      .filter((side) => side.includes('p11'));

    expect(sides.length).toBeGreaterThan(0);
    for (const side of sides) {
      expect([...side].sort()).toEqual(['p11', 'p2']);
    }
  });

  it('leaves the rounds already played exactly as they were', () => {
    const orphaned = orphanedSession();

    const repaired = assignPartner(orphaned, 't1', { id: 'p11', name: 'Kaja' });

    expect(repaired.rounds.slice(0, 2)).toEqual(orphaned.rounds.slice(0, 2));
  });

  it('keeps the points the team earned before it was orphaned', () => {
    const orphaned = orphanedSession();
    const before = lineFor(computeTeamStandings(orphaned), 't1');

    const after = lineFor(
      computeTeamStandings(assignPartner(orphaned, 't1', { id: 'p11', name: 'Kaja' })),
      't1',
    );

    expect(before.points).toBeGreaterThan(0);
    expect(after.points).toBe(before.points);
    expect(after.matchesPlayed).toBe(before.matchesPlayed);
  });

  it('leaves every other team points per match untouched, all the way through', () => {
    const played = fiveTeamsTwoPlayed();
    const others = ['t2', 't3', 't4', 't5'];
    const pointsPerMatch = (session: Session): number[] =>
      others.map((id) => lineFor(computeTeamStandings(session), id).pointsPerMatch);
    const before = pointsPerMatch(played);

    const orphaned = removePlayer(played, 'p1');
    const repaired = assignPartner(orphaned, 't1', { id: 'p11', name: 'Kaja' });

    expect(pointsPerMatch(orphaned)).toEqual(before);
    expect(pointsPerMatch(repaired)).toEqual(before);
  });

  it('holds bench spread and opponent variety at every prefix after the repair', () => {
    const repaired = assignPartner(orphanedSession(), 't1', { id: 'p11', name: 'Kaja' });

    expectFairAtEveryPrefix(playThrough(repaired, 6));
  });

  it('holds them when the repair comes after further rounds have been played', () => {
    const late = assignPartner(playThrough(orphanedSession(), 4), 't1', {
      id: 'p11',
      name: 'Kaja',
    });

    expect(teamsByRound(late).slice(4).flat()).toContain('t1');
    expectFairAtEveryPrefix(late);
  });

  it('refuses a partner who is already on the roster', () => {
    expect(() => assignPartner(orphanedSession(), 't1', { id: 'p3', name: 'Cara' })).toThrow(
      /already on the roster/,
    );
  });

  it('refuses a team that has both its players', () => {
    expect(() => assignPartner(orphanedSession(), 't2', { id: 'p11', name: 'Kaja' })).toThrow(
      /already has two players/,
    );
  });

  it('refuses a team this session has not', () => {
    expect(() => assignPartner(orphanedSession(), 't9', { id: 'p11', name: 'Kaja' })).toThrow(
      /has no team "t9"/,
    );
  });

  it('refuses a mode that pairs nobody', () => {
    const session = scheduled(americanoConfig({ roundCount: 3 }));

    expect(() => assignPartner(session, 't1', { id: 'p11', name: 'Kaja' })).toThrow(
      /this session is americano/,
    );
  });
});

describe('removing the stranded player too', () => {
  it('retires the team, which plays no further round', () => {
    const retired = removePlayer(removePlayer(fiveTeamsTwoPlayed(), 'p1'), 'p2');

    expect(teamsNeedingPartner(retired)).toEqual([]);
    expect(retired.teams?.map((team) => team.id)).toContain('t1');
    expect(teamsByRound(retired).slice(2).flat()).not.toContain('t1');
    assertSessionValid(retired);
  });

  it('keeps the points the retired team earned', () => {
    const orphaned = removePlayer(fiveTeamsTwoPlayed(), 'p1');
    const before = lineFor(computeTeamStandings(orphaned), 't1');

    const after = lineFor(computeTeamStandings(removePlayer(orphaned, 'p2')), 't1');

    expect(after.points).toBe(before.points);
  });

  it('refuses a partner for a team with nobody left to partner', () => {
    const retired = removePlayer(removePlayer(fiveTeamsTwoPlayed(), 'p1'), 'p2');

    expect(() => assignPartner(retired, 't1', { id: 'p11', name: 'Kaja' })).toThrow(
      /has no player left/,
    );
  });
});
