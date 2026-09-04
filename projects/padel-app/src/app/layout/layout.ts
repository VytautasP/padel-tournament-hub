/*
 * Which of the three shapes the app is currently wearing (ADR-0022).
 *
 * Below 768px it is the phone, exactly as drawn. Between 768 and 1279 it is the same layout
 * widened, with courts two-up and the bottom navigation kept. At 1280 and above it is a rail and a
 * standings aside.
 *
 * Almost nothing needs this. CSS expresses every width change that does not duplicate a label —
 * courts going two-up is a grid utility and involves no JavaScript — and only the two changes that
 * genuinely restructure the DOM read the tier from here: the navigation, and where a focused
 * surface opens (ADR-0022 §5).
 *
 * Those two have to be a signal rather than a media query, and the reason is the test seam. The
 * DOM harness drives the app by visible label and recognises only the `hidden` attribute and
 * `aria-hidden` as off screen — it cannot evaluate CSS, because the unit test environment does no
 * layout and loads no stylesheet. A Tailwind-only responsive navigation would put two buttons
 * labelled "Round" in the DOM at once and the harness would throw on the ambiguity. Reading the
 * tier from a signal keeps exactly one of them in the DOM by construction, and makes the tier a
 * stated thing a test can set.
 *
 * This interface is the whole of the vendor boundary, the same arrangement `SessionRepository`
 * already uses (ADR-0019): `BreakpointLayout` is the only file in the app that touches CDK's
 * `BreakpointObserver`, `FixedLayout` is what tests run on, and nothing above this line knows
 * which one it got — or that widths are involved at all.
 */
import { InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';

/**
 * The three shapes, named for the situation rather than for the width.
 *
 * `wide` is the middle tier — a tablet, or a laptop window that has not been given the whole
 * screen. It invents nothing: it is the desktop court grid wearing the phone's navigation.
 */
export type Tier = 'phone' | 'wide' | 'desk';

export interface Layout {
  /** The tier the app is in right now. Changes as the window is resized. */
  readonly tier: Signal<Tier>;
}

export const LAYOUT = new InjectionToken<Layout>('Layout');
