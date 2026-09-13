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
import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { copy } from '../copy/copy';
import { Sheets } from '../sheet/sheets';

/**
 * One further question asked on the way through, where the act has one to ask (ADR-0037 §1).
 *
 * It is a question about the act rather than a second act: the only way to answer it is to do the
 * thing, and cancelling leaves it unanswered along with everything else. That is why it lives
 * inside the confirmation instead of being a sheet of its own — an evening ends with two questions
 * on one screen, not with two screens.
 *
 * `note` is where the consequence is spelled out, and it is not optional. A question worth adding
 * to an irreversible confirmation is one whose answer changes something the organizer is looking
 * at, and the sentence that says so is the whole reason the extra line is worth its space.
 */
export interface ConfirmQuestion {
  /** The toggle's label. It names what answering yes does, not the question in the abstract. */
  readonly question: string;
  /** What saying yes changes, in a sentence the organizer reads before they say it. */
  readonly note: string;
}

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
  /**
   * The one further question, where there is one to ask.
   *
   * Left off is the ordinary case: three of the four things this sheet confirms have nothing more
   * to ask, and an ending only has something to ask when the evening still holds a round nobody
   * played. Absent means the sheet is the single confirmation it has always been.
   */
  readonly question?: ConfirmQuestion;
}

/**
 * What came back out of the sheet: whether the act was confirmed, and how the question was
 * answered if it was asked.
 *
 * `answeredYes` is `false` on a sheet that asked nothing, which is the same thing the default says
 * — a question nobody was asked has not been answered yes.
 */
export interface ConfirmAnswer {
  readonly confirmed: boolean;
  readonly answeredYes: boolean;
}

/**
 * Every way out of the sheet that is not the confirming button, written once.
 *
 * Cancel, the backdrop, Escape and a sheet that never opened all mean the same two things, and the
 * safety of the whole component is that they cannot come to mean different ones.
 */
const NOTHING_CONFIRMED: ConfirmAnswer = { confirmed: false, answeredYes: false };

@Component({
  selector: 'app-confirm-sheet',
  templateUrl: './confirm-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmSheet {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);

  private readonly sheetRef = inject<DialogRef<ConfirmAnswer>>(DialogRef);

  protected readonly copy = copy;

  /**
   * How the further question stands right now. It starts as a no, and every way out of this sheet
   * that is not the confirming button leaves it one (ADR-0037 §1).
   */
  protected readonly answer = signal(false);

  protected toggle(): void {
    this.answer.update((held) => !held);
  }

  protected confirm(): void {
    this.sheetRef.close({ confirmed: true, answeredYes: this.answer() });
  }

  protected cancel(): void {
    this.sheetRef.close(NOTHING_CONFIRMED);
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
    return (await this.answered(data)).confirmed;
  }

  /**
   * Ask, and bring back the further question's answer along with the yes.
   *
   * The same sheet and the same safety: a dismissal is `undefined`, which is neither a yes nor an
   * answer, and both halves of the result say no.
   */
  async answered(data: ConfirmData): Promise<ConfirmAnswer> {
    const result = await this.sheets.open<ConfirmAnswer, ConfirmData>(ConfirmSheet, data);

    return result ?? NOTHING_CONFIRMED;
  }
}
