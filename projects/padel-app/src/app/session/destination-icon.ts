/*
 * The mark beside a destination's name, written once for the two navigations that draw it.
 *
 * The rail and the island are separate components on purpose — exactly one navigation exists at a
 * time and that is a correctness requirement rather than a preference (ADR-0022 §5) — but the
 * three drawings are the same three drawings, and the Modern idiom puts a label beside an icon in
 * both shapes rather than only in the rail (ADR-0035 §2, move 3). Two copies of a court seen from
 * above is one copy too many; the rail's own copy had already lost the standings mark, which is a
 * gap nobody notices because the desk tier has no standings destination to draw it on.
 *
 * It is decoration throughout. The word beside it is the name of the destination, so the drawing
 * is `aria-hidden` and the button announces itself as its label and nothing else.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Panel } from './destinations';

@Component({
  selector: 'app-destination-icon',
  templateUrl: './destination-icon.html',
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinationIcon {
  readonly panel = input.required<Panel>();
}
