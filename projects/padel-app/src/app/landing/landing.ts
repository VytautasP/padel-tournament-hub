/*
 * The front door: the evening in progress, or the way to start one, and every evening already
 * played (ADR-0013).
 *
 * With a session in progress, New session is *absent* rather than disabled. There is only ever
 * one active session, so the app cannot honour a second one, and an offered-but-greyed button is
 * a worse answer than no button — it invites a tap and explains nothing. The way to start another
 * evening is to end or discard this one.
 *
 * **Discard is in the Resume card's overflow, and it is on this page only.** It is the one way
 * past an evening that stopped without an ending, and it destroys everything scored in it, so it
 * sits one deliberate tap away from Resume rather than beside it — and nowhere at all inside a
 * running session, where a thumb at the side of a court could find it (ADR-0013 §3).
 *
 * **History is every ended session, and rows name themselves.** There is no name field in the
 * wizard: a padel night is identified by when it was and who won it, which the evening already
 * knows. Nothing here can be opened into an edit — a row opens the session read-only — and the
 * only thing that can be done to one is delete it, which is where decision #10's promise of a hard
 * delete is actually kept.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { confirmed } from '../confirm/confirm-sheet';
import { copy } from '../copy/copy';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  private readonly store = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly overflow = signal(false);

  readonly started = output<void>();
  /** The session the organizer wants on screen: the one in progress, or one out of history. */
  readonly opened = output<string>();

  protected readonly copy = copy;
  protected readonly session = this.store.activeSession;
  protected readonly roundNumber = computed(() => this.store.activeRoundNumber() ?? 1);
  protected readonly history = this.store.history;
  protected readonly optionsOpen = this.overflow.asReadonly();

  protected toggleOptions(): void {
    this.overflow.update((open) => !open);
  }

  /**
   * Throw the evening in progress away, once the organizer has read what goes with it.
   *
   * Confirmed for the same reason deleting a history row is: it is a hard delete of everything
   * scored so far, and there is nothing to undo it with.
   */
  protected async discard(): Promise<void> {
    if (await confirmed(this.dialog, this.overlay, copy.landing.discardConfirm)) {
      await this.store.discard();
    }
    this.overflow.set(false);
  }

  /** Forget one ended evening, permanently (decision #10). */
  protected async remove(sessionId: string): Promise<void> {
    if (await confirmed(this.dialog, this.overlay, copy.history.deleteConfirm)) {
      await this.store.deleteFromHistory(sessionId);
    }
  }
}
