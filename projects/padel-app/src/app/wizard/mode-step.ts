/*
 * Step one: which format the evening plays (ADR-0017).
 *
 * All three modes are listed and all three are playable. Mixicano became selectable when the
 * Players step grew its gender toggle (ADR-0010) and Team Americano when the pairing step arrived
 * (ADR-0017 §1). Nothing on this screen knows either: picking a mode is picking a mode, and what
 * the steps behind it then have to ask is their business.
 *
 * Picking a mode advances; there is nothing else on this screen to do.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { SessionMode } from 'padel-engine';
import { copy } from '../copy/copy';
import { WizardDraft } from './wizard-draft';

@Component({
  selector: 'app-mode-step',
  templateUrl: './mode-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModeStep {
  readonly draft = input.required<WizardDraft>();
  readonly chosen = output<void>();

  protected readonly copy = copy;
  protected readonly choices: readonly SessionMode[] = ['americano', 'mixicano', 'team-americano'];

  protected choose(mode: SessionMode): void {
    this.draft().mode.set(mode);
    this.chosen.emit();
  }
}
