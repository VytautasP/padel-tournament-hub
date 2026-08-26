/*
 * A labelled number, the way Review asks for all three of them (ADR-0017).
 *
 * Review holds target score, court count and round count, and they behave identically: a label on
 * the left, a small numeric field on the right, and a value that is a whole number of at least
 * one. Written out three times, the three blocks differed only by which id tied the label to the
 * field — which is exactly the kind of difference that stops being true after somebody edits two
 * of the three.
 *
 * The id is generated rather than passed in because a caller has no reason to care what it is,
 * and two of these on one screen must not share one.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MINIMUM_SESSION_NUMBER } from '../session/round-defaults';

let nextFieldId = 1;

@Component({
  selector: 'app-number-field',
  templateUrl: './number-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberField {
  /** The words beside the field. Comes from the copy dictionary, never from here. */
  readonly label = input.required<string>();
  readonly value = input.required<number>();

  /** The number now in the field, once it is one an evening could be run with. */
  readonly changed = output<number>();

  protected readonly fieldId = `number-field-${nextFieldId++}`;
  protected readonly minimum = MINIMUM_SESSION_NUMBER;

  /**
   * Read the field, and correct it in place if what it holds is not a number the evening can have.
   *
   * The correction has to be written back here rather than left to the binding. A zero typed into
   * a field already holding one is refused up to one — the same value the parent already had — so
   * nothing about the parent changes and nothing re-renders, and the organizer would be left
   * looking at a `0` while the draft quietly held a `1`. Being shown the nearest workable answer
   * is the point; being shown one number while another is stored is the bug.
   *
   * An empty field is not corrected. It is somebody mid-way through retyping, and snapping a
   * value back under their cursor is maddening — the draft simply keeps what it had until a
   * number arrives.
   */
  protected onInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    if (field.value.trim() === '') {
      return;
    }

    const typed = Number.parseInt(field.value, 10);
    const accepted = Number.isFinite(typed)
      ? Math.max(MINIMUM_SESSION_NUMBER, typed)
      : MINIMUM_SESSION_NUMBER;

    if (String(accepted) !== field.value) {
      field.value = String(accepted);
    }

    this.changed.emit(accepted);
  }
}
