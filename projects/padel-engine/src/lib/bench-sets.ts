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
