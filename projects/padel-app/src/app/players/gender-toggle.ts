/*
 * The two-state gender toggle, built once for the two places a Mixicano roster grows a name.
 *
 * The wizard's Players step puts one on every row; the Players tab puts one under the field a
 * late arrival is typed into. They are the same control asking the same question of the same
 * roster, and two hand-written copies of it drift the way two copies of a court card were about
 * to (`round/court-card.ts`): a class here, an `aria-pressed` missing there.
 *
 * **There is no unset state to return to.** The toggle takes `null` and never emits it, because
 * the way back from a mis-tap is the other half of the toggle. A control that could go back to
 * "not asked" would be a gap the organizer had to notice a second time — and ADR-0010 is clear
 * that a Mixicano roster with a gap is not a roster the engine will schedule.
 *
 * `owner` is the one thing the two sites disagree about, and the disagreement is real rather than
 * incidental. A wizard roster is a column of identical pairs of buttons, so each pair has to say
 * whose row it is; the add form has exactly one pair, and a screen reader announcing `Woman` there
 * is announcing the whole truth. Naming the owner where there is no list to disambiguate would be
 * inventing a person the field does not have a name for yet.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Gender } from 'padel-engine';
import { copy } from '../copy/copy';

@Component({
  selector: 'app-gender-toggle',
  templateUrl: './gender-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenderToggle {
  /** The answer so far, or `null` while the question is unanswered. There is no default. */
  readonly selected = input.required<Gender | null>();

  /** Whose gender this is, where the screen holds more than one toggle. */
  readonly owner = input<string | null>(null);

  readonly chose = output<Gender>();

  protected readonly copy = copy;
  protected readonly genders: readonly Gender[] = ['woman', 'man'];

  /**
   * What a screen reader announces, or `null` to leave the button announcing its own word.
   *
   * `null` removes the attribute rather than setting it empty, which is what keeps the tab's
   * single toggle addressable as `Woman` while the wizard's eleven are addressable at all.
   */
  protected labelFor(gender: Gender): string | null {
    const owner = this.owner();

    return owner === null ? null : copy.gender.choose(owner, gender);
  }
}
