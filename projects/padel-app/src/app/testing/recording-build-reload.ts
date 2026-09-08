/*
 * A build reload a spec can read, and can make answer either way.
 *
 * The real one ends in `location.reload()`, which in a test runner is the test runner going away,
 * so no spec may ever reach it. This one records the ask instead — the same allowance
 * `RecordingClipboard` makes for a device the test does not have.
 *
 * It answers `false` by default, which is the phone at a court with no signal: the reload is not
 * the answer and the caller renders its own fallback. Every spec written before a deploy could
 * strand a tab therefore goes on meaning what it meant. A spec about the tab that missed a deploy
 * says `reloading()` in one word.
 */
import type { BuildReload } from '../share/build-reload';

export class RecordingBuildReload implements BuildReload {
  private reloads = false;

  /** How many times a caller was refused a chunk and asked what to do about it. */
  asked = 0;

  /** A tab that is one deploy behind: from here on, the answer is a reload. */
  reloading(): this {
    this.reloads = true;

    return this;
  }

  attempt(): boolean {
    this.asked += 1;

    return this.reloads;
  }
}
