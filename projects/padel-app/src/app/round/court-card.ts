/*
 * One court, written once: the name, the two sides, and the result — or the fact that there is
 * not one yet.
 *
 * It sits outside the Round tab because that tab instantiates it twice — as a button while the
 * evening is running, as plain content once it has ended — for the reason that comment gave: two
 * copies of a card drift apart a line at a time.
 *
 * The card owns the result now, where it used to project one in. That is not a change of mind
 * about who decides what a court says: it is that a scored court interleaves name, score, `v`,
 * name, score, and there is no single place left to project into. What the old seam was
 * protecting was one card written once for both of the Round tab's branches, and that is
 * unchanged — what the tab still owns is the frame, the border, the padding and whether the card
 * is a button, which is the one thing the two branches genuinely differ about. The preview of a
 * regenerated schedule (ADR-0015) shows no result at all — it is a schedule, and printing a score
 * there would invite the reading that a roster change can touch one — and it draws its courts as
 * single rows of its own rather than as this card. What the two screens do share is `app-side`,
 * which is where the same-gender mark is written once for both of them.
 *
 * So the card has two shapes, chosen by whether a score exists rather than by a slot that can hold
 * either thing. A scored court puts each number on its own team's row, right-aligned and on the
 * name's baseline, because the alternative — one `24 – 18` beside both names — leaves the reader
 * matching the first number to the first name. An unscored court is the older shape and stays
 * exactly as it was: the names in a column with `No score yet` beside them. The row each shape
 * arranges itself in is inside the template rather than on the host, because a card with two
 * shapes has two answers and a host class can only hold one — the host says only that the card is
 * a box.
 *
 * Both shapes walk the same two sides rather than naming A and B twice each, which is what keeps
 * the pair from drifting between the shapes the way the two cards themselves once threatened to.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { copy } from '../copy/copy';
import { Side } from './side';
import type { CourtView, SideView } from './round-view';

/** One side of the court as the card sets it: who they are, what they scored, and how it is set. */
interface SideOnTheCard {
  /** Which side of the court this is — A or B, which is also what makes it trackable. */
  readonly letter: 'A' | 'B';
  readonly view: SideView;
  /** The points beside this side's name, or `undefined` while the court is still playing. */
  readonly points?: number;
  /** The classes that set those points: the winner pointed at, the loser stated and left alone. */
  readonly emphasis: string;
}

@Component({
  selector: 'app-court-card',
  imports: [Side],
  templateUrl: './court-card.html',
  // The one thing the host still says: that a card is a box. Its shape is inside the template,
  // because there are two of them, but an element left inline would sit on a text baseline and
  // collect the descender space under it wherever a screen put one.
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtCard {
  readonly court = input.required<CourtView>();

  protected readonly copy = copy;

  /** Which of the two shapes this court is drawn in. */
  protected readonly scored = computed(() => this.court().score !== undefined);

  protected readonly sides = computed<readonly SideOnTheCard[]>(() => {
    const { sideA, sideB, score } = this.court();

    return [
      {
        letter: 'A',
        view: sideA,
        points: score?.sideA,
        emphasis: emphasisOf(score?.sideA, score?.sideB),
      },
      {
        letter: 'B',
        view: sideB,
        points: score?.sideB,
        emphasis: emphasisOf(score?.sideB, score?.sideA),
      },
    ];
  });
}

/**
 * The three ways a number is set on a card, and the classes that set them.
 *
 * Exported because it is the one thing about a result that is not words: a spec reading the
 * rendered text cannot tell a winner from a loser, and the difference is the whole point of
 * putting each number beside its own team. So the harness reads the treatment off the class the
 * card gave the number, named here rather than spelled out again in a test — the same seam
 * `SHEET_PANEL` opens for where a sheet is anchored.
 */
export const SCORE_EMPHASIS = {
  /** The higher score: brand, at the display face's only weight. */
  won: 'font-bold text-brand',
  /** The lower score: stated in muted ink and left alone. */
  lost: 'font-medium text-ink-muted',
  /** Level, and an unscored side's unused answer. */
  drawn: 'font-bold text-ink',
} as const;

export type ScoreEmphasis = keyof typeof SCORE_EMPHASIS;

/** How one side's points are set, read off the pair: pointed at, muted, or neither. */
function emphasisOf(points: number | undefined, against: number | undefined): string {
  if (points === undefined || against === undefined || points === against) {
    // A draw is neither treatment. It has no winner to point at and no loser to mute, so
    // borrowing either would state something untrue about a court that ended level. No board
    // draws one — an even target score is what reaches it, 24 going to 12–12. An unscored court
    // takes the same answer and never uses it: there is no number for it to set.
    return SCORE_EMPHASIS.drawn;
  }

  return points > against ? SCORE_EMPHASIS.won : SCORE_EMPHASIS.lost;
}
