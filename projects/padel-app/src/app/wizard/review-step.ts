/*
 * Step three: the three numbers, pre-filled, and the button that commits the evening (ADR-0017).
 *
 * There is no settings step. Target score, court count and round count arrive already holding the
 * answers almost everyone was going to give — 24, one court, a complete rotation capped at 12 —
 * and they sit on Review so they are visible at the moment of commitment rather than three
 * screens behind it.
 *
 * This is the first and only screen in the wizard that writes anything.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { copy, modeNames } from '../copy/copy';
import { NumberField } from './number-field';
import { WizardDraft } from './wizard-draft';

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
}
