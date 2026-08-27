/*
 * The Standings tab: the table, live, and the button that makes it final (decision #17, ADR-0008).
 *
 * Nothing is computed here. The store asks the engine on every read and the engine derives the
 * table from the recorded scores, so a correction typed into the Round tab is already in this
 * table before it is looked at — there is no refresh, no invalidation and nothing to keep in step.
 *
 * A row shows the three things asked at the side of a court — where am I, who am I, how am I
 * scoring — and hides the two things asked afterwards behind a tap. Matches played and total
 * points explain a position rather than establish one, and a table that shows everything at once
 * is a table nobody can read across a court in the dark.
 *
 * Positions come from the engine and are rendered exactly as given: a joint second is `2` twice
 * and the next player is `4`. The app never invents a separator and never renumbers, because the
 * places a joint position occupies are used up (decision #8).
 *
 * **End session is in this footer** rather than on a screen of its own, because the evening ends
 * when the table is final and the table is what the organizer is looking at when they decide that
 * (ADR-0013). What it leaves behind is a podium above the same table on the same tab: the top
 * three *are* the standings, so a podium screen would render the same rows twice.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import type { PlayerId } from 'padel-engine';
import { confirmed } from '../confirm/confirm-sheet';
import { copy } from '../copy/copy';
import { SessionStore } from '../session/session-store';
import { podiumOf } from './podium';

@Component({
  selector: 'app-standings-tab',
  templateUrl: './standings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandingsTab {
  private readonly store = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly expanded = signal<readonly PlayerId[]>([]);

  protected readonly copy = copy;
  protected readonly standings = this.store.standings;

  /** Whether this table is a record rather than a scoreboard: the evening has been ended. */
  protected readonly ended = this.store.readOnly;

  protected readonly podium = computed(() => podiumOf(this.standings()));

  protected isExpanded(playerId: PlayerId): boolean {
    return this.expanded().includes(playerId);
  }

  protected toggle(playerId: PlayerId): void {
    this.expanded.update((open) =>
      open.includes(playerId) ? open.filter((id) => id !== playerId) : [...open, playerId],
    );
  }

  /**
   * End the evening, once the organizer has read what that freezes.
   *
   * The confirmation is not politeness. The engine offers no undo (ADR-0009), so this tap is the
   * last moment anything about the evening can be changed, and the sheet is where it says so.
   */
  protected async end(): Promise<void> {
    if (await confirmed(this.dialog, this.overlay, copy.standings.endConfirm)) {
      await this.store.end();
    }
  }
}
