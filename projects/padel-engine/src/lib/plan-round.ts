/*
 * Planning one round: who sits out, who partners whom, and which pair faces which.
 *
 * The three questions are not equal, and the difference is the whole design (ticket #5).
 *
 *   - **Who sits out is structural.** The bench always falls on players who have sat out fewest,
 *     so bench counts can never drift more than one apart — not merely by the end of the session,
 *     but after every single round. That is a property of the rule rather than of the search:
 *     benching only minimum-count players keeps the maximum at most one above the minimum.
 *   - **Who partners whom is a cost.** Partner repeats are minimised, not forbidden. Eleven
 *     players on two courts is an over-constrained system — treat repeats as a hard rule and the
 *     generator fails to schedule at all, which helps nobody standing on a court.
 *   - **Which pair faces which is a smaller cost**, settled once the pairs are known.
 *
 * Between the first two there is slack: when six players have all sat out twice and three of them
 * must sit out again, *which* three is free. The planner spends that slack on the second question,
 * trying bench sets in a fixed order until one admits a round with no partner repeats. Bench
 * fairness is never traded away for partner variety — it is what buys it.
 *
 * Every tie is broken by enumeration order, so the plan is a function of the roster order and the
 * history alone. No clock, no random source (decision #6).
 */
import type { PlayerId } from './model';
import type { SessionHistory } from './session-history';
import { PLAYERS_PER_COURT } from './session-shape';

export type Pair = readonly [PlayerId, PlayerId];

/** One court's worth of a planned round, before it is given an id and a court number. */
export interface PlannedMatch {
  readonly sideA: Pair;
  readonly sideB: Pair;
}

/**
 * The cost of a partnership that would leave someone without a partner they have never had.
 * Far above any total a round of ordinary repeats could reach, so the search only ever chooses
 * one when no alternative exists at all.
 */
const STARVING_REPEAT = 1_000_000;

/**
 * How many search steps a round may spend before it settles for the best plan found so far.
 *
 * The pairing search is exhaustive with pruning and normally lands on a repeat-free round in a few
 * dozen steps; the budget exists for the rare late round where none exists and the search would
 * otherwise enumerate every pairing of sixteen players. A plan is always produced — the budget is
 * consulted only once there is something to fall back on — and the cut-off is a fixed step count
 * rather than a time limit, so it cannot make a schedule depend on how fast the machine is.
 */
const SEARCH_BUDGET = 50_000;

interface Budget {
  spent: number;
}

export function planRound(
  order: readonly PlayerId[],
  courtCount: number,
  history: SessionHistory,
): PlannedMatch[] {
  const benchSize = order.length - courtCount * PLAYERS_PER_COURT;
  const budget: Budget = { spent: 0 };
  let best: { pairs: Pair[]; cost: number } | undefined;

  for (const benched of benchSets(order, history, benchSize)) {
    const playing = order.filter((id) => !benched.has(id));
    const candidate = choosePairs(playing, order, history, budget);

    if (!best || candidate.cost < best.cost) {
      best = candidate;
    }
    // A repeat-free round is as good as a round can be, so there is nothing left to look for.
    if (best.cost === 0 || budget.spent > SEARCH_BUDGET) {
      break;
    }
  }

  // `benchSets` always yields at least one set, so a plan always exists by here. Court assignment
  // gets a budget of its own: it searches a handful of pairs, never the whole roster.
  return assignCourts(best?.pairs ?? [], history, { spent: 0 });
}

/**
 * Every bench of the right size that keeps bench counts within one of each other, in a fixed
 * order: players who have sat out fewest first, ties in roster order.
 *
 * Anyone below the cut-off count *must* sit out — that is what makes the spread structural. The
 * choice is only ever among the players tied at the cut-off, and it is that choice the planner
 * spends on partner variety.
 */
function* benchSets(
  order: readonly PlayerId[],
  history: SessionHistory,
  benchSize: number,
): Generator<ReadonlySet<PlayerId>> {
  if (benchSize === 0) {
    yield new Set();
    return;
  }

  // Roster position is the tie-break, and it is what makes bench selection reproducible, so it
  // is looked up rather than searched for.
  const position = new Map(order.map((id, index) => [id, index]));
  const byBench = [...order].sort(
    (a, b) =>
      history.benchCount(a) - history.benchCount(b) ||
      (position.get(a) ?? 0) - (position.get(b) ?? 0),
  );
  const cutOff = history.benchCount(byBench[benchSize - 1]);
  const forced = order.filter((id) => history.benchCount(id) < cutOff);
  const tied = order.filter((id) => history.benchCount(id) === cutOff);

  yield* combinations(tied, benchSize - forced.length, (chosen) => new Set([...forced, ...chosen]));
}

/** Every `size`-subset of `items`, in enumeration order, mapped as it is produced. */
function* combinations<T>(
  items: readonly PlayerId[],
  size: number,
  map: (chosen: readonly PlayerId[]) => T,
): Generator<T> {
  const chosen: PlayerId[] = [];

  function* pick(from: number): Generator<T> {
    if (chosen.length === size) {
      yield map(chosen);
      return;
    }

    for (let index = from; index < items.length; index++) {
      chosen.push(items[index]);
      yield* pick(index + 1);
      chosen.pop();
    }
  }

  yield* pick(0);
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
  budget: Budget,
): { pairs: Pair[]; cost: number } {
  const found = cheapestPairing(partnerCosts(playing, available, history), mostConstrained, budget);

  return {
    pairs: found.pairs.map(([a, b]) => [playing[a], playing[b]] as Pair),
    cost: found.cost,
  };
}

/**
 * The cheapest way to pair up everything in a cost matrix: a backtracking search that abandons
 * any branch already dearer than the best complete answer it has, and stops outright once it
 * finds one that costs nothing.
 *
 * Both of a round's pairings are this same search over a different matrix — players into
 * partnerships, then partnerships onto courts. Only `chooseNext` differs, and it is what decides
 * whose choice is made while choices still exist. Ties everywhere else go to the lowest index, so
 * the answer is a function of the matrix alone.
 */
function cheapestPairing(
  costs: readonly number[][],
  chooseNext: (taken: readonly boolean[], costs: readonly number[][]) => number,
  budget: Budget,
): { pairs: [number, number][]; cost: number } {
  const taken = costs.map(() => false);
  const chosen: [number, number][] = [];
  let best: [number, number][] = [];
  let bestCost = Number.POSITIVE_INFINITY;

  const search = (cost: number): void => {
    budget.spent++;
    // The budget is consulted only once there is an answer to fall back on, so a plan is
    // always produced however tight it is.
    if (cost >= bestCost || (best.length > 0 && budget.spent > SEARCH_BUDGET)) {
      return;
    }

    const next = chooseNext(taken, costs);
    if (next === -1) {
      bestCost = cost;
      best = [...chosen];
      return;
    }

    taken[next] = true;
    for (const other of cheapestFirst(next, taken, costs)) {
      taken[other] = true;
      chosen.push([next, other]);
      search(cost + costs[next][other]);
      chosen.pop();
      taken[other] = false;

      if (bestCost === 0) {
        break;
      }
    }
    taken[next] = false;
  };

  search(0);

  return { pairs: best, cost: bestCost };
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
): number[][] {
  return playing.map((a) =>
    playing.map((b) =>
      a === b
        ? 0
        : history.partnerCount(a, b) +
          (history.starvesAPartner(a, b, available) ? STARVING_REPEAT : 0),
    ),
  );
}

/** The unpaired player with fewest free partners they have never played with; ties by order. */
function mostConstrained(taken: readonly boolean[], costs: readonly number[][]): number {
  let bestIndex = -1;
  let fewest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < taken.length; index++) {
    if (taken[index]) {
      continue;
    }

    const free = costs[index].filter(
      (cost, other) => other !== index && !taken[other] && cost === 0,
    ).length;
    if (free < fewest) {
      fewest = free;
      bestIndex = index;
    }
  }

  return bestIndex;
}

/** The still-unpaired candidates for this one, cheapest first, ties by order. */
function cheapestFirst(
  item: number,
  taken: readonly boolean[],
  costs: readonly number[][],
): number[] {
  const free: number[] = [];
  for (let index = 0; index < taken.length; index++) {
    if (!taken[index]) {
      free.push(index);
    }
  }

  return free.sort((a, b) => costs[item][a] - costs[item][b] || a - b);
}

/** The lowest unpaired index — no heuristic, because court assignment needs none. */
function inOrder(taken: readonly boolean[]): number {
  return taken.indexOf(false);
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
