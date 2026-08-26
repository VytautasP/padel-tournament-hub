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
 * This is the first and only screen in the wizard that writes anything.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { copy, modeNames } from '../copy/copy';
import { NumberField } from './number-field';
import { WizardDraft } from './wizard-draft';

let nextStepId = 1;

@Component({
  selector: 'app-review-step',
  imports: [NumberField],
  templateUrl: './review-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewStep {
  readonly draft = input.required<WizardDraft>();
  readonly create = output<void>();

  protected readonly copy = copy;
  protected readonly modeNames = modeNames;

  private readonly stepId = nextStepId++;

  /**
   * One row per court in play: its number, the words beside the field, the id tying the two
   * together, and what the field is holding.
   *
   * The id is generated rather than taken from the court number alone because two wizards in one
   * document — a test rendering the app twice — would otherwise label each other's fields.
   */
  protected readonly courts = computed(() =>
    this.draft()
      .courtNames()
      .map((name, index) => ({
        number: index + 1,
        label: copy.wizard.review.courtName(index + 1),
        fieldId: `court-name-${this.stepId}-${index + 1}`,
        name,
      })),
  );

  protected onCourtName(courtNumber: number, event: Event): void {
    this.draft().setCourtName(courtNumber, (event.target as HTMLInputElement).value);
  }
}
