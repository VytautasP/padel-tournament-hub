/*
 * The preference store the tests run on: a map, and a switch that makes it refuse.
 *
 * It survives a `reload()` for the same reason the in-memory repository does — the harness hands
 * the same object to the app it opens again — which is what makes "the choice comes back" a thing
 * a spec can ask rather than a thing it has to trust.
 *
 * `refusing()` is the browser with site data blocked, and it refuses by *dropping* the write
 * rather than by throwing. The throwing is `BrowserPreferenceStorage`'s problem and is caught
 * there; what the app above it experiences either way is a write that did not stick, which is the
 * only behaviour a spec can meaningfully pin.
 */
import type { PreferenceStorage } from '../preference/preference-storage';

export class RecordingPreferenceStorage implements PreferenceStorage {
  private readonly held = new Map<string, string>();

  private constructor(private readonly keeps: boolean) {}

  /** A browser that remembers, which is nearly all of them. */
  static remembering(): RecordingPreferenceStorage {
    return new RecordingPreferenceStorage(true);
  }

  /** A browser with site data blocked: every write goes nowhere, and nothing throws. */
  static refusing(): RecordingPreferenceStorage {
    return new RecordingPreferenceStorage(false);
  }

  /** Put a value here as a previous visit would have, including one this app cannot read. */
  put(key: string, value: string): void {
    this.held.set(key, value);
  }

  read(key: string): string | null {
    return this.held.get(key) ?? null;
  }

  write(key: string, value: string): void {
    if (this.keeps) {
      this.held.set(key, value);
    }
  }
}
