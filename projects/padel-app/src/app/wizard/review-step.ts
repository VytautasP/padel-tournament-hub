/*
 * Step three: the three numbers, pre-filled, and the button that commits the evening (ADR-0017).
 *
 * There is no settings step. Target score, court count and round count arrive already holding the
 * answers almost everyone was going to give — 24, one court, a complete rotation capped at 12 —
 * and they sit on Review so they are visible at the moment of commitment rather than three
 * screens behind it.
 *
 * It is also where the courts get their names (ADR-0017 §6): one field per court, appearing with
 * the court count and pre-filled, so the organizer who does not care never touches them and the
 * one whose club booked courts 7 and 8 does not have to send four people to the wrong end of the
 * building.
 *
 * The button that commits the evening is not here. It belongs to the wizard, in the place every
 * step's primary button has stood since the first one — and the last step, where the act is
 * irreversible, is the worst possible screen on which to move it somewhere new.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { copy, modeNames } from '../copy/copy';
import { NumberField } from './number-field';
import { TextField } from './text-field';
import { WizardDraft } from './wizard-draft';

@Component({
  selector: 'app-review-step',
  imports: [NumberField, TextField],
  templateUrl: './review-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewStep {
  readonly draft = input.required<WizardDraft>();

  protected readonly copy = copy;
  protected readonly modeNames = modeNames;

  /** One row per court in play: its number, the words beside its field, and what it is called. */
  protected readonly courts = computed(() =>
    this.draft()
      .courtNames()
      .map((name, index) => ({
        number: index + 1,
        label: copy.wizard.review.courtName(index + 1),
        name,
      })),
  );
}
