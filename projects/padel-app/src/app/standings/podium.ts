/*
 * The top of a final table, as the podium block shows it (ADR-0016 §6).
 *
 * It is a filter and nothing else: the podium is the standings, so anything cleverer here would be
 * the app forming a second opinion about an order the engine already settled. In particular it
 * neither renumbers nor separates — a joint first is two players at position 1 and the podium says
 * so, because the engine declared that tie on the evidence and stopped (decision #8), and a screen
 * that picked one of them as the winner would be inventing the evidence it did not have.
 *
 * Positions rather than a count of rows is what makes that work. Taking the first three lines
 * would cut a joint third in half and would drop a name off a podium two players are sharing the
 * top of; taking every line placed third or better keeps whoever the places actually belong to.
 *
 * A player who has not been on a scored court is not on it either, however high the ranking puts
 * them. An evening can be ended with nothing scored — ADR-0009 finishes an abandoned session as
 * readily as a complete one — and every player is then joint first on nothing, which would put the
 * whole roster on a podium and call it a result.
 */
import type { Standing } from 'padel-engine';

/** How far down the table a podium reaches. Third place is on it; fourth is in the table below. */
const LAST_PLACE_ON_THE_PODIUM = 3;

export function podiumOf(standings: readonly Standing[]): readonly Standing[] {
  return standings.filter(
    (standing) => standing.position <= LAST_PLACE_ON_THE_PODIUM && standing.matchesPlayed > 0,
  );
}
