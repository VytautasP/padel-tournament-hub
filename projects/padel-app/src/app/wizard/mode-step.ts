/*
 * Step one: which format the evening plays (ADR-0017).
 *
 * All three modes are listed, and two of them are not selectable yet — Mixicano and Team
 * Americano need a gender toggle and a pairing screen respectively, and both arrive in their own
 * slices. They are shown rather than hidden because the app that ships tonight should say what it
 * will be, and a mode that quietly appears next month reads as a mode that was broken until then.
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
    { mode: 'mixicano', available: false },
    { mode: 'team-americano', available: false },
  ];

  protected choose(mode: SessionMode): void {
    this.draft().mode.set(mode);
    this.chosen.emit();
  }
}
