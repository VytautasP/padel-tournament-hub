/*
 * The Round tab: the board the organizer is standing in front of, and the two things they can do
 * to it.
 *
 * Everything about paging, the courts, the bench strip and the Add round card is
 * `app-round-board`, which is the same component the spectator's route renders (ADR-0026 §2).
 * What this tab holds is the pair of gestures a board has no business owning — the score sheet
 * that opens over one court, and the round appended to the session — because both of them end in
 * the store, and the store is where this app calls the engine (decision #17).
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RoundBoard } from './round-board';
import type { CourtView } from './round-view';
import { openScoreSheet } from '../score/score-sheet';
import { SessionStore } from '../session/session-store';
import { Sheets } from '../sheet/sheets';

@Component({
  selector: 'app-round-tab',
  imports: [RoundBoard],
  templateUrl: './round-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundTab {
  private readonly store = inject(SessionStore);
  private readonly sheets = inject(Sheets);

  protected readonly session = this.store.openSession;
  protected readonly courtNames = this.store.courtNames;

  /** Append one round. Where the organizer is standing is the board's business, not this. */
  protected async addRound(): Promise<void> {
    await this.store.addRound();
  }

  /** Open the sheet for one court, and record whatever comes back out of it. */
  protected async score(court: CourtView): Promise<void> {
    const session = this.store.openSession();
    if (session === null) {
      return;
    }

    const entry = await openScoreSheet(this.sheets, {
      court,
      targetScore: session.targetScore,
    });

    if (entry !== undefined) {
      await this.store.score(entry);
    }
  }
}
