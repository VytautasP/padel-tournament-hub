/*
 * Pairing things up as cheaply as possible — the one search both planners run.
 *
 * Three different questions in this engine have the same shape: split the players on court into
 * partnerships, put those partnerships onto courts against each other, and — in Team Americano —
 * put teams onto courts against each other. Each is "pair up everything in a cost matrix for the
 * lowest total", so each is this function over a different matrix, with a different `chooseNext`.
 *
 * What the numbers in the matrix *mean* is the caller's business, and deliberately so: this file
 * has no opinion about fairness, and the modes' cost functions stay in the planners that own them.
 * The one constant that lives here is the band both planners price starvation at, because it has
 * to mean the same thing in both — a repeat that leaves someone with a counterpart they have
 * never had costs more than any number of ordinary repeats, whether the counterpart is a partner
 * or an opposing team.
 */

/** A repeat that leaves someone without a counterpart they have never played. */
export const STARVING_REPEAT = 10_000_000;

/**
 * How many search steps a round may spend before it settles for the best plan found so far.
 *
 * The search is exhaustive with pruning and normally lands on a repeat-free round in a few dozen
 * steps; the budget exists for the rare late round where none exists and the search would
 * otherwise enumerate every pairing of sixteen players. A plan is always produced — the budget is
 * consulted only once there is something to fall back on — and the cut-off is a fixed step count
 * rather than a time limit, so it cannot make a schedule depend on how fast the machine is.
 */
export const SEARCH_BUDGET = 50_000;

export interface Budget {
  spent: number;
}

/**
 * The cheapest way to pair up everything in a cost matrix: a backtracking search that abandons
 * any branch already dearer than the best complete answer it has, and stops outright once it
 * finds one that costs nothing.
 *
 * Only `chooseNext` differs between callers, and it is what decides whose choice is made while
 * choices still exist. Ties everywhere else go to the lowest index, so the answer is a function
 * of the matrix alone.
 */
export function cheapestPairing(
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

/** The unpaired item with fewest free counterparts it has never played; ties by order. */
export function mostConstrained(taken: readonly boolean[], costs: readonly number[][]): number {
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

/** The lowest unpaired index — no heuristic, because court assignment needs none. */
export function inOrder(taken: readonly boolean[]): number {
  return taken.indexOf(false);
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
