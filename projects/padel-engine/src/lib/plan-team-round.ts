/*
 * Planning one round of Team Americano: which teams sit out, and which teams face which.
 *
 * The whole format is Americano shifted up one level (decision #2c), and this file is what that
 * shift costs: two questions instead of three. Who partners whom was settled at the pairing
 * screen and never moves again, so the middle question — the expensive one, the branch-and-bound
 * over every way to pair sixteen players up — simply is not asked. What is left is the bench and
 * the fixture list, and both are the rules the other planner already runs:
 *
 *   - **Who sits out is structural**, and it is `bench-sets.ts` deciding it, unchanged. With five
 *     teams on two courts a whole team sits out, and team bench counts stay within one of each
 *     other at every prefix — decision #4's even bench, one level up.
 *   - **Which teams meet is a cost**, priced the way partner repeats are priced: a rematch is
 *     minimised rather than forbidden, and a rematch that leaves either team with an opponent
 *     they have never faced costs the starvation band. Four teams over six rounds must repeat —
 *     there are only six fixtures — and the cost ordering is what makes them repeat in the right
 *     order rather than refusing to schedule.
 *
 * The slack between the two is spent the same way round: the planner tries every bench the spread
 * rule admits and keeps the cheapest fixture list. Bench fairness is never traded for variety.
 */
import { benchSets } from './bench-sets';
import type { TeamId } from './model';
import { cheapestPairing, mostConstrained, SEARCH_BUDGET, STARVING_REPEAT } from './pairing-search';
import type { Budget } from './pairing-search';
import { TEAMS_PER_COURT } from './session-shape';

/** One court's worth of a planned round, before it is given an id and a court number. */
export interface PlannedTeamMatch {
  readonly sideA: TeamId;
  readonly sideB: TeamId;
}

/**
 * What the planner needs to know about the evening so far, at team level.
 *
 * A narrow view of `SessionHistory` rather than the thing itself: what is below is all a fixture
 * list can be planned from, and saying so is what keeps this file from reaching for a
 * player-level answer to a team-level question.
 */
export interface TeamHistory {
  teamBenchCount(team: TeamId): number;
  teamsMetCount(a: TeamId, b: TeamId): number;
  /** Would meeting again leave either team with an opponent they have never faced? */
  starvesAnOpponent(a: TeamId, b: TeamId, available: readonly TeamId[]): boolean;
}

export function planTeamRound(
  order: readonly TeamId[],
  courtCount: number,
  history: TeamHistory,
): PlannedTeamMatch[] {
  const benchSize = order.length - courtCount * TEAMS_PER_COURT;
  const budget: Budget = { spent: 0 };
  let best: { pairs: PlannedTeamMatch[]; cost: number } | undefined;

  for (const benched of benchSets(order, (id) => history.teamBenchCount(id), benchSize)) {
    const playing = order.filter((id) => !benched.has(id));
    const found = cheapestPairing(meetingCosts(playing, order, history), mostConstrained, budget);
    const candidate = {
      pairs: found.pairs.map(([a, b]) => ({ sideA: playing[a], sideB: playing[b] })),
      cost: found.cost,
    };

    if (!best || candidate.cost < best.cost) {
      best = candidate;
    }
    // A round of fixtures nobody has played yet is as good as a round can be.
    if (best.cost === 0 || budget.spent > SEARCH_BUDGET) {
      break;
    }
  }

  // `benchSets` always yields at least one set, so a plan always exists by here.
  return best?.pairs ?? [];
}

/**
 * What putting each two teams across the net from each other would cost.
 *
 * `available` is every team the round could have scheduled, benched ones included: whether a
 * rematch starves anybody is a question about who is still in the session to be played, not about
 * who happens to be on court this round.
 */
function meetingCosts(
  playing: readonly TeamId[],
  available: readonly TeamId[],
  history: TeamHistory,
): number[][] {
  return playing.map((a) =>
    playing.map((b) => {
      if (a === b) {
        return 0;
      }

      return (
        history.teamsMetCount(a, b) +
        (history.starvesAnOpponent(a, b, available) ? STARVING_REPEAT : 0)
      );
    }),
  );
}
