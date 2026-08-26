/*
 * Step two: the roster, typed one name at a time (ADR-0017).
 *
 * The whole design of this screen is one interaction repeated eleven times without friction: type
 * a name, commit it, the field clears and keeps focus, type the next. Anything that dismisses the
 * keyboard between names — a dialog, a re-render that drops focus, a Next button that has to be
 * reached for — turns entering a roster into eleven separate interactions.
 *
 * Editing reuses the same field rather than making a row editable in place. It keeps the focus
 * rule true (there is only ever one place to type) and it means a correction is committed by the
 * same key that commits a new name.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { copy } from '../copy/copy';
import { MINIMUM_PLAYERS } from '../session/round-defaults';
import { WizardDraft } from './wizard-draft';

@Component({
  selector: 'app-players-step',
  templateUrl: './players-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersStep {
  readonly draft = input.required<WizardDraft>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly editing = signal<string | null>(null);

  protected readonly copy = copy;
  protected readonly minimumPlayers = MINIMUM_PLAYERS;
  protected readonly typed = signal('');
  protected readonly isEditing = computed(() => this.editing() !== null);

  protected onType(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  /**
   * Commit whatever is in the field — as a correction if a name is being edited, as a new player
   * otherwise — and hand the field straight back, empty.
   */
  protected commit(): void {
    const name = this.typed();
    const editing = this.editing();

    if (editing === null) {
      this.draft().addPlayer(name);
    } else {
      this.draft().renamePlayer(editing, name);
    }

    this.editing.set(null);
    this.typed.set('');
    this.focusField();
  }

  protected edit(id: string, name: string): void {
    this.editing.set(id);
    this.typed.set(name);
    this.focusField();
  }

  protected remove(id: string): void {
    if (this.editing() === id) {
      this.editing.set(null);
      this.typed.set('');
    }

    this.draft().removePlayer(id);
  }

  private focusField(): void {
    const element = this.field().nativeElement;
    element.value = this.typed();
    element.focus();
  }
}
