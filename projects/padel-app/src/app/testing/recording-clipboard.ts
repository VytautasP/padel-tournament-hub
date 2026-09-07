/*
 * A clipboard a spec can read, and can make refuse.
 *
 * The system clipboard is the one thing the share sheet does that leaves no mark on screen, so it
 * is the one thing a spec cannot assert by reading rendered text — which is exactly why the app
 * holds it behind a token. Reading `lastCopied` is the same allowance the drivers make for the
 * repository: a fake stands in for a device the test does not have, and the test asks it what it
 * was handed.
 *
 * Refusing is not a second class, because it is not a second clipboard: a browser that denies the
 * permission is this one on a different day.
 */
import type { Clipboard } from '../share/clipboard';

export class RecordingClipboard implements Clipboard {
  private writes = true;

  /** The last text put on the clipboard, or `null` where nothing ever was. */
  lastCopied: string | null = null;

  /** Deny every write from here on, as a browser without the permission does. */
  refuse(): void {
    this.writes = false;
  }

  async write(text: string): Promise<boolean> {
    if (!this.writes) {
      return false;
    }

    this.lastCopied = text;

    return true;
  }
}
