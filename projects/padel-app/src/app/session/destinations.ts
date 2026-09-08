/*
 * The places a session offers, and the one fact that changes between the two shapes it wears
 * (ADR-0016 §1, amended by ADR-0022 §2).
 *
 * Under the thumb there are three: Round, Standings, Players. At the desk there are two, because
 * the standings are an aside that never leaves and a destination that changed nothing when it was
 * tapped is a defect found within a minute — what ADR-0016 claimed, the table never more than one
 * move away, is honoured harder by an aside than by a tab.
 *
 * It is one list in one file because two shells navigate by it: the organizer's, and the
 * spectator's (ADR-0026 §2). Two copies of "Standings is not a destination at the desk" is one
 * copy of it too many.
 */
import { copy } from '../copy/copy';

/** The three panels a session shell holds. Not the same list as the destinations. */
export type Panel = 'round' | 'standings' | 'players';

/** One place the navigation offers: what it is called, and the panel it shows. */
export interface Destination {
  readonly id: Panel;
  readonly label: string;
}

const ROUND: Destination = { id: 'round', label: copy.session.round };
const STANDINGS: Destination = { id: 'standings', label: copy.session.standings };
const PLAYERS: Destination = { id: 'players', label: copy.session.players };

/** The destinations there are at this tier — two at the desk, three under a thumb. */
export function destinationsAt(atDesk: boolean): readonly Destination[] {
  return atDesk ? [ROUND, PLAYERS] : [ROUND, STANDINGS, PLAYERS];
}

/**
 * The panel actually on screen, given the one that was asked for.
 *
 * Derived rather than clamped on the way in, because the tier moves underneath it. A reader
 * standing on the Standings tab who drags the window past 1280 has just lost the destination they
 * were on. The table is not gone — it is in the aside beside them — so the main area falls back to
 * the round rather than to a panel with no way back to it.
 */
export function panelAt(atDesk: boolean, asked: Panel): Panel {
  return atDesk && asked === 'standings' ? 'round' : asked;
}
