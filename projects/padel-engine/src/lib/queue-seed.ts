/*
 * Giving a newcomer a place in a fairness queue.
 *
 * The engine keeps two counts per player that fairness is measured against: how often they have
 * sat on the bench, and how often they have been the one put in a same-gender pair. Both are
 * queues — the planner spends the next one on whoever carries least — and both face the same
 * question when the roster moves under the evening (decision #5): what does a player who arrives
 * in round six start on?
 *
 * Not zero, which would make them the next in line for a bench they have not sat on and a
 * compromise they have not carried. Not the number of rounds they missed either, which would make
 * the schedule owe them. **The floor of the players they are compared against** — they join the
 * queue level with whoever is at the front of it, which leaves the spread where it was and
 * compensates nobody for an absence.
 *
 * Who "the players they are compared against" are is the caller's business: everyone available,
 * for the bench; only the players of their own gender, for the compromise, since the other gender
 * were never candidates to carry it. That is the whole of the difference, so it is the whole of
 * the parameter.
 *
 * The scheduler seeds as it walks and the referee seeds as it re-walks, and they must agree to
 * the number or a session the generator produced would fail its own referee. Which is why this
 * lives in one file rather than in each of them.
 */
export function seedAtFloor<Id extends string>(
  counts: Map<Id, number>,
  // A player or a team, depending on which queue this is: all it needs is the id.
  available: readonly { readonly id: Id }[],
  compares: (a: Id, b: Id) => boolean,
): void {
  for (const entry of available) {
    if (counts.has(entry.id)) {
      continue;
    }

    // Seeded one at a time, and it makes no difference: the first newcomer is given the floor, so
    // a second one reading the map back still sees the same minimum.
    const known = available
      .filter((other) => counts.has(other.id) && compares(entry.id, other.id))
      .map((other) => counts.get(other.id) ?? 0);

    counts.set(entry.id, known.length > 0 ? Math.min(...known) : 0);
  }
}

/**
 * Take out of a queue everyone who is not in this round, so that a unit which comes back rejoins
 * it at the floor rather than at the count it left on.
 *
 * Only Team Americano ever has a unit come back: a team orphaned in round two and repaired in
 * round five (decision #2b) is away for the rounds in between, and the counts it left behind are
 * a record of an evening that carried on without it. Resuming on them would put it two byes
 * behind everybody and make the spread rule fail on a round nobody scheduled badly. So a return
 * is seeded exactly as an arrival is, by the same argument and the same code — it is compensated
 * for nothing and it owes nothing.
 *
 * A player who leaves never returns, so for the other modes this only ever forgets counts nobody
 * reads again.
 */
export function forgetAbsent<Id extends string>(
  counts: Map<Id, number>,
  available: readonly { readonly id: Id }[],
): void {
  const here = new Set(available.map((unit) => unit.id));
  for (const id of [...counts.keys()]) {
    if (!here.has(id)) {
      counts.delete(id);
    }
  }
}

/** Everyone counts against everyone — the bench queue, where nobody was ever ineligible. */
export function everyone(): boolean {
  return true;
}
