/*
 * Starting the app again, on purpose (ADR-0032 §3).
 *
 * Changing the language reloads. The alternative was making the dictionary a signal, which turns
 * all 136 `copy.…` reads across 26 templates into `copy().…` permanently, in nearly every file in
 * the app — and buys an instant switch of a control an organizer touches once. ADR-0025 puts every
 * byte of session state in Firestore, so the reload costs a re-fetch and never an in-flight score,
 * and the pre-paint script in `index.html` reads the preference on the way back up, so the app
 * that returns is in the new language before it paints.
 *
 * A token for the reason the clipboard and the build reload are tokens: it is a browser boundary,
 * and a test that called the real one would reload the test runner.
 *
 * It is not `BUILD_RELOAD`, which is next door and does something that looks identical. That one
 * answers a *question* — a chunk did not arrive, is a reload the answer? — and it guards itself
 * with `navigator.onLine` and a once-per-tab count because the caller does not know why it failed
 * (ADR-0030). This one is told. There is nothing to decide and nothing to count: the organizer
 * asked for a language, and offline is where they are most likely to be asking.
 */
import { InjectionToken } from '@angular/core';

export interface Reload {
  /** Start this app again at the address it is on. Nothing after this call is worth doing. */
  now(): void;
}

export const RELOAD = new InjectionToken<Reload>('Reload');

/** The real one, which is the browser's own. */
export class BrowserReload implements Reload {
  now(): void {
    location.reload();
  }
}
