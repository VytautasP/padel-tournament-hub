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
 *
 * In Mixicano each row grows a two-state gender toggle, and in no other mode — Americano has
 * nothing to ask, and a control that appears whether or not it means anything teaches the
 * organizer to ignore it. The toggle has **no default** (ADR-0010): an untouched row holds the
 * step with the reason inline, because a guessed gender does not fail loudly. It silently
 * produces a wrong pairing rule that the schedule then honours all evening.
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
import type { Gender } from 'padel-engine';
import { copy } from '../copy/copy';
import { GenderToggle } from '../players/gender-toggle';
import { MINIMUM_PLAYERS } from '../session/round-defaults';
import { WizardDraft } from './wizard-draft';

@Component({
  selector: 'app-players-step',
  imports: [GenderToggle],
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

  /** Whether this evening pairs across gender, which is the whole of whether the toggle is here. */
  protected readonly asksGender = computed(() => this.draft().mode() === 'mixicano');

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

  /**
   * Answer the gender question for one row.
   *
   * It does not touch the field or the focus. Tapping a toggle is not committing a name, and
   * pulling the cursor out of a half-typed twelfth player to record something about the third
   * would be the kind of thing that is only noticed once the name is already wrong.
   */
  protected setGender(id: string, gender: Gender): void {
    this.draft().setGender(id, gender);
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
