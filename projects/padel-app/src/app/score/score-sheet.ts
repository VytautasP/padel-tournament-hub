/*
 * The score sheet: one match, two views of one number (ADR-0014).
 *
 * Both fields are editable and only one of them is real. Whichever side was last typed into is
 * the number; the other is `target - number`, recomputed on every keystroke and never stored. That
 * is what makes this still "one number in" — the pair is derived here and derived again inside
 * `recordScore` — while letting the organizer enter the result in whichever direction the four
 * people talking at them happened to say it.
 *
 * Two rules the sheet must not soften:
 *
 *   - **Digits only.** `inputmode="numeric"` raises the right keypad, and the filter below is what
 *     actually holds, because a phone keypad is not the only way characters arrive in a field.
 *   - **Out of range is an error, never a clamp.** A number above the target refuses to save and
 *     stays on screen exactly as it was typed. Rewriting `27` to `24` produces a wrong score that
 *     looks deliberate, and nobody ever looks at it again.
 *
 * The bound is the session's target score, passed in. A validator that knew the number 24 would
 * silently break every evening played to anything else.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import type { MatchId, MatchScore, ScoreEntry, Side } from 'padel-engine';
import { copy } from '../copy/copy';

/** Everything the sheet needs about the court that was tapped. */
export interface ScoreSheetData {
  readonly matchId: MatchId;
  readonly courtNumber: number;
  readonly sideA: readonly string[];
  readonly sideB: readonly string[];
  readonly targetScore: number;
  /** The result already recorded, if this court is being corrected rather than scored. */
  readonly score?: MatchScore;
}

let nextSheetId = 1;

@Component({
  selector: 'app-score-sheet',
  templateUrl: './score-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreSheet {
  protected readonly data = inject<ScoreSheetData>(DIALOG_DATA);

  private readonly dialogRef = inject<DialogRef<ScoreEntry | undefined>>(DialogRef);

  /**
   * The side that was typed into and what it holds, as characters rather than a number.
   *
   * Characters, because an empty field and a field holding `0` are different states and only one
   * of them can be saved — and because what is refused has to stay legible on screen.
   */
  private readonly typed = signal(openingEntry(this.data));

  protected readonly copy = copy;

  /** The two sides, so the template writes one field rather than two that have to stay alike. */
  protected readonly sides: readonly { side: Side; names: readonly string[] }[] = [
    { side: 'A', names: this.data.sideA },
    { side: 'B', names: this.data.sideB },
  ];

  private readonly sheetId = nextSheetId++;

  /** The number in the field, or `null` while the field is empty. */
  private readonly points = computed(() => {
    const text = this.typed().text;

    return text === '' ? null : Number.parseInt(text, 10);
  });

  protected readonly tooHigh = computed(() => {
    const points = this.points();

    return points !== null && points > this.data.targetScore;
  });

  protected readonly canSave = computed(() => this.points() !== null && !this.tooHigh());

  /** Unique per open sheet, so a label ties itself to the field beside it and to no other. */
  protected fieldId(side: Side): string {
    return `score-${this.sheetId}-${side}`;
  }

  protected valueFor(side: Side): string {
    const typed = this.typed();
    if (typed.side === side) {
      return typed.text;
    }

    const points = this.points();

    return points === null || this.tooHigh() ? '' : String(this.data.targetScore - points);
  }

  /**
   * Take what was typed, keeping the digits and dropping everything else.
   *
   * The filtered text is written back to the field by hand for the same reason `NumberField` does
   * it: when the filter removes the only character that changed, the bound value is what it
   * already was, nothing re-renders, and the organizer is left looking at a character the app has
   * decided to ignore.
   */
  protected onInput(side: Side, event: Event): void {
    const field = event.target as HTMLInputElement;
    const digits = field.value.replace(/\D/g, '');
    if (digits !== field.value) {
      field.value = digits;
    }

    this.typed.set({ side, text: digits });
  }

  /** Close with the one number the engine gets, and the side it belongs to (decision #3). */
  protected save(): void {
    const points = this.points();
    if (points === null || this.tooHigh()) {
      return;
    }

    this.dialogRef.close({ matchId: this.data.matchId, side: this.typed().side, points });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}

/**
 * What the sheet opens holding: the recorded score where there is one, and nothing where there is
 * not.
 *
 * A scored court reopens at its current value because correcting a typo is the ordinary path
 * (ADR-0007) — arriving at an empty sheet would make the correction a re-entry.
 */
function openingEntry(data: ScoreSheetData): { side: Side; text: string } {
  return { side: 'A', text: data.score === undefined ? '' : String(data.score.sideA) };
}
