/*
 * The roster as one card of rows: a name, and the two things true of it right now.
 *
 * It is a component with inputs and no store, because two screens show this same list about two
 * different sessions. The Players tab hands it the evening the organizer is running and takes back
 * the two changes a roster can have made to it. The spectator's route hands it an evening somebody
 * else is running and takes nothing back: `organizing` is false, so no row grows a control and
 * there is no overflow to tap. That is ADR-0026 §2's read-only, structurally — the branches that
 * render a control are not taken, and the route rendering this has nothing to write with.
 *
 * The list answers the question the organizer is asked most between rounds and cannot answer from
 * the Round tab without paging — **am I out?** — by badging whoever this round leaves off a court.
 * The badge and the bench strip are one derivation (`bench.ts`), because two of them drift the
 * first time a roster changes under a generated round. It is the same question a spectator is
 * standing there asking about themselves, which is the whole reason this tab is on their route.
 *
 * **Going home is on the row's overflow**, never on a swipe: a stray thumb at the side of a court
 * must not be able to take a player out of the evening. It is worded for what happened rather than
 * for what was done — the player keeps their played matches and their standings line, and is
 * simply not scheduled into any later round (decision #5).
 *
 * **A stranded half is flagged where the organizer is looking, and repaired there too.** When one
 * half of a Team Americano pair goes home the other cannot play, and the row that says so is the
 * row that offers Assign partner (decision #2b, ADR-0012): the fix belongs where the problem is
 * displayed. The flag itself is not a control and stays on a spectator's screen — it is a fact
 * about the evening, and the person reading it may well be the player it is about.
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { PlayerId } from 'padel-engine';
import { copy } from '../copy/copy';
import type { PlayerRow } from './roster-view';

@Component({
  selector: 'app-roster-list',
  templateUrl: './roster-list.html',
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterList {
  readonly rows = input.required<readonly PlayerRow[]>();
  /**
   * Whether the reader is the one running this evening.
   *
   * False by default, for the reason the round board's is: a screen that forgot to say gets the
   * list a spectator gets, rather than one offering to send somebody home from a night that is
   * not theirs.
   */
  readonly organizing = input(false);

  /** A player the organizer says has gone home. */
  readonly wentHome = output<PlayerRow>();
  /** A team the organizer wants to repair, named by its surviving half (decision #2b). */
  readonly partnerWanted = output<PlayerRow>();

  /** The one row whose overflow is open, if any. One at a time, like the Resume card's. */
  private readonly openRow = signal<PlayerId | null>(null);

  protected readonly copy = copy;

  protected isOpen(playerId: PlayerId): boolean {
    return this.openRow() === playerId;
  }

  /**
   * Whether this row is offering the repair for the team it is the surviving half of.
   *
   * Asked as one question rather than spelled out at each of the two places the answer is needed —
   * the button itself and the outline the row wears while it is showing one — because those two
   * disagreeing is a row drawn as open with nothing open in it.
   */
  protected canAssignPartner(row: PlayerRow): boolean {
    return this.organizing() && row.needsPartner && row.team !== null;
  }

  /**
   * Whether this row is currently carrying a control under its name.
   *
   * That is the whole of what the outline means: not "this player is interesting", but "what is
   * below this line belongs to this line". Both openings are the same fact to a reader, so both
   * are the same fact here.
   */
  protected isExpanded(row: PlayerRow): boolean {
    return this.isOpen(row.id) || this.canAssignPartner(row);
  }

  protected toggleOptions(playerId: PlayerId): void {
    this.openRow.update((open) => (open === playerId ? null : playerId));
  }

  protected assignPartner(row: PlayerRow): void {
    this.partnerWanted.emit(row);
  }

  /**
   * Hand the departure up, and close the row on the way.
   *
   * It closes whatever the organizer decides next: the preview that follows is the confirmation
   * (ADR-0015), and a row still standing open behind it would be offering a second tap at a
   * question already being asked.
   */
  protected goHome(row: PlayerRow): void {
    this.openRow.set(null);
    this.wentHome.emit(row);
  }
}
