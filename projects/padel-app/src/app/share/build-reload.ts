/*
 * Getting a tab that is running last week's build onto this week's.
 *
 * Every lazy import in this app — the two routes, and the QR encoder — asks hosting for a file
 * named after the hash of its contents. A deploy changes those names, and hosting rewrites what it
 * cannot find to `index.html` (ADR-0030), so the tab that was open across the deploy does not get
 * an error: it gets a page, offered to `import()` as a module, and the import rejects. A phone is
 * where this happens, because a phone keeps a tab alive for days while a laptop reloads a dozen
 * times an afternoon.
 *
 * That rejection is indistinguishable at the call site from the one a court with no signal
 * produces, and the two want opposite answers: one is a sentence saying to use the code instead,
 * the other is a page that should be replaced by the current one. So the decision is not made at
 * the call site. A caller that has been refused a chunk asks here, and gets back whether a reload
 * is on its way.
 *
 * A token for the same reason the clipboard is one: it is a browser boundary, it is the kind of
 * thing a spec must be able to answer both ways, and a test that called the real one would reload
 * the test runner.
 */
import { InjectionToken } from '@angular/core';

export interface BuildReload {
  /**
   * A chunk did not arrive. Reload onto the build hosting is serving now, if that is the answer.
   *
   * `true` where a reload is under way and the caller should render nothing further — the page is
   * going away. `false` where this is a genuine network failure and the caller's own fallback is
   * what the person in front of it needs.
   */
  attempt(): boolean;
}

export const BUILD_RELOAD = new InjectionToken<BuildReload>('BuildReload');

/**
 * The real one: reload once, and only where a reload could plausibly help.
 *
 * Two guards, and the app would be worse without either. Offline, a reload takes away a working
 * app and returns nothing, so a phone with no signal is answered `false` and keeps what it has.
 * And once per tab, recorded in `sessionStorage`, because a chunk that is genuinely missing from
 * the deploy would otherwise reload the page every time somebody opens the sheet — a loop that
 * looks like the app crashing rather than like the bug it is.
 *
 * `sessionStorage` rather than a field, because the field does not survive the reload it is there
 * to count. A browser that refuses storage is answered `false`: no reload is worse than a loop.
 */
export class BrowserBuildReload implements BuildReload {
  /** Where the one permitted reload per tab is remembered. */
  private static readonly ATTEMPTED = 'padel:build-reload';

  attempt(): boolean {
    if (!navigator.onLine) {
      return false;
    }

    try {
      if (sessionStorage.getItem(BrowserBuildReload.ATTEMPTED) !== null) {
        return false;
      }

      sessionStorage.setItem(BrowserBuildReload.ATTEMPTED, '');
    } catch {
      // Storage denied, so there is nowhere to count the attempt and no way to stop at one.
      return false;
    }

    location.reload();

    return true;
  }
}
