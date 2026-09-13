/*
 * The shape of the evening, at the seam where the progress bar's segments are decided.
 *
 * ADR-0035's PRD (#79) chose to ship this function without a spec and said plainly that it was the
 * one place that decision had a real cost: the edge cases are exactly the ones a reviewer does not
 * catch by reading, and the fix it named if any of them miscounted was a spec beside
 * `podium.spec.ts`. It is four assertions, so it is written up front rather than after an evening
 * gets it wrong.
 *
 * Every case here is a round the obvious template would get wrong. A bar that counted scored
 * matches against the session's court count would call a bye round complete while a court was
 * still playing; one that counted rounds against the round count would call a round holding no
 * matches at all complete before anybody had walked onto it. So the count each round is measured
 * against is its own.
 */
import { roundProgress } from './round-progress';
import type { Match, Round, Session } from 'padel-engine';

describe('the shape of the evening', () => {
  it('is one entry per generated round, in the order they are played', () => {
    const progress = roundProgress(sessionOf([['scored'], ['unscored'], ['unscored']]));

    expect(progress.map((round) => round.number)).toEqual([1, 2, 3]);
  });

  it('calls a round complete only once every court on it has a score', () => {
    const progress = roundProgress(
      sessionOf([
        ['scored', 'scored'],
        ['scored', 'unscored'],
      ]),
    );

    expect(statesOf(progress)).toEqual(['complete', 'partial']);
  });

  it('calls a round nobody has scored untouched', () => {
    expect(statesOf(roundProgress(sessionOf([['unscored', 'unscored']])))).toEqual(['untouched']);
  });

  it('measures a round against its own courts, so a bye does not read as complete', () => {
    // Three courts in round 1, two in round 2 because a team is on a bye. Both of round 2's are
    // scored; counting either round against the session's court count would call round 1 complete
    // with a court still playing, or round 2 short of one it never had.
    const progress = roundProgress(
      sessionOf([
        ['scored', 'scored', 'unscored'],
        ['scored', 'scored'],
      ]),
    );

    expect(statesOf(progress)).toEqual(['partial', 'complete']);
  });

  it('calls a round holding no matches untouched rather than complete', () => {
    // Vacuously "every match scored" — which is how a template arrives at complete for a round
    // that has not been scheduled at all. `currentRoundNumber` already guards the same case.
    expect(statesOf(roundProgress(sessionOf([['scored'], []])))).toEqual(['complete', 'untouched']);
  });

  it('grows by one when a round is added mid-evening, and the new round is untouched', () => {
    const before = sessionOf([['scored'], ['scored']]);
    const after = sessionOf([['scored'], ['scored'], ['unscored']]);

    expect(statesOf(roundProgress(before))).toEqual(['complete', 'complete']);
    expect(statesOf(roundProgress(after))).toEqual(['complete', 'complete', 'untouched']);
  });

  it('numbers the segments from the rounds rather than from their position in the list', () => {
    // A fixture ledger that restarted after a team was orphaned (ADR-0012) regenerates the
    // remainder, and the round a segment stands for is the round's own number.
    const session = sessionOf([['scored'], ['unscored'], ['unscored']]);
    const restarted: Session = { ...session, rounds: session.rounds.slice(1) };

    expect(roundProgress(restarted).map((round) => round.number)).toEqual([2, 3]);
  });
});

/** One session whose rounds hold exactly the courts described, scored or not. */
function sessionOf(rounds: readonly (readonly ('scored' | 'unscored')[])[]): Session {
  return {
    id: 'S',
    mode: 'americano',
    status: 'in-progress',
    roster: [],
    courtCount: 3,
    targetScore: 24,
    rounds: rounds.map((courts, index): Round => ({
      id: `r${index + 1}`,
      number: index + 1,
      matches: courts.map((court, courtIndex): Match => matchOf(court, courtIndex + 1)),
    })),
  };
}

function matchOf(court: 'scored' | 'unscored', courtNumber: number): Match {
  const players = ['a', 'b', 'c', 'd'] as const;

  return {
    id: `m${courtNumber}`,
    courtNumber,
    sideA: [players[0], players[1]],
    sideB: [players[2], players[3]],
    ...(court === 'scored' ? { score: { sideA: 14, sideB: 10 } } : {}),
  };
}

function statesOf(progress: ReturnType<typeof roundProgress>): string[] {
  return progress.map((round) => round.state);
}
