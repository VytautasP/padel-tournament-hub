/*
 * The one question the app asks twice: are you sure?
 *
 * Three things in this slice cannot be undone — ending an evening, discarding one, deleting one
 * out of history — and none of them has an undo to offer afterwards. The engine is explicit that
 * finishing is irreversible (ADR-0009) and decision #10 promises a hard delete, so the only place
 * a mistake can be caught is before it is made.
 *
 * It is one component rather than three because the question is the same shape every time: what is
 * about to happen, what it costs, and the two ways out. What differs is the words, and the words
 * come from the dictionary at the call site.
 *
 * A bottom sheet for the same reason the score sheet is one (ADR-0014 §1): it opens under the
 * thumb that asked for it, and the confirming tap is the one that has to be comfortable — a dialog
 * in the middle of the screen puts Cancel where the thumb already is.
 */
import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import { copy } from '../copy/copy';

/** What is being confirmed, in the organizer's words. */
export interface ConfirmData {
  readonly heading: string;
  /** What freezes, or what goes. The sentence that makes the confirmation worth reading. */
  readonly lead: string;
  /** The label on the button that does it. It names the act rather than agreeing with a question. */
  readonly action: string;
}

@Component({
  selector: 'app-confirm-sheet',
  templateUrl: './confirm-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmSheet {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);

  private readonly sheetRef = inject<DialogRef<boolean>>(DialogRef);

  protected readonly copy = copy;

  protected confirm(): void {
    this.sheetRef.close(true);
  }

  protected cancel(): void {
    this.sheetRef.close(false);
  }
}

/**
 * Asking the question, from wherever the irreversible thing is offered.
 *
 * A service rather than a function taking `Dialog` and `Overlay`, because those two always travel
 * together and neither is anything the calling screen has an opinion about — a screen that had to
 * hold both would be holding the machinery of a bottom sheet in order to ask a question.
 */
@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  /**
   * Ask, and answer `true` only if the organizer said so.
   *
   * Dismissing the sheet any other way — the backdrop, Escape — closes it with `undefined`, which
   * is not a yes. Reading that as a no is the whole safety of the thing: every path out of the
   * sheet that is not the button leaves the evening exactly as it was.
   */
  async granted(data: ConfirmData): Promise<boolean> {
    const sheet = this.dialog.open<boolean, ConfirmData>(ConfirmSheet, {
      data,
      positionStrategy: this.overlay.position().global().bottom().centerHorizontally(),
      width: '100%',
      maxWidth: '28rem',
    });

    return (await firstValueFrom(sheet.closed)) === true;
  }
}
