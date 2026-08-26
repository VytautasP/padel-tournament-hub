import { assertSessionValid, createSession } from './public-api';
import type { Round, SessionConfig } from './public-api';
import { americanoConfig, roster } from './test-support/session-fixtures';

describe('createSession', () => {
  it('builds an Americano session from mode, roster, court count, target score and round count', () => {
    const session = createSession(
      americanoConfig({ id: 'friday-night', courtCount: 2, targetScore: 32, roundCount: 7 }),
    );

    expect(session.id).toBe('friday-night');
    expect(session.mode).toBe('americano');
    expect(session.courtCount).toBe(2);
    expect(session.targetScore).toBe(32);
    expect(session.rounds).toHaveLength(7);
    expect(session.roster.map((entry) => entry.name)).toEqual([
      'Ana',
      'Ben',
      'Cara',
      'Dov',
      'Elin',
      'Finn',
      'Gita',
      'Hugo',
    ]);

    assertSessionValid(session);
  });

  it('starts every round ungenerated', () => {
    const session = createSession(americanoConfig({ roundCount: 3 }));

    expect(session.rounds.map((round) => round.matches)).toEqual([[], [], []]);

    assertSessionValid(session);
  });

  it('gives every roster entry and round a stable id', () => {
    const session = createSession(americanoConfig({ roundCount: 3 }));

    expect(session.roster.map((entry) => entry.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
    ]);
    expect(session.rounds.map((round) => round.number)).toEqual([1, 2, 3]);
    expect(new Set(session.rounds.map((round) => round.id)).size).toBe(3);

    assertSessionValid(session);
  });

  it('returns a session that cannot be mutated', () => {
    const session = createSession(americanoConfig());

    expect(() => {
      (session.rounds as Round[]).push(session.rounds[0]);
    }).toThrow();

    assertSessionValid(session);
  });

  describe('rejects a configuration it cannot schedule', () => {
    const rejects = (overrides: Partial<SessionConfig>, message: RegExp): void => {
      expect(() => createSession(americanoConfig(overrides))).toThrow(message);

      // The rejection has to be about the defect and nothing else, so the test ends by
      // validating the session the same fixture builds without it.
      assertSessionValid(createSession(americanoConfig()));
    };

    it('when the roster cannot fill a single court', () => {
      rejects({ courtCount: 2, players: roster(3) }, /at least 4 players/);
    });

    it('when there are no courts', () => {
      rejects({ courtCount: 0, players: roster(8) }, /at least one court/);
    });

    it('when there are no rounds', () => {
      rejects({ roundCount: 0 }, /at least one round/);
    });

    it('when the round count is not a whole number', () => {
      rejects({ roundCount: 2.5 }, /at least one round/);
    });

    it('when the target score is not a positive whole number', () => {
      rejects({ targetScore: 0 }, /target score/);
    });

    it('when two roster entries share an id', () => {
      rejects(
        {
          players: roster(8).map((entry, index) => (index === 3 ? { ...entry, id: 'p1' } : entry)),
        },
        /duplicate roster id/i,
      );
    });

    it('when a roster entry has a blank id or name', () => {
      rejects(
        {
          players: roster(8).map((entry, index) =>
            index === 2 ? { ...entry, name: '  ' } : entry,
          ),
        },
        /name/i,
      );
    });
  });
});
