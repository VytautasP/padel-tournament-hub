/*
 * The roster as the Players tab renders it: a name, and the two things true of it right now.
 *
 * A plain function for the same reason `round-view.ts` is one — the shape of the list can be
 * checked without rendering it — and, like that one, it derives rather than reads. Neither "is
 * sitting out" nor "has gone home" is a field on a roster entry: the first is the round's line-up
 * seen from the other side, and the second is an availability window that has closed.
 *
 * Sitting out is asked of `bench.ts`, which is the same answer the strip under the courts renders.
 * That is the whole reason that file exists: an organizer reading a strip that says Cara is out
 * and a row that does not is looking at a disagreement they cannot resolve, standing next to Cara.
 */
import type { PlayerId, Session } from 'padel-engine';
import { benchedIn, hasGoneHome } from '../session/bench';

export interface PlayerRow {
  readonly id: PlayerId;
  readonly name: string;
  /** Benched in the round the evening is on, which is the question the badge answers. */
  readonly benched: boolean;
  /** Gone home: their played matches and their standings line stay, no later round holds them. */
  readonly gone: boolean;
}

/** Every player the session knows, in roster order — including the ones who have left. */
export function rosterView(session: Session, roundNumber: number): readonly PlayerRow[] {
  const bench = new Set(benchedIn(session, roundNumber).map((entry) => entry.id));

  return session.roster.map((entry) => ({
    id: entry.id,
    name: entry.name,
    benched: bench.has(entry.id),
    gone: hasGoneHome(entry),
  }));
}
