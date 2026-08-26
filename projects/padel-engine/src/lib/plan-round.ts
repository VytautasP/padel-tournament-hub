/*
 * Planning one round of Americano or Mixicano: who sits out, who partners whom, and which pair
 * faces which.
 *
 * The three questions are not equal, and the difference is the whole design (ticket #5).
 *
 *   - **Who sits out is structural**, and `bench-sets.ts` owns it: the bench falls on whoever has
 *     sat out fewest, so counts can never drift more than one apart at any prefix.
 *   - **Who partners whom is a cost.** Partner repeats are minimised, not forbidden. Eleven
 *     players on two courts is an over-constrained system — treat repeats as a hard rule and the
 *     generator fails to schedule at all, which helps nobody standing on a court.
 *   - **Which pair faces which is a smaller cost**, settled once the pairs are known.
 *
 * The planner spends the slack the bench rule leaves on the second question, trying bench sets in
 * a fixed order until one admits a round with no partner repeats. Bench fairness is never traded
 * away for partner variety — it is what buys it.
 *
 * Every tie is broken by enumeration order, so the plan is a function of the roster order and the
 * history alone. No clock, no random source (decision #6).
 */
import { benchSets } from './bench-sets';
import type { MixedPairing } from './mixed-pairing';
import type { PlayerId } from './model';
import {
  cheapestPairing,
  inOrder,
  mostConstrained,
  SEARCH_BUDGET,
  STARVING_REPEAT,
} from './pairing-search';
import type { Budget } from './pairing-search';
import type { SessionHistory } from './session-history';
import { PLAYERS_PER_COURT } from './session-shape';

export type Pair = readonly [PlayerId, PlayerId];

/** One court's worth of a planned round, before it is given an id and a court number. */
export interface PlannedMatch {
  readonly sideA: Pair;
  readonly sideB: Pair;
}

/*
 * The cost function, in priority order.
 *
 * These are not weights to be tuned against each other — the gaps between them are wide enough
 * that each term is only ever a tie-break among plans equal on every term above it. That is what
 * lets the referee assert them one at a time: a round never buys a cheaper repeat with an extra
 * same-gender pair, because no number of repeats reaches the price of one.
 *
 *   1. `SAME_GENDER_PAIR` — Mixicano forms one only when the arithmetic on court forces it
 *      (decision #7), so the search minimises their count before it considers anything else.
 *   2. `STARVING_REPEAT` — a repeat that leaves someone without a partner they have never had.
 *   3. `UNROTATED` — how far the players being compromised are from the least-compromised ones.
 *      A rank, not a raw count, so its total is bounded by the roster size rather than by how
 *      long the evening has run, and cannot creep up into the band above it.
 *   4. Ordinary partner repeats, at face value.
 */
const SAME_GENDER_PAIR = 10_000_000_000;
const UNROTATED = 10_000;

export function planRound(
  order: readonly PlayerId[],
  courtCount: number,
  history: SessionHistory,
  mixed: MixedPairing,
): PlannedMatch[] {
  const benchSize = order.length - courtCount * PLAYERS_PER_COURT;
  const budget: Budget = { spent: 0 };
  const rotation = history.compromiseRanks(order);
  let best: { pairs: Pair[]; cost: number } | undefined;

  for (const benched of benchSets(order, (id) => history.benchCount(id), benchSize)) {
    const playing = order.filter((id) => !benched.has(id));
    const candidate = choosePairs(playing, order, history, { mixed, rotation }, budget);

    if (!best || candidate.cost < best.cost) {
      best = candidate;
    }
    // A repeat-free, fully mixed round is as good as a round can be — nothing left to look for.
    if (best.cost === 0 || budget.spent > SEARCH_BUDGET) {
      break;
    }
  }

  // `benchSets` always yields at least one set, so a plan always exists by here. Court assignment
  // gets a budget of its own: it searches a handful of pairs, never the whole roster.
  return assignCourts(best?.pairs ?? [], history, { spent: 0 });
}

/**
 * Split the round's players into partnerships, minimising repeats.
 *
 * A branch-and-bound over every way to pair the players up, ordered so that the answer usually
 * falls out of the first branch: the *most constrained* player — the one with fewest
 * never-partnered players left to pair with — is matched first, and their cheapest partner is
 * tried first. Taking the scarce choices while they still exist is what stops the search painting
 * itself into a corner six rounds later, and it is what lets an eleven-player roster schedule
 * cleanly at all.
 */
function choosePairs(
  playing: readonly PlayerId[],
  available: readonly PlayerId[],
  history: SessionHistory,
  mixing: Mixing,
  budget: Budget,
): { pairs: Pair[]; cost: number } {
  const found = cheapestPairing(
    partnerCosts(playing, available, history, mixing),
    mostConstrained,
    budget,
  );

  return {
    pairs: found.pairs.map(([a, b]) => [playing[a], playing[b]] as Pair),
    cost: found.cost,
  };
}

/**
 * What pairing each two players would cost, worked out once per candidate round.
 *
 * `available` is everyone the round could have scheduled, benched players included: whether a
 * partnership starves someone is a question about who is still in the session to be partnered,
 * not about who happens to be on court this round.
 */
function partnerCosts(
  playing: readonly PlayerId[],
  available: readonly PlayerId[],
  history: SessionHistory,
  { mixed, rotation }: Mixing,
): number[][] {
  // In Mixicano a player's partners come from the other gender, so that is who a repeat is
  // judged against. Counting the empty column under a partner they can only be paired with when
  // the roster forces it would condemn every ordinary mixed pairing from the first rotation on.
  const eligible = (player: PlayerId, other: PlayerId): boolean => !mixed.sameGender(player, other);

  return playing.map((a) =>
    playing.map((b) => {
      if (a === b) {
        return 0;
      }
      if (mixed.sameGender(a, b)) {
        // A same-gender pair is the compromise, so it is priced as one: the cost of making it at
        // all, plus how far down the rotation the two players carrying it are. Partner repeats
        // still count, so the surplus does not fall to the same two people twice over.
        return (
          SAME_GENDER_PAIR +
          UNROTATED * ((rotation.get(a) ?? 0) + (rotation.get(b) ?? 0)) +
          history.partnerCount(a, b)
        );
      }

      return (
        history.partnerCount(a, b) +
        (history.starvesAPartner(a, b, available, eligible) ? STARVING_REPEAT : 0)
      );
    }),
  );
}

/** The gender rule for this session, and this round's rotation order for carrying its compromise. */
interface Mixing {
  readonly mixed: MixedPairing;
  readonly rotation: ReadonlyMap<PlayerId, number>;
}

/**
 * Put two pairs on each court, minimising how often the same players face each other. The pairs
 * are already settled by here, so this only decides who faces whom.
 */
function assignCourts(
  pairs: readonly Pair[],
  history: SessionHistory,
  budget: Budget,
): PlannedMatch[] {
  const costs = pairs.map((sideA) =>
    pairs.map((sideB) => (sideA === sideB ? 0 : opponentCost(sideA, sideB, history))),
  );

  return cheapestPairing(costs, inOrder, budget).pairs.map(([sideA, sideB]) => ({
    sideA: pairs[sideA],
    sideB: pairs[sideB],
  }));
}

/** How often these four have already met across the net. */
function opponentCost(sideA: Pair, sideB: Pair, history: SessionHistory): number {
  let cost = 0;
  for (const a of sideA) {
    for (const b of sideB) {
      cost += history.opponentCount(a, b);
    }
  }

  return cost;
}
