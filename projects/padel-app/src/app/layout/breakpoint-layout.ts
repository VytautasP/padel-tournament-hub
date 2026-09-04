/*
 * The tier, read off the window (ADR-0022 §1).
 *
 * This is the only file in the app that imports CDK's `BreakpointObserver`, and it exists so that
 * it can stay the only one — the vendor-boundary arrangement `SessionRepository` established
 * (ADR-0019). Every other file asks `LAYOUT` for a tier and never learns that a media query was
 * involved.
 *
 * The two widths are the ADR's, and the upper one is 1280 rather than 1024 because the chrome
 * decides it: a 248px rail plus a 340px aside is 588px before any content, which leaves too little
 * for the two-up grid at 1024.
 *
 * `requireSync` is safe and is the point: `observe` replays the current match synchronously when
 * it is subscribed, so the first paint already knows which tier it is in and no screen flashes
 * through the phone on its way to the desk.
 */
import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import type { Layout, Tier } from './layout';

/** Where each tier starts, in CSS pixels. Below the first one is the phone. */
const WIDE_FROM = 768;
const DESK_FROM = 1280;

const WIDE = `(min-width: ${WIDE_FROM}px)`;
const DESK = `(min-width: ${DESK_FROM}px)`;

@Injectable()
export class BreakpointLayout implements Layout {
  readonly tier = toSignal(
    inject(BreakpointObserver)
      .observe([WIDE, DESK])
      .pipe(map(({ breakpoints }) => tierOf(breakpoints))),
    { requireSync: true },
  );
}

function tierOf(breakpoints: Record<string, boolean>): Tier {
  if (breakpoints[DESK]) {
    return 'desk';
  }

  return breakpoints[WIDE] ? 'wide' : 'phone';
}
