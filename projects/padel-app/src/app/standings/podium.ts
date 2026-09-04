/*
 * The top of a final table, as the podium block shows it (ADR-0016 §6).
 *
 * Two things are decided here and nothing else is: who stands on the podium, and which metal each
 * of them carries. Both are read off the position the engine printed, because the podium *is* the
 * standings — anything cleverer would be the app forming a second opinion about an order the
 * engine already settled. In particular it neither renumbers nor separates: a joint first is two
 * players at position 1 and the podium says so, because the engine declared that tie on the
 * evidence and stopped (decision #8), and a screen that picked one of them as the winner would be
 * inventing the evidence it did not have.
 *
 * Positions rather than a count of rows is what makes that work. Taking the first three lines
 * would cut a joint third in half and would drop a name off a podium two players are sharing the
 * top of; taking every line placed third or better keeps whoever the places actually belong to.
 *
 * The metal follows for the same reason. It is the position's metal, not the row's — a joint first
 * is two golds and the place behind it is third, so an evening can finish with no silver on the
 * screen at all. Handing them out in the order the rows arrive would quietly award silver to the
 * second of two people who tied for gold.
 *
 * It says nothing about who the competitor is. In Team Americano the top three are pairs and the
 * same rules hold word for word (ADR-0011) — which is the whole of what "the same ladder handed
 * teams instead of players" means on this screen.
 *
 * A player who has not been on a scored court is not on it either, however high the ranking puts
 * them. An evening can be ended with nothing scored — ADR-0009 finishes an abandoned session as
 * readily as a complete one — and every player is then joint first on nothing, which would put the
 * whole roster on a podium and call it a result.
 */
import type { StandingRow } from './standing-row';

/** The three metals, in the order they are placed. */
export type Metal = 'gold' | 'silver' | 'bronze';

/** One place on the podium: a row of the table, and the metal its position carries. */
export interface PodiumPlace {
  readonly standing: StandingRow;
  readonly metal: Metal;
}

/** The metal of each place, first to third. Its length is how far down a podium reaches. */
const METALS: readonly Metal[] = ['gold', 'silver', 'bronze'];

export function podiumOf(standings: readonly StandingRow[]): readonly PodiumPlace[] {
  return standings
    .filter((standing) => standing.position <= METALS.length && standing.matchesPlayed > 0)
    .map((standing) => ({ standing, metal: METALS[standing.position - 1] }));
}
