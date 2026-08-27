/*
 * The score sheet: one match, two views of one number (ADR-0014).
 *
 * Both fields are editable and only one of them is real. Whichever side was last typed into is
 * the number; the other is `target - number`, recomputed on every keystroke and never stored. That
 * is what makes this still "one number in" — the pair is derived here and derived again inside
 * `recordScore` — while letting the organizer enter the result in whichever direction the four
 * people talking at them happened to say it.
 *
 * Three rules the sheet must not soften:
 *
 *   - **Digits only.** `inputmode="numeric"` raises the right keypad, and the filter below is what
 *     actually holds, because a phone keypad is not the only way characters arrive in a field.
 *   - **Out of range is an error, never a clamp.** A number above the target refuses to save and
 *     stays on screen exactly as it was typed. Rewriting `27` to `24` produces a wrong score that
 *     looks deliberate, and nobody ever looks at it again.
 *   - **The derived side is empty while the typed one is out of range.** `24 - 27` is not a
 *     scoreline, and the last one that was is not this one. An empty field beside the error says
 *     what is true: there is no pair here yet. Nothing typed is lost — the refused number is the
 *     one still on screen.
 *
 * The bound is the session's target score, passed in. A validator that knew the number 24 would
 * silently break every evening played to anything else.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import type { ScoreEntry, Side } from 'padel-engine';
import { copy } from '../copy/copy';
import type { CourtView } from '../round/round-view';
import { openBottomSheet } from '../sheet/bottom-sheet';

/** The court that was tapped, and the total its two numbers have to add up to. */
export interface ScoreSheetData {
  readonly court: CourtView;
  readonly targetScore: number;
}

let nextSheetId = 1;

@Component({
  selector: 'app-score-sheet',
  templateUrl: './score-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreSheet {
  protected readonly data = inject<ScoreSheetData>(DIALOG_DATA);

  private readonly sheetRef = inject<DialogRef<ScoreEntry | undefined>>(DialogRef);

  /**
   * The side that was typed into and what it holds, as characters rather than a number.
   *
   * Characters, because an empty field and a field holding `0` are different states and only one
   * of them can be saved — and because what is refused has to stay legible on screen.
   */
  private readonly typed = signal(openingField(this.data.court));

  protected readonly copy = copy;

  /** The two sides, so the template writes one field rather than two that have to stay alike. */
  protected readonly sides: readonly { side: Side; names: readonly string[] }[] = [
    { side: 'A', names: this.data.court.sideA },
    { side: 'B', names: this.data.court.sideB },
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

    this.sheetRef.close({ matchId: this.data.court.matchId, side: this.typed().side, points });
  }

  protected cancel(): void {
    this.sheetRef.close(undefined);
  }
}

/**
 * Open the sheet for one court and wait for the number, or for nothing.
 *
 * Opening it lives here rather than at the call site because where it opens is a fact about this
 * component rather than about the screen that asked for it (ADR-0014 §1). A caller that had to say
 * so would be a caller that could forget to.
 */
export function openScoreSheet(
  dialog: Dialog,
  overlay: Overlay,
  data: ScoreSheetData,
): Promise<ScoreEntry | undefined> {
  return openBottomSheet<ScoreEntry, ScoreSheetData>(dialog, overlay, ScoreSheet, data);
}

/**
 * What the sheet opens holding: the recorded score where there is one, and nothing where there is
 * not.
 *
 * A scored court reopens at its current value because correcting a typo is the ordinary path
 * (ADR-0007) — arriving at an empty sheet would make the correction a re-entry.
 */
function openingField(court: CourtView): { side: Side; text: string } {
  return { side: 'A', text: court.score === undefined ? '' : String(court.score.sideA) };
}
