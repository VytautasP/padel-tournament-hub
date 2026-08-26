/*
 * What the session has already done to the people in it: who has partnered whom, who has faced
 * whom, and how often each player has sat out.
 *
 * The scheduler builds this up round by round as it walks the session — carried-through rounds
 * count exactly as much as ones it generates itself, which is what makes the search history-aware
 * rather than a function of the round number. Because it is accumulated in round order, every
 * question it answers is a question about the session *so far*, and that is what lets fairness be
 * decided at each prefix instead of only over a finished evening (decision #6).
 *
 * The roster moves while that walk is happening (decision #5), and both of the questions above
 * change shape when it does:
 *
 *   - **A late arrival's bench count starts at the current floor**, not at zero and not at the
 *     number of rounds they were absent for. Counting the rounds before they got here would make
 *     the planner see someone owed five matches and put them on court every remaining round; zero
 *     would make them the next in line for the bench they have not yet sat on. The floor is
 *     neither: they join the queue level with whoever is at the front of it, so the spread stays
 *     within one and nobody is compensated for an absence.
 *   - **A partnership is only a repeat against the players who were here as long.** Judging a
 *     repeat against someone who arrived two rounds ago would condemn every pairing on the court,
 *     since one late arrival can absorb only one partnership a round.
 */
import type { Match, PlayerId, RosterEntry, Round } from './model';
import { PairTally } from './pair-tally';
import { isAvailableIn, joinedAtRound } from './roster-availability';

export class SessionHistory {
  private readonly partners = new PairTally();
  private readonly opponents = new PairTally();
  private readonly bench = new Map<PlayerId, number>();
  private readonly joinedAt: ReadonlyMap<PlayerId, number>;

  constructor(private readonly roster: readonly RosterEntry[]) {
    this.joinedAt = new Map(roster.map((entry) => [entry.id, joinedAtRound(entry)]));
  }

  /** Fold one round in: its partnerships, its opponents, and a bench mark for everyone else. */
  record(round: Round): void {
    const available = this.roster.filter((entry) => isAvailableIn(entry, round.number));
    this.admit(available);

    const playing = new Set<PlayerId>();

    for (const match of round.matches) {
      for (const side of [match.sideA, match.sideB]) {
        this.partners.increment(side[0], side[1]);
      }
      for (const a of match.sideA) {
        for (const b of match.sideB) {
          this.opponents.increment(a, b);
        }
      }
      for (const id of playersOf(match)) {
        playing.add(id);
      }
    }

    for (const entry of available) {
      if (!playing.has(entry.id)) {
        this.bench.set(entry.id, this.benchCount(entry.id) + 1);
      }
    }
  }

  benchCount(id: PlayerId): number {
    return this.bench.get(id) ?? 0;
  }

  partnerCount(a: PlayerId, b: PlayerId): number {
    return this.partners.count(a, b);
  }

  opponentCount(a: PlayerId, b: PlayerId): number {
    return this.opponents.count(a, b);
  }

  /**
   * Would partnering these two starve someone of a partner they have never had?
   *
   * This is the referee's partner-variety rule (`assertSessionValid`) asked forwards instead of
   * backwards: pairing two players for the `k + 1`th time is only fair once both of them have
   * partnered everyone else at least `k` times. Answering it here — before the pair is committed
   * — is what lets the search treat "no partnership repeats while any player still has an
   * unplayed partner" as something to avoid rather than something to be caught doing.
   *
   * "Everyone else" is `available`, the players this round could schedule, and only those of them
   * who have been here at least as long as the partner in question. A player who arrived after
   * that partner did has had fewer rounds to be paired with, so their empty column is a fact
   * about when they turned up rather than evidence of an unfair pairing.
   */
  starvesAPartner(a: PlayerId, b: PlayerId, available: readonly PlayerId[]): boolean {
    const played = this.partnerCount(a, b);
    if (played === 0) {
      return false;
    }

    return [
      [a, b],
      [b, a],
    ].some(([player, partner]) =>
      available.some(
        (other) =>
          other !== player &&
          this.joinedBy(other, partner) &&
          this.partnerCount(other, player) < played,
      ),
    );
  }

  /** Was `other` here by the time `partner` was — so did they have the same chance to be paired? */
  private joinedBy(other: PlayerId, partner: PlayerId): boolean {
    return (this.joinedAt.get(other) ?? 1) <= (this.joinedAt.get(partner) ?? 1);
  }

  /**
   * Give anyone newly available a bench count, seeded at the floor of the players already here.
   *
   * Doing it as the round is folded in, rather than at construction, is what makes it the floor
   * *at the moment they arrived* — the one number that leaves the spread within one without
   * handing them a debt the schedule would have to pay off.
   */
  private admit(available: readonly RosterEntry[]): void {
    const counts = available
      .filter((entry) => this.bench.has(entry.id))
      .map((entry) => this.benchCount(entry.id));
    const floor = counts.length > 0 ? Math.min(...counts) : 0;

    for (const entry of available) {
      if (!this.bench.has(entry.id)) {
        this.bench.set(entry.id, floor);
      }
    }
  }
}

function playersOf(match: Match): PlayerId[] {
  return [...match.sideA, ...match.sideB];
}
