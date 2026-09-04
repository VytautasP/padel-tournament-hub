/*
 * The layout the tests run on: one tier, stated at launch and held there.
 *
 * A test asks for the shape it is about rather than for a width, which is what keeps the widths
 * themselves in one file (`BreakpointLayout`) and out of every spec that merely needs a desk.
 * Nothing here resizes, because nothing in this app behaves differently for having been resized
 * into a tier rather than opened in one.
 */
import { signal } from '@angular/core';
import type { Layout, Tier } from './layout';

export class FixedLayout implements Layout {
  readonly tier;

  constructor(tier: Tier) {
    this.tier = signal(tier).asReadonly();
  }
}
