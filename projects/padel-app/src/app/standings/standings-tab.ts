/*
 * The Standings tab: the table, live, and the button that makes it final (decision #17, ADR-0008).
 *
 * The table is `app-standings-table`, which is the same component the spectator's route renders
 * (ADR-0026 §2). What this tab adds is the one thing an organizer can do from here, and that is
 * the whole of the difference between the two screens.
 *
 * Nothing is computed here. The store asks the engine on every read and the engine derives the
 * table from the recorded scores, so a correction typed into the Round tab is already in this
 * table before it is looked at — there is no refresh, no invalidation and nothing to keep in step.
 *
 * **End session is in this footer** rather than on a screen of its own, because the evening ends
 * when the table is final and the table is what the organizer is looking at when they decide that
 * (ADR-0016 §6). What it leaves behind is a podium above the same table on the same tab: the top
 * three *are* the standings, so a podium screen would render the same rows twice.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Confirm } from '../confirm/confirm-sheet';
import { copy } from '../copy/copy';
import { SessionStore } from '../session/session-store';
import { StandingsTable } from './standings-table';

@Component({
  selector: 'app-standings-tab',
  imports: [StandingsTable],
  templateUrl: './standings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandingsTab {
  private readonly store = inject(SessionStore);
  private readonly confirm = inject(Confirm);

  protected readonly copy = copy;
  protected readonly standings = this.store.standings;

  /** Whether this table is a record rather than a scoreboard: the evening has been ended. */
  protected readonly ended = this.store.ended;

  /**
   * End the evening, once the organizer has read what that freezes.
   *
   * The confirmation is not politeness. The engine offers no undo (ADR-0009), so this tap is the
   * last moment anything about the evening can be changed, and the sheet is where it says so.
   */
  protected async end(): Promise<void> {
    if (await this.confirm.granted(copy.standings.endConfirm)) {
      await this.store.end();
    }
  }
}
