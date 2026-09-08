/*
 * The desk's navigation: which evening this is, and the two places it offers (ADR-0022 §2).
 *
 * The rail names the evening before it names its destinations. Somebody with two laptop windows
 * open should not have to tap something to find out which night is in which — and on the
 * spectator's route, where the evening is somebody else's, it is the only thing on screen that
 * says which one they are watching.
 *
 * It carries two destinations rather than three, because at this tier the standings are an aside
 * that never leaves. That fact lives in `destinations.ts` and is handed in, so a rail cannot
 * disagree with the bar about what the tier means.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { copy } from '../copy/copy';
import type { Destination, Panel } from './destinations';

@Component({
  selector: 'app-session-rail',
  templateUrl: './session-rail.html',
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionRail {
  readonly destinations = input.required<readonly Destination[]>();
  readonly current = input.required<Panel>();
  /** Which evening this rail belongs to: the line under the app's name. */
  readonly summary = input('');

  readonly chose = output<Panel>();

  protected readonly copy = copy;
}
