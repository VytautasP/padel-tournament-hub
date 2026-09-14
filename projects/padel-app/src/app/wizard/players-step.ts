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
 * Mixicano asks two things here that no other mode does. Each row grows a two-state gender
 * toggle, and under the list the evening picks the rule it settles an unequal pool by — strict
 * mixing or hybrid fill, with the courts this roster fills underneath it (ADR-0036 §2). The choice
 * is on this screen rather than the mode step because the number it changes is a function of the
 * roster, and a choice made before the roster exists is a choice made blind.
 *
 * The gender toggle is on every row in Mixicano, and in no other mode — Americano has
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
import { MINIMUM_PER_GENDER, MINIMUM_PLAYERS } from '../session/round-defaults';
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
  protected readonly minimumPerGender = MINIMUM_PER_GENDER;
  protected readonly typed = signal('');
  protected readonly isEditing = computed(() => this.editing() !== null);

  /**
   * The two answers the mixing row offers, in the order they are shown — strict first, because it
   * is the one an organizer who says nothing is playing under (ADR-0036 §1).
   *
   * Booleans rather than a pair of labelled objects, because the draft holds a boolean and the
   * label is a lookup: `mixingLabel` below is where the two meet, exactly as the settings sheet
   * pairs its themes with their words.
   */
  protected readonly mixingRules: readonly boolean[] = [true, false];

  /** What one half of the mixing row says, and what the sentence under it says once it holds. */
  protected mixingLabel(strict: boolean): string {
    return strict ? copy.mixing.strict : copy.mixing.hybrid;
  }

  protected mixingLead(strict: boolean): string {
    return strict ? copy.mixing.strictLead : copy.mixing.hybridLead;
  }

  /**
   * Choose the rule this Mixicano settles an unequal pool by (ADR-0036 §1).
   *
   * It leaves the field and the focus alone, for the reason the gender toggles do: answering a
   * question about the evening is not committing a name, and a half-typed twelfth player must
   * survive a tap on the rule the first eleven will play under.
   */
  protected setStrictMixing(strict: boolean): void {
    this.draft().strictMixing.set(strict);
  }

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
