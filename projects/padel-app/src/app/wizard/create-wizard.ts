/*
 * Creation, one screen per decision (ADR-0017).
 *
 * The wizard owns the draft and the step; the steps render it. That is what makes Back
 * non-destructive without any work — stepping back does not unmount anything that was holding
 * what was typed, because the steps never held it.
 *
 * The steps are the four ADR-0017 describes, and one of them is conditional: pairing belongs to
 * Team Americano and appears in no other mode, because there is nothing for it to ask. That is why
 * the order is derived from the draft rather than written down once — the mode can change under
 * it, and Back is non-destructive, so a draft that walks into Team Americano and out again has to
 * find the steps rearranged behind it.
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
import { PairingStep } from './pairing-step';
import { PlayersStep } from './players-step';
import { ReviewStep } from './review-step';
import { SessionStore } from '../session/session-store';
import { WizardDraft } from './wizard-draft';

const STEPS = ['mode', 'players', 'pairing', 'review'] as const;

type Step = (typeof STEPS)[number];

@Component({
  selector: 'app-create-wizard',
  imports: [ModeStep, PairingStep, PlayersStep, ReviewStep],
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
   * The steps this evening walks: all four in Team Americano, and three in the modes that pair
   * nobody. Order is the constant's; what the mode decides is only which of them are in it.
   */
  protected readonly steps = computed<readonly Step[]>(() =>
    STEPS.filter((step) => step !== 'pairing' || this.draft.asksPairing()),
  );

  /**
   * Whether Next is offered at all. Two steps can refuse, and both say why inline (ADR-0017)
   * rather than leaving a dead button to be poked at: the Players step while the roster is not one
   * the engine could schedule, and the pairing step while anybody is still on their own.
   */
  protected readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 'players':
        return this.draft.canLeavePlayers();
      case 'pairing':
        return this.draft.canLeavePairing();
      default:
        return true;
    }
  });

  /** Whether this step is one the organizer walks on from, as opposed to the last one. */
  protected readonly hasNext = computed(() => this.step() !== 'review');

  protected next(): void {
    const steps = this.steps();
    this.step.update((step) => steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)]);
  }

  /** Back off the first step leaves the wizard, dropping the draft with it. */
  protected back(): void {
    const steps = this.steps();
    const index = steps.indexOf(this.step());
    if (index === 0) {
      this.cancelled.emit();

      return;
    }

    this.step.set(steps[index - 1]);
  }

  protected async create(): Promise<void> {
    await this.store.create(this.draft.toSessionDraft());
    this.created.emit();
  }
}
