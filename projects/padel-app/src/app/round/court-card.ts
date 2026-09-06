/*
 * One court, written once: the name, the two sides, and whatever the screen showing it has to say
 * about the result.
 *
 * It sits outside the Round tab because that tab instantiates it twice — as a button while the
 * evening is running, as plain content once it has ended — for the reason that comment gave: two
 * copies of a card drift apart a line at a time.
 *
 * What it deliberately does not own is the result. The Round tab shows a scoreline or `No score
 * yet`, so the card projects that line rather than deciding it. The preview of a regenerated
 * schedule (ADR-0015) shows neither — it is a schedule, and printing a score there would invite
 * the reading that a roster change can touch one — and it draws its courts as single rows of its
 * own rather than as this card, because there a court is a line being read through rather than a
 * card being tapped. What the two screens do share is `app-side`, which is where the same-gender
 * mark is written once for both of them.
 *
 * The frame is not here either — the border, the padding, whether it is a button — because that is
 * what differs between the two, and it is the one thing each screen genuinely has an opinion
 * about.
 *
 * What the card does own is the shape the canvas draws: the names in a column, and the result
 * beside them rather than under them, so a court is one line of sight from the court name to the
 * score. That row is a host class rather than something each screen remembers to apply, because a
 * card whose two halves only sit side by side when the screen says so is a card that renders wrong
 * the first time somebody adds a fourth screen.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { copy } from '../copy/copy';
import { Side } from './side';
import type { CourtView } from './round-view';

@Component({
  selector: 'app-court-card',
  imports: [Side],
  templateUrl: './court-card.html',
  host: { class: 'flex items-center gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtCard {
  readonly court = input.required<CourtView>();

  protected readonly copy = copy;
}
