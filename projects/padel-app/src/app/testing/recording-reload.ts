/*
 * A reload a spec can see, and never actually performs.
 *
 * The real one is `location.reload()`, which in a test runner is the test runner going away, so no
 * spec may ever reach it — the same allowance `RecordingBuildReload` and `RecordingClipboard` make
 * for a device the test does not have.
 *
 * What replaces it is the harness's own `reload()`: a spec taps the language it wants, asks this
 * whether the app said to start again, and then reopens the app itself. That is a truer model of
 * the browser than a fake that re-rendered in place would be — the language is chosen by one app
 * and read by the next one, which is exactly the arrangement ADR-0032 §3 chose.
 */
import type { Reload } from '../preference/reload';

export class RecordingReload implements Reload {
  /** How many times the app has asked the browser to start it again. */
  asked = 0;

  now(): void {
    this.asked += 1;
  }
}
