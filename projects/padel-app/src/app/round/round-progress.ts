/*
 * The shape of the whole evening, one entry per generated round (ADR-0035 §2, move 2).
 *
 * The Modern round header carries a segmented bar above the paging, so that how much padel is
 * left reads at arm's length without anybody paging through it. This is what each segment says.
 *
 * It is a module beside `currentRoundNumber`, `podiumOf` and the bench derivation rather than a
 * computed signal in the round board, and for the same reason all three of those are: the
 * derivation is exactly what a template loop gets wrong by accident. A bar that counted scored
 * matches against the session's court count would call a round containing a **bye** complete while
 * a court on it was still playing; one that counted rounds against the round count would call a
 * round holding **no matches at all** complete before anybody had walked onto it. So a round is
 * measured against its own courts, and a round with none of them is untouched rather than
 * vacuously finished — which is the case `currentRoundNumber` already has to guard.
 *
 * A round **added mid-evening** (ADR-0016 §4) is a round like any other and arrives as one more
 * untouched segment, which is why the bar has as many segments as the session has rounds rather
 * than the seven the canvas drew. A **restarted fixture ledger** after a team was orphaned
 * (ADR-0012) regenerates the remainder, so each segment stands for the round's own number rather
 * than for its position in the list.
 *
 * It is deliberately not told which round is current. That is `currentRoundNumber`'s job and it is
 * derived on every read precisely so that correcting a typo in round 2 moves the evening back to
 * round 2; duplicating the notion here would give the app two answers to one question.
 */
import type { Session } from 'padel-engine';

/** How much of one round has been played: all of it, some of it, or none of it. */
export type RoundState = 'complete' | 'partial' | 'untouched';

/** One segment of the bar: the round it stands for, and how far through that round the evening is. */
export interface RoundProgress {
  readonly number: number;
  readonly state: RoundState;
}

export function roundProgress(session: Session): readonly RoundProgress[] {
  return session.rounds.map((round) => {
    const scored = round.matches.filter((match) => match.score !== undefined).length;

    return { number: round.number, state: stateOf(scored, round.matches.length) };
  });
}

function stateOf(scored: number, courts: number): RoundState {
  // A round with no courts is untouched, not complete. `scored === courts` is true of it, which is
  // the whole trap: a round nobody could have played is not a round everybody has.
  if (courts === 0 || scored === 0) {
    return 'untouched';
  }

  return scored === courts ? 'complete' : 'partial';
}
