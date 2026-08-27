/*
 * The Players tab: who is here, who is out this round, and the two ways a roster moves.
 *
 * The list answers the question the organizer is asked most between rounds and cannot answer from
 * the Round tab without paging — **am I out?** — by badging whoever this round leaves off a court.
 * The badge and the bench strip are one derivation (`bench.ts`), because two of them drift the
 * first time a roster changes under a generated round.
 *
 * **Adding is inline at the bottom of the list**, the same single input the wizard's roster step
 * is, so the interaction is learned once and a late arrival is typed the way the first eleven
 * were.
 *
 * **Going home is on the row's overflow**, never on a swipe: a stray thumb at the side of a court
 * must not be able to take a player out of the evening. It is worded for what happened rather than
 * for what was done — the player keeps their played matches and their standings line, and is
 * simply not scheduled into any later round (decision #5).
 *
 * Both changes go through the preview (ADR-0015), and the preview *is* the confirmation: it states
 * the consequence in the strongest available form, the actual schedule, so there is no second
 * dialog asking whether the organizer meant it. Nothing reaches the repository until it comes back
 * confirmed.
 *
 * **An evening at the minimum offers nobody the door.** The engine refuses a round it cannot staff
 * (decision #4), so on a four-player evening there is no departure to offer and the overflow is
 * absent rather than disabled — with the sentence that says why, because a control that vanishes
 * without explanation is a bug from the outside. A session that has ended is read-only for the
 * same reason it is everywhere else (ADR-0013): the engine takes no operation on it.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { PlayerId } from 'padel-engine';
import { copy } from '../copy/copy';
import { MINIMUM_PLAYERS } from '../session/round-defaults';
import { SessionStore } from '../session/session-store';
import type { RosterChange } from '../session/session-store';
import { RosterPreview } from './roster-preview';
import { rosterView } from './roster-view';
import type { PlayerRow } from './roster-view';

@Component({
  selector: 'app-players-tab',
  templateUrl: './players-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersTab {
  private readonly store = inject(SessionStore);
  private readonly preview = inject(RosterPreview);

  /** The one row whose overflow is open, if any. One at a time, like the Resume card's. */
  private readonly openRow = signal<PlayerId | null>(null);

  /** The field is absent on a session that has ended, so this is not required. */
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly copy = copy;
  protected readonly minimumPlayers = MINIMUM_PLAYERS;
  protected readonly typed = signal('');

  /** Whether this session is a record being read rather than an evening being run. */
  protected readonly ended = this.store.ended;

  protected readonly rows = computed<readonly PlayerRow[]>(() => {
    const session = this.store.openSession();

    return session === null ? [] : rosterView(session, this.store.currentRoundNumber() ?? 1);
  });

  /**
   * Whether anybody can go home from this evening at all.
   *
   * One answer for the whole list rather than one per row, because it is a fact about how many
   * people are left: the round after the next departure needs four of them, and which four is not
   * a question anybody is asking.
   */
  protected readonly canAnybodyGoHome = computed(
    () => this.rows().filter((row) => !row.gone).length > MINIMUM_PLAYERS,
  );

  protected isOpen(playerId: PlayerId): boolean {
    return this.openRow() === playerId;
  }

  protected toggleOptions(playerId: PlayerId): void {
    this.openRow.update((open) => (open === playerId ? null : playerId));
  }

  protected onType(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  /**
   * Take a late arrival on, once the organizer has read the evening it produces.
   *
   * A blank name asks nothing — there is no player to preview, and the wizard's roster step
   * ignores the same keystroke for the same reason. What was typed survives a dismissal: backing
   * out of the schedule is backing out of the change, not out of the typing.
   */
  protected async add(): Promise<void> {
    const name = this.typed().trim();
    if (name === '') {
      return;
    }

    if (
      await this.previewed(this.store.planArrival(name), copy.players.preview.confirmArrival(name))
    ) {
      this.typed.set('');
      this.focusField();
    }
  }

  /** Record that this player has gone home, once the organizer has read what it reschedules. */
  protected async wentHome(row: PlayerRow): Promise<void> {
    this.openRow.set(null);

    await this.previewed(
      this.store.planGoingHome(row.id),
      copy.players.preview.confirmDeparture(row.name),
    );
  }

  /**
   * Show the change, and store it only if the organizer causes it.
   *
   * The candidate is held here for the length of the sheet and reaches the repository through the
   * store's one commit — which is what "the candidate is never written unless confirmed" amounts
   * to in code (ADR-0015).
   */
  private async previewed(change: RosterChange, action: string): Promise<boolean> {
    const confirmed = await this.preview.granted({
      candidate: change.candidate,
      courtNames: this.store.courtNames(),
      fromRound: change.fromRound,
      action,
    });

    if (confirmed) {
      await this.store.commitRosterChange(change);
    }

    return confirmed;
  }

  /** Hand the field back for the next name. What it holds is the binding's business, not this. */
  private focusField(): void {
    this.field()?.nativeElement.focus();
  }
}
