/*
 * How often two players have been paired — as partners in the scheduler's history, as opponents
 * in the court search, or as partners again in the validator's prefix walk.
 *
 * All three want the same thing: a count against an unordered pair of players. Keeping the key
 * in one place is what stops "a|b" and "b|a" ever being counted as two different things.
 */
import type { PlayerId } from './model';

export class PairTally {
  private readonly counts = new Map<string, number>();

  count(a: PlayerId, b: PlayerId): number {
    return this.counts.get(key(a, b)) ?? 0;
  }

  /** Record one more occurrence of this pair and return the new count. */
  increment(a: PlayerId, b: PlayerId): number {
    const next = this.count(a, b) + 1;
    this.counts.set(key(a, b), next);

    return next;
  }
}

function key(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
