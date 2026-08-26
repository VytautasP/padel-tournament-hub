/*
 * The Round tab: where the evening actually is (ADR-0016).
 *
 * It opens on the current round — the lowest-numbered round still holding an unscored match,
 * derived from the scores and never stored — and then stays there. Scoring the last court of a
 * round does not move the screen: the moment right after a score lands is exactly when a typo
 * gets spotted (ADR-0016 §3), so the round the organizer was looking at is the round they are
 * still looking at. Paging to another round arrives with its own slice; until then, the round is
 * pinned when the tab opens and released when the session does.
 *
 * Tapping a court opens the score sheet for that one match, scored or not. Courts finish minutes
 * apart and corrections are ordinary (ADR-0007), so there is one gesture rather than two.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import type { ScoreEntry } from 'padel-engine';
import { copy } from '../copy/copy';
import { roundView } from './round-view';
import type { CourtView } from './round-view';
import { ScoreSheet } from '../score/score-sheet';
import type { ScoreSheetData } from '../score/score-sheet';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-round-tab',
  templateUrl: './round-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundTab {
  private readonly store = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  /** The round this tab is showing. Set when the tab opens, and not moved by a score landing. */
  private readonly showing = signal(this.store.currentRoundNumber());

  protected readonly copy = copy;

  protected readonly roundCount = computed(() => this.store.activeSession()?.rounds.length ?? 0);

  protected readonly round = computed(() => {
    const session = this.store.activeSession();
    const roundNumber = this.showing();

    return session === null || roundNumber === null ? null : roundView(session, roundNumber);
  });

  /** Open the sheet for one court, and record whatever comes back out of it. */
  protected async score(court: CourtView): Promise<void> {
    const session = this.store.activeSession();
    if (session === null) {
      return;
    }

    const data: ScoreSheetData = {
      matchId: court.matchId,
      courtNumber: court.courtNumber,
      sideA: court.sideA,
      sideB: court.sideB,
      targetScore: session.targetScore,
      score: court.score,
    };

    const sheet = this.dialog.open<ScoreEntry | undefined, ScoreSheetData>(ScoreSheet, {
      data,
      // A bottom sheet: it opens under the thumb that tapped the court, not in the middle of the
      // screen where the same thumb cannot reach it.
      positionStrategy: this.overlay.position().global().bottom().centerHorizontally(),
      width: '100%',
      maxWidth: '28rem',
    });

    const entry = await firstValueFrom(sheet.closed);
    if (entry !== undefined) {
      await this.store.score(entry);
    }
  }
}
