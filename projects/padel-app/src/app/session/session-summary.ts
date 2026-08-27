/*
 * An ended evening, reduced to the line a history row shows (ADR-0013 §4).
 *
 * There is no name field in the wizard, so a row has to name itself out of what the evening
 * already knows: the day it was played, the format it played, how many played it, and who came
 * top. That is enough to pick last Tuesday out of a list of Tuesdays, and it costs the organizer
 * nothing at creation.
 *
 * The winner is read off the final table rather than stored beside it, for the same reason the
 * table itself is derived (ADR-0008): there is one answer to "who won", and it is whatever the
 * engine says about the recorded scores. Where the top place is joint, every name in it is a
 * winner — the app does not break a tie the engine declared (decision #8).
 */
import type { Standing } from 'padel-engine';
import { copy, formatDay } from '../copy/copy';
import type { SessionRecord } from './session-record';

export interface SessionSummary {
  /** What Delete and Open are addressed to. A row is a session, and a session is its id. */
  readonly sessionId: string;
  /** `Wed 26 Aug · Americano · 11 players`. */
  readonly title: string;
  /**
   * Who topped the final table, or empty for an evening that ended with nothing scored.
   *
   * Empty rather than everybody: with no scores every player is joint first on nothing, and a row
   * claiming eleven winners would be reporting an artefact of the ranking as a result.
   */
  readonly winners: readonly string[];
}

export function summarise(record: SessionRecord, standings: readonly Standing[]): SessionSummary {
  return {
    sessionId: record.session.id,
    // The day the evening was played, which is `createdAt` — a night that ran past midnight is
    // still Tuesday's padel. `endedAt` says when it was closed, and that is what orders the list.
    title: copy.history.row(
      formatDay(record.createdAt),
      record.session.mode,
      record.session.roster.length,
    ),
    winners: standings
      .filter((standing) => standing.position === 1 && standing.matchesPlayed > 0)
      .map((standing) => standing.name),
  };
}
