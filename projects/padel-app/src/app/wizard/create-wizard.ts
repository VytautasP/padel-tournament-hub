/*
 * Creation, one screen per decision (ADR-0017).
 *
 * The wizard owns the draft and the step; the steps render it. That is what makes Back
 * non-destructive without any work — stepping back does not unmount anything that was holding
 * what was typed, because the steps never held it.
 *
 * Pairing is the fourth step ADR-0017 describes and it is not here: it belongs to Team Americano,
 * which this slice does not schedule. The step order below is the whole of the Americano path.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { copy } from '../copy/copy';
import { ModeStep } from './mode-step';
import { PlayersStep } from './players-step';
import { ReviewStep } from './review-step';
import { SessionStore } from '../session/session-store';
import { WizardDraft } from './wizard-draft';

const STEPS = ['mode', 'players', 'review'] as const;

type Step = (typeof STEPS)[number];

@Component({
  selector: 'app-create-wizard',
  imports: [ModeStep, PlayersStep, ReviewStep],
  templateUrl: './create-wizard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateWizard {
  private readonly store = inject(SessionStore);
  private readonly step = signal<Step>('mode');

  /** Emitted once the session exists in the repository, and not before. */
  readonly created = output<void>();
  readonly cancelled = output<void>();

  protected readonly copy = copy;
  protected readonly draft = new WizardDraft();
  protected readonly current = this.step.asReadonly();

  /**
   * Whether Next is offered at all. Only the Players step can refuse, and it says why inline
   * (ADR-0017) rather than leaving a dead button to be poked at.
   */
  protected readonly canAdvance = computed(
    () => this.step() !== 'players' || this.draft.canLeavePlayers(),
  );

  protected next(): void {
    this.step.update((step) => STEPS[Math.min(STEPS.indexOf(step) + 1, STEPS.length - 1)]);
  }

  /** Back off the first step leaves the wizard, dropping the draft with it. */
  protected back(): void {
    const index = STEPS.indexOf(this.step());
    if (index === 0) {
      this.cancelled.emit();

      return;
    }

    this.step.set(STEPS[index - 1]);
  }

  protected async create(): Promise<void> {
    await this.store.create(this.draft.toSessionDraft());
    this.created.emit();
  }
}
