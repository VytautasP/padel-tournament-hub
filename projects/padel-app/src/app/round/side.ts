/*
 * One side of a court, as it is read: the two names, and the mark where the roster forced them
 * together (ADR-0010).
 *
 * It is a component for one reason — the mark. Two screens now show a side, the Round tab's card
 * and the preview of a regenerated schedule, and they draw the court around it differently: a
 * column to be tapped in one, a row to be read through in the other. What must not differ is the
 * mark and the sentence a screen reader announces in its place, because a glyph that means
 * `same-gender pair` on one screen and nothing on the other is worse than no glyph at all.
 *
 * So the names and the mark live here, and everything about how the side is set — its size, its
 * ink, whether it sits beside the other side or above it — stays with the screen, which is the
 * only one of the two that has an opinion about it.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { copy } from '../copy/copy';
import type { SideView } from './round-view';

@Component({
  selector: 'app-side',
  templateUrl: './side.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Side {
  readonly side = input.required<SideView>();

  protected readonly copy = copy;
}
