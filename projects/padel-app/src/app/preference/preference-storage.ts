/*
 * The only thing in this app that touches `localStorage` (ADR-0031 §4).
 *
 * A token rather than a call to `localStorage` from wherever a preference is read, for the same
 * reason the clipboard is one: it is a browser API that can simply refuse. Private mode, blocked
 * site data and a few corporate policies all turn a read or a write into a thrown exception rather
 * than a returned `null`, and a preference module that assumed otherwise would crash the app at
 * launch over a choice about colour.
 *
 * It stores *preferences* and nothing else. ADR-0025 makes Firestore the only source of truth for
 * a session — rounds, scores, roster, history — and none of that is here or ever will be. Clearing
 * site data loses what this holds, and that is the correct outcome rather than a tolerated one.
 *
 * Strings in and strings out, deliberately. The other reader of these keys is the pre-paint script
 * in `index.html`, which has no types, no imports and no JSON parser, so anything richer than a
 * word would be a format two pieces of code had to agree about in silence.
 */
import { InjectionToken } from '@angular/core';

export interface PreferenceStorage {
  /** The value stored under this key, or `null` where there is none — or none can be read. */
  read(key: string): string | null;
  /** Keep this value under this key. A browser that refuses is not an error, it is an answer. */
  write(key: string, value: string): void;
}

export const PREFERENCE_STORAGE = new InjectionToken<PreferenceStorage>('PreferenceStorage');

/**
 * The real one: `localStorage`, with both halves wrapped.
 *
 * A failed write is swallowed rather than reported. There is nothing the organizer could do about
 * it and nothing worth saying: the switch applies for this visit and does not come back on the
 * next one, which is the honest outcome of a browser that was told not to remember things.
 */
export class BrowserPreferenceStorage implements PreferenceStorage {
  read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Blocked site data, or a quota. The app goes on working; the choice lasts this visit.
    }
  }
}
