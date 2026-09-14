/*
 * Who sits out — the one structural rule in the engine, and the slack it leaves behind.
 *
 * The bench always falls on whoever has sat out fewest, so bench counts can never drift more than
 * one apart: not merely by the end of the session, but after every single round (decision #6).
 * That is a property of the rule rather than of any search — benching only minimum-count units
 * keeps the maximum at most one above the minimum, whatever else the planner does.
 *
 * Between "these must sit" and "this many must sit" there is slack: when six units have all sat
 * out twice and three of them must sit again, *which* three is free. This yields every such
 * choice in a fixed order, and the planners spend that slack on variety — never the other way
 * round. Bench fairness is what buys partner and opponent variety, and is never traded for it.
 *
 * A "unit" is a player in Americano and a whole team in Team Americano (decision #2c). The rule
 * does not change with the level, so neither does this file: it is given ids and a count, and has
 * no idea which it is rotating.
 *
 * One rule asks the question of a *partition* rather than of a list: under strict mixing the
 * genders queue separately, because three men among seven women are on court every round by
 * arithmetic and no rotation can even that out (ADR-0036 §3). `benchSetsAcross` is that shape, and
 * it is the same rule run once per queue rather than a second rule — which is what keeps a defect
 * in it from reaching an Americano evening.
 */

/**
 * Every bench of the right size that keeps bench counts within one of each other, in a fixed
 * order: units that have sat out fewest first, ties in the order they were given.
 *
 * Anyone below the cut-off count *must* sit out — that is what makes the spread structural. The
 * choice is only ever among the units tied at the cut-off.
 */
export function* benchSets<Id extends string>(
  order: readonly Id[],
  benchCount: (id: Id) => number,
  benchSize: number,
): Generator<ReadonlySet<Id>> {
  if (benchSize <= 0) {
    yield new Set();
    return;
  }

  // Position in the order is the tie-break, and it is what makes bench selection reproducible,
  // so it is looked up rather than searched for.
  const position = new Map(order.map((id, index) => [id, index]));
  const byBench = [...order].sort(
    (a, b) => benchCount(a) - benchCount(b) || (position.get(a) ?? 0) - (position.get(b) ?? 0),
  );
  const cutOff = benchCount(byBench[benchSize - 1]);
  const forced = order.filter((id) => benchCount(id) < cutOff);
  const tied = order.filter((id) => benchCount(id) === cutOff);

  yield* combinations(tied, benchSize - forced.length, (chosen) => new Set([...forced, ...chosen]));
}

/**
 * One queue of a partitioned bench: the units in it, and how many of them must sit.
 *
 * Strict mixing is the one rule that partitions the roster (ADR-0036 §3) — a woman was never a
 * candidate for the seat a man is taking, so the counts that must stay within one are the counts
 * within each gender. Every other mode hands `benchSets` a single list and is unaffected.
 */
export interface BenchQueue<Id extends string> {
  readonly order: readonly Id[];
  readonly benchSize: number;
}

/**
 * Every bench that keeps counts within one *inside each queue*: one choice from each queue, in a
 * fixed order, with the earlier queues varying slowest.
 *
 * The guarantee `benchSets` makes — that at least one set always comes out — has to hold per
 * queue rather than once, and it does, because it is made per call: each queue yields at least
 * one bench of its own size, so their product is never empty either.
 */
export function* benchSetsAcross<Id extends string>(
  queues: readonly BenchQueue<Id>[],
  benchCount: (id: Id) => number,
): Generator<ReadonlySet<Id>> {
  const [queue, ...rest] = queues;
  if (!queue) {
    yield new Set();
    return;
  }

  for (const benched of benchSets(queue.order, benchCount, queue.benchSize)) {
    for (const others of benchSetsAcross(rest, benchCount)) {
      yield new Set([...benched, ...others]);
    }
  }
}

/** Every `size`-subset of `items`, in enumeration order, mapped as it is produced. */
function* combinations<Id extends string, T>(
  items: readonly Id[],
  size: number,
  map: (chosen: readonly Id[]) => T,
): Generator<T> {
  const chosen: Id[] = [];

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
