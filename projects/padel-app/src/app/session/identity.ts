/*
 * Who the app is, as far as the store is concerned (decision #12, ADR-0025 §4).
 *
 * Anonymous Auth mints a uid on Firebase's servers and every session the organizer owns carries
 * it (ADR-0024 §2). That is the whole of the identity this product has: there are no accounts, no
 * names and no way to prove that two uids are the same person — which is why clearing site data
 * loses every session, and why decision #14's Google linking is the next slice rather than a
 * later one.
 *
 * It is a token of its own rather than a method on `SessionRepository` because the repository's
 * six operations are a promise ADR-0019 made and ADR-0025 §5 kept. `FirestoreSessionRepository`
 * implements both interfaces, so decision #19 still holds literally: one file in the app imports
 * the Firebase SDK, and it is that one.
 */
import { InjectionToken } from '@angular/core';

export interface Identity {
  /**
   * The uid this device writes as, signing in if it has not already.
   *
   * Rejects when there is no uid *and* no network — the first launch on a device, in a basement
   * (ADR-0025 §4). Every later launch restores the uid from the device and resolves offline, so
   * this is a once-per-device failure and not a once-per-evening one. The app renders that
   * rejection as a screen saying a connection is needed rather than as a spinner that never ends.
   */
  signIn(): Promise<string>;
}

export const IDENTITY = new InjectionToken<Identity>('Identity');
