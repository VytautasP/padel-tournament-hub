/*
 * Putting the share link somewhere the organizer can paste it.
 *
 * A token rather than a call to `navigator.clipboard` from the sheet, for the same reason the
 * repository and the identity are tokens: it is a vendor boundary, it is asynchronous, and it can
 * refuse. A browser may deny the permission, an insecure origin has no clipboard API at all, and
 * a sheet that assumed the copy landed would tell the organizer their link is on the clipboard
 * when it is not — which is exactly the lie that gets found out in front of everybody.
 *
 * `write` answers whether the text is actually on the clipboard, so the one caller has something
 * to say either way. It never rejects: a refused permission is an answer rather than an exception,
 * and every failure here is the same failure from where the organizer is standing.
 *
 * `TextClipboard` rather than `Clipboard`, which is a name `lib.dom` already has: a file that
 * forgot the import would type-check against the browser's own interface and mean something else
 * entirely. `SessionRepository` and `Identity` have no such twin and need no such care.
 */
import { InjectionToken } from '@angular/core';

export interface TextClipboard {
  /** Put this text on the system clipboard. `false` where the browser would not. */
  write(text: string): Promise<boolean>;
}

export const CLIPBOARD = new InjectionToken<TextClipboard>('TextClipboard');

/**
 * The real one: the async Clipboard API.
 *
 * `document.execCommand('copy')` is the fallback the web usually reaches for, and it is not here.
 * It needs a hidden textarea, a selection and a synchronous stack, and it is deprecated — three
 * things to keep working so that a browser old enough to lack the async API can copy a link it
 * could equally be read the ten characters of.
 */
export class BrowserClipboard implements TextClipboard {
  async write(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);

      return true;
    } catch {
      // No permission, no clipboard, or an insecure origin. The sheet says the same sentence for
      // all three, because the organizer's move — read the code out instead — is the same.
      return false;
    }
  }
}
