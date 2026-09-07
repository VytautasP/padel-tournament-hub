/*
 * Whether the organizer's history outlives this browser, and the one thing that changes it
 * (decision #14, ADR-0028).
 *
 * It sits at the foot of the front door because that is where history is, and it is the quietest
 * thing on the page on purpose. Browser-bound is the state every organizer starts in and most of
 * them stay in; a banner that said so every evening would be a banner people stop reading, and the
 * loss it warns about is not urgent — it is only permanent (ADR-0028 §4).
 *
 * The whole of the interaction is one tap, and the one branch in it is the account already
 * belonging to a uid. That is not an error and it is not rare: it is what a fresh browser sees
 * when the organizer signs in with the account they linked from the last one, and it is the
 * recovery this feature exists for. So it is asked as a question that names what it costs, and the
 * cost is read off the store rather than guessed at — a browser with nothing on it loses nothing,
 * and the sentence says so.
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Confirm } from '../confirm/confirm-sheet';
import { copy } from '../copy/copy';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-keep-history',
  templateUrl: './keep-history.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeepHistory {
  private readonly store = inject(SessionStore);
  private readonly confirm = inject(Confirm);
  /**
   * Whether the last attempt could not reach Google.
   *
   * The only outcome that leaves a mark. Linking says so by changing the sentence above the
   * button, adopting says so by the history that appears, and closing the Google window is an
   * answer rather than a failure — so this holds the one case with nothing else to show for it,
   * and it is cleared the moment the organizer tries again.
   */
  private readonly failed = signal(false);

  protected readonly copy = copy;
  protected readonly durability = this.store.durability;
  protected readonly unavailable = this.failed.asReadonly();

  /**
   * Keep this browser's history with a Google account: link where the account is free, and offer
   * to sign in as it where it is not.
   *
   * The uid never changes on the first path, which is the whole point of linking rather than
   * signing in (ADR-0028 §1) — every evening this browser owns is still owned by the same uid a
   * moment later, and nothing had to be moved for that to be true.
   */
  protected async keep(): Promise<void> {
    this.failed.set(false);
    const outcome = await this.store.link();

    if (outcome.kind === 'unavailable') {
      this.failed.set(true);
    }

    if (outcome.kind === 'taken') {
      const question = copy.identity.adoptConfirm(
        outcome.account,
        this.store.eveningsOnThisBrowser(),
      );

      if (await this.confirm.granted(question)) {
        await this.store.adopt(outcome);
      }
    }
  }
}
