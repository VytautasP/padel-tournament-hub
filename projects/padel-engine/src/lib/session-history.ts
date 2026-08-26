/*
 * What the session has already done to the people in it: who has partnered whom, who has faced
 * whom, and how often each player has sat out.
 *
 * The scheduler builds this up round by round as it walks the session — carried-through rounds
 * count exactly as much as ones it generates itself, which is what makes the search history-aware
 * rather than a function of the round number. Because it is accumulated in round order, every
 * question it answers is a question about the session *so far*, and that is what lets fairness be
 * decided at each prefix instead of only over a finished evening (decision #6).
 */
import type { Match, PlayerId, Round } from './model';
import { PairTally } from './pair-tally';

export class SessionHistory {
  private readonly partners = new PairTally();
  private readonly opponents = new PairTally();
  private readonly bench: Map<PlayerId, number>;

  constructor(private readonly roster: readonly PlayerId[]) {
    this.bench = new Map(roster.map((id) => [id, 0]));
  }

  /** Fold one round in: its partnerships, its opponents, and a bench mark for everyone else. */
  record(round: Round): void {
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

    for (const id of this.roster) {
      if (!playing.has(id)) {
        this.bench.set(id, this.benchCount(id) + 1);
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
   */
  starvesAPartner(a: PlayerId, b: PlayerId): boolean {
    const played = this.partnerCount(a, b);
    if (played === 0) {
      return false;
    }

    return [a, b].some((player) =>
      this.roster.some((other) => other !== player && this.partnerCount(other, player) < played),
    );
  }
}

function playersOf(match: Match): PlayerId[] {
  return [...match.sideA, ...match.sideB];
}
