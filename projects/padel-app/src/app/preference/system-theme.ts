/*
 * What the phone thinks, and the only file in the app that asks it (ADR-0031 §3).
 *
 * The same vendor-boundary arrangement `LAYOUT` uses for widths, and for the same two reasons.
 * `prefers-color-scheme` is a browser API the unit test environment does not implement, so a
 * signal is the seam that lets a spec state which kind of phone it is on. And it has to be a
 * signal rather than a media query in CSS because `system` is applied by JavaScript here — the app
 * stamps a *resolved* theme onto `<html>`, so something has to notice the OS changing under a
 * session that is already open and re-stamp it, without a reload.
 */
import { InjectionToken, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { ResolvedTheme } from './theme';

export interface SystemTheme {
  /** Which way the OS is set right now. Changes when the organizer changes it. */
  readonly theme: Signal<ResolvedTheme>;
}

export const SYSTEM_THEME = new InjectionToken<SystemTheme>('SystemTheme');

/** The query the whole of this file exists to ask, written once. */
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The real one: `matchMedia`, read once and then followed.
 *
 * The first read is synchronous and is what the app boots with, so nothing flashes through light
 * on its way to dark. The listener is what makes a `system` organizer's sunset work while the app
 * is open, which is the situation the whole default exists to serve.
 *
 * A browser without `matchMedia` is treated as a light one rather than as an error. There is no
 * such browser this app runs on, and guessing light is what the app did before it could be asked.
 */
export class MediaSystemTheme implements SystemTheme {
  private readonly current = signal<ResolvedTheme>('light');

  readonly theme = this.current.asReadonly();

  constructor() {
    const query = window.matchMedia?.(DARK_QUERY);
    if (query === undefined) {
      return;
    }

    this.current.set(query.matches ? 'dark' : 'light');
    query.addEventListener('change', (event) => this.current.set(event.matches ? 'dark' : 'light'));
  }
}
