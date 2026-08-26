/*
 * A labelled line of text, the way Review asks a court for its name (ADR-0017 §6).
 *
 * It is `NumberField`'s sibling and exists for the same reason: the row is a label, a field and
 * the id tying them together, and written out at each call site the copies differ only in ways
 * that stop being true after somebody edits one of them. The id is generated here rather than
 * passed in because a caller has no reason to care what it is, and a five-court evening must not
 * put five fields on screen sharing one.
 *
 * Nothing is trimmed or corrected on the way out. A blank is a meaningful answer where this is
 * used (ADR-0017 §6), and a name being typed through a space would lose it.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

let nextFieldId = 1;

@Component({
  selector: 'app-text-field',
  templateUrl: './text-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextField {
  /** The words beside the field. Comes from the copy dictionary, never from here. */
  readonly label = input.required<string>();
  readonly value = input.required<string>();

  /** What the field is holding now, exactly as it was typed. */
  readonly changed = output<string>();

  protected readonly fieldId = `text-field-${nextFieldId++}`;

  protected onInput(event: Event): void {
    this.changed.emit((event.target as HTMLInputElement).value);
  }
}
