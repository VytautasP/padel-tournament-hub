/*
 * The consequence, read before it is caused (ADR-0015).
 *
 * Adding one player to an eleven-player evening rewrites every unplayed round: the partners
 * someone was told about two minutes ago are gone. So a roster change opens this before it
 * commits, and what it shows is **the whole regenerated remainder, scrollable** — rounds from the
 * current one onward, rendered as they will be. Not a diff: a diff of a rotation is nearly every
 * line, which is noise wearing the costume of signal.
 *
 * Two things it deliberately does not have.
 *
 *   - **No reroll.** The scheduler is deterministic (ADR-0006), so a second run on the same inputs
 *     returns the same evening; making it return a different one would mean seeding it, and a
 *     schedule the organizer shopped for is a fairness claim nobody can check.
 *   - **No scores.** This is a schedule, and the only round on screen that could hold one is the
 *     round in play at the top. Printing it would invite the reading that the preview is about
 *     results, which is the one thing a roster change cannot touch.
 *
 * The dismissal is worded `Don't change the roster` rather than Cancel, and that wording is the
 * honesty of the whole interaction: there is no state in which the schedule is rejected and the
 * roster change kept, so backing out is backing out of the cause.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import type { Session } from 'padel-engine';
import { copy } from '../copy/copy';
import { roundView } from '../round/round-view';
import type { RoundView } from '../round/round-view';

export interface RosterPreviewData {
  /** The evening as it would be. Stored by the caller if this sheet closes with `true`. */
  readonly candidate: Session;
  readonly courtNames: readonly string[];
  /** The first round to render: the round the evening is on. */
  readonly fromRound: number;
  /**
   * The label on the button that causes the change.
   *
   * It names the act — `Add Gita`, `Gita went home` — rather than agreeing with a question, so
   * that the tap the organizer makes says what they are recording.
   */
  readonly action: string;
}

@Component({
  selector: 'app-roster-preview',
  templateUrl: './roster-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterPreview {
  protected readonly data = inject<RosterPreviewData>(DIALOG_DATA);

  private readonly sheetRef = inject<DialogRef<boolean>>(DialogRef);

  protected readonly copy = copy;

  /** Every round from the current one to the last, as the evening would play them. */
  protected readonly rounds = computed<readonly RoundView[]>(() => {
    const { candidate, courtNames, fromRound } = this.data;

    return candidate.rounds
      .filter((round) => round.number >= fromRound)
      .map((round) => roundView(candidate, round.number, courtNames))
      .filter((view): view is RoundView => view !== null);
  });

  protected readonly roundCount = computed(() => this.data.candidate.rounds.length);

  protected commit(): void {
    this.sheetRef.close(true);
  }

  protected dismiss(): void {
    this.sheetRef.close(false);
  }
}

/**
 * Show the regenerated remainder, and answer whether the organizer caused it.
 *
 * Every way out of the sheet that is not the action button — the dismissal, the backdrop, Escape —
 * answers `false`, which is what makes the candidate safe: the change happens on one tap and on
 * nothing else.
 */
export function openRosterPreview(
  dialog: Dialog,
  overlay: Overlay,
  data: RosterPreviewData,
): Promise<boolean> {
  const sheet = dialog.open<boolean, RosterPreviewData>(RosterPreview, {
    data,
    positionStrategy: overlay.position().global().bottom().centerHorizontally(),
    width: '100%',
    maxWidth: '28rem',
  });

  return firstValueFrom(sheet.closed).then((confirmed) => confirmed === true);
}
