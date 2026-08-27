/*
 * One court, written once: the name, the two sides, and whatever the screen showing it has to say
 * about the result.
 *
 * It began inside the Round tab as a template instantiated twice — as a button while the evening
 * is running, as plain content once it has ended — for the reason that comment gave: two copies of
 * a card drift apart a line at a time. The preview of a regenerated schedule (ADR-0015) is a third
 * screen showing the same four people on the same court, so the card moved out here rather than
 * being written a third time.
 *
 * What it deliberately does not own is the result. The Round tab shows a scoreline or `No score
 * yet`; the preview shows neither, because it is a schedule and printing a score there would
 * invite the reading that a roster change can touch one. So the card projects that line rather
 * than deciding it, and neither screen has to be told what the other renders.
 *
 * The frame is not here either — the border, the padding, whether it is a button — because that is
 * what differs between the three, and it is the one thing each screen genuinely has an opinion
 * about.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { copy } from '../copy/copy';
import type { CourtView } from './round-view';

@Component({
  selector: 'app-court-card',
  templateUrl: './court-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtCard {
  readonly court = input.required<CourtView>();

  protected readonly copy = copy;
}
