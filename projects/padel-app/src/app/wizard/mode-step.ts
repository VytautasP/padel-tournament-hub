/*
 * Step one: which format the evening plays (ADR-0017).
 *
 * All three modes are listed, and one of them is not selectable yet — Team Americano needs a
 * pairing screen, which arrives in its own slice. It is shown rather than hidden because the app
 * that ships tonight should say what it will be, and a mode that quietly appears next month reads
 * as a mode that was broken until then.
 *
 * Mixicano became selectable when the Players step grew its gender toggle (ADR-0010). Nothing on
 * this screen knows that: picking a mode is picking a mode, and what the roster step then has to
 * ask is the roster step's business.
 *
 * Picking a mode advances; there is nothing else on this screen to do.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { SessionMode } from 'padel-engine';
import { copy } from '../copy/copy';
import { WizardDraft } from './wizard-draft';

interface ModeChoice {
  readonly mode: SessionMode;
  readonly available: boolean;
}

@Component({
  selector: 'app-mode-step',
  templateUrl: './mode-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModeStep {
  readonly draft = input.required<WizardDraft>();
  readonly chosen = output<void>();

  protected readonly copy = copy;
  protected readonly choices: readonly ModeChoice[] = [
    { mode: 'americano', available: true },
    { mode: 'mixicano', available: true },
    { mode: 'team-americano', available: false },
  ];

  protected choose(mode: SessionMode): void {
    this.draft().mode.set(mode);
    this.chosen.emit();
  }
}
