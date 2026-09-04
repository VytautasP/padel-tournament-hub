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
 * It opens wherever `Sheets` puts a focused surface, which on a phone is under the thumb that
 * asked for it (ADR-0014 §1) and at the desk is the middle of the screen (ADR-0022 §4). This file
 * has no opinion on that and is not supposed to acquire one.
 */
import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { copy } from '../copy/copy';
import { Sheets } from '../sheet/sheets';

/** What is being confirmed, in the organizer's words. */
export interface ConfirmData {
  readonly heading: string;
  /** What freezes, or what goes. The sentence that makes the confirmation worth reading. */
  readonly lead: string;
  /** The label on the button that does it. It names the act rather than agreeing with a question. */
  readonly action: string;
  /**
   * Whether the act on the other side of this button cannot be got back.
   *
   * The one thing that changes how the sheet looks rather than what it says, and the whole of what
   * `danger` is spent on (ADR-0021 §3). It is asked of the act rather than of the screen because
   * the two unrecoverable ones — discarding an evening, deleting one out of history — are the
   * exceptions among the questions this component asks: ending a session is how every evening is
   * supposed to finish, and colouring that as a hazard would teach the organizer to fear the happy
   * path.
   *
   * Left off is a no. A question that has not said it destroys something is one that does not.
   */
  readonly unrecoverable?: boolean;
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
 * A service rather than a function, because opening a sheet is machinery and asking a question is
 * not — a screen that had to hold the first in order to do the second would be holding the wrong
 * thing.
 */
@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly sheets = inject(Sheets);

  /**
   * Ask, and answer `true` only if the organizer said so.
   *
   * Dismissing the sheet any other way — the backdrop, Escape — closes it with `undefined`, which
   * is not a yes. Reading that as a no is the whole safety of the thing: every path out of the
   * sheet that is not the button leaves the evening exactly as it was.
   */
  async granted(data: ConfirmData): Promise<boolean> {
    const confirmed = await this.sheets.open<boolean, ConfirmData>(ConfirmSheet, data);

    return confirmed === true;
  }
}
