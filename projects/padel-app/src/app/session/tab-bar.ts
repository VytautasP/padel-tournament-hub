/*
 * The bar under the thumb: the three destinations of ADR-0016, in the posture the app is used in.
 *
 * Rendered instead of the rail rather than beside it, because exactly one navigation exists at a
 * time and that is a correctness requirement rather than a preference (ADR-0022 §5): the DOM test
 * seam drives this app by visible label, and two buttons labelled `Round` on one screen would
 * throw in every spec that tapped one.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Destination, Panel } from './destinations';

@Component({
  selector: 'app-tab-bar',
  templateUrl: './tab-bar.html',
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabBar {
  readonly destinations = input.required<readonly Destination[]>();
  readonly current = input.required<Panel>();

  readonly chose = output<Panel>();
}
