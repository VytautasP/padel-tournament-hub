import { createSession, finishSession, formatSchedule, generateRemaining } from './public-api';
import type { Session } from './public-api';
import { americanoConfig, roster } from './test-support/session-fixtures';

/*
 * `formatSchedule` exists to be read by a human, not asserted on by a suite (ticket #4): the
 * fairness properties it helps you eyeball are the validator's job, and every other spec in
 * this library holds the engine to `assertSessionValid`.
 *
 * So these tests pin nothing about the text itself — no layout, no wording, no substrings. They
 * check only that rendering survives the session shapes a developer will point it at, including
 * the ones the scheduler cannot produce yet, and that it produces something to read. That leaves
 * the format free to change without breaking anything.
 */
describe('formatSchedule', () => {
  const renders = (session: Session): boolean => formatSchedule(session).length > 0;

  it.each([1, 2, 3])('renders a generated schedule on %i court(s)', (courtCount) => {
    const session = generateRemaining(
      createSession(americanoConfig({ courtCount, roundCount: 7 })),
    );

    expect(renders(session)).toBe(true);
  });

  it('renders a session whose rounds are still ungenerated', () => {
    expect(renders(createSession(americanoConfig()))).toBe(true);
  });

  it('renders a session that is only half generated', () => {
    const generated = generateRemaining(createSession(americanoConfig({ roundCount: 4 })));
    const halfPlayed: Session = {
      ...generated,
      rounds: generated.rounds.map((round) =>
        round.number > 2 ? { ...round, matches: [] } : round,
      ),
    };

    expect(renders(halfPlayed)).toBe(true);
  });

  it('renders a session the organizer has finished', () => {
    expect(renders(finishSession(generateRemaining(createSession(americanoConfig()))))).toBe(true);
  });

  // The scheduler is exact-fit for now (ADR-0004), so a benched session has to be hand-built.
  // The renderer is held to the awkward rosters of build-order step 1 regardless, because the
  // whole point of printing a schedule is to notice what a validator cannot.
  it('renders a roster that leaves players on the bench', () => {
    const players = roster(11);
    const benched: Session = {
      id: 'awkward',
      mode: 'americano',
      status: 'in-progress',
      roster: players,
      courtCount: 2,
      targetScore: 24,
      rounds: [
        {
          id: 'awkward:r1',
          number: 1,
          matches: [
            {
              id: 'awkward:r1:c1',
              courtNumber: 1,
              sideA: [players[0].id, players[1].id],
              sideB: [players[2].id, players[3].id],
            },
            {
              id: 'awkward:r1:c2',
              courtNumber: 2,
              sideA: [players[4].id, players[5].id],
              sideB: [players[6].id, players[7].id],
            },
          ],
        },
      ],
    };

    expect(renders(benched)).toBe(true);
  });
});
