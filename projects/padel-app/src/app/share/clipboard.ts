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
 */
import { InjectionToken } from '@angular/core';

export interface Clipboard {
  /** Put this text on the system clipboard. `false` where the browser would not. */
  write(text: string): Promise<boolean>;
}

export const CLIPBOARD = new InjectionToken<Clipboard>('Clipboard');

/**
 * The real one: the async Clipboard API, which is what every browser this app supports has.
 *
 * `document.execCommand('copy')` is the fallback the web usually reaches for, and it is not here.
 * It needs a hidden textarea, a selection and a synchronous stack, and it is deprecated — three
 * things to maintain for browsers this PWA already requires service workers and modules from.
 */
export class BrowserClipboard implements Clipboard {
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
