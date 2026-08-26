/*
 * How often each two teams have met — and the one thing that makes that count mean something:
 * the field it was counted over.
 *
 * Team Americano schedules a round as a *pairing of the whole field*, not as a free choice of
 * fixtures. With four teams on two courts there are exactly three ways to split them, so meeting
 * the two teams who have never met can force a rematch between the other two. That is fine while
 * the field is the one the rotation started on: three rounds use the three splits, everybody has
 * met everybody, and repeats afterwards are honest repeats.
 *
 * It stops being fine the moment the field changes under it. Rounds played by five teams leave a
 * half-filled ledger among the four that remain (decision #2b) — some pairs met, some not — and
 * from there **no sequence of rounds can avoid a repeat while a pair is still unmet**: the split
 * that introduces the missing pair is the split that repeats another. Judged against that ledger,
 * every round the scheduler could possibly plan is unfair, which is a statement about the rule
 * rather than about the schedule.
 *
 * So the ledger restarts when the field changes. A fixture list is a rotation over a field, and a
 * team leaving or a team repaired is a new rotation over a new one: the counts before it are a
 * record of a different tournament shape, and holding the new shape to them condemns rounds
 * nobody could have planned better. It is the same answer the bench queue gives a returning team
 * — start level, owe nothing, be owed nothing — applied to the other axis.
 *
 * The scheduler counts as it walks and the referee counts as it re-walks, so both hold one of
 * these and neither keeps its own idea of when the rotation began.
 */
import type { TeamId } from './model';
import { PairTally } from './pair-tally';

export class FixtureLedger {
  private meetings = new PairTally();
  private field = '';

  /**
   * Open a round over the teams it could schedule. A field that is not the one the current count
   * was taken over starts the count again.
   */
  openRound(available: readonly { readonly id: TeamId }[]): void {
    const field = [...available.map((team) => team.id)].sort().join('|');
    if (field !== this.field) {
      this.meetings = new PairTally();
      this.field = field;
    }
  }

  /** How often these two have met since the field was last this one. */
  count(a: TeamId, b: TeamId): number {
    return this.meetings.count(a, b);
  }

  /** Record one more meeting and return the new count. */
  increment(a: TeamId, b: TeamId): number {
    return this.meetings.increment(a, b);
  }
}
