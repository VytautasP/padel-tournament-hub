/*
 * Where a session lives between one opening of the app and the next (decision #19).
 *
 * The interface is the whole of the vendor boundary: `LocalStorageSessionRepository` is the only
 * file in the app that touches a storage API today, and the Firestore implementation of step 3
 * will be the only one that imports the Firebase SDK. Everything above this line — the store, the
 * screens, the tests — knows only these three operations.
 *
 * They return promises even though local storage is synchronous, because the implementation that
 * replaces it will not be. A synchronous interface here would buy nothing and would have to be
 * unpicked through every caller the moment a network appeared behind it.
 *
 * There is exactly one active session at a time (decision #13 / ADR-0013), which is why the
 * active session is addressed as *the* active session rather than by id.
 */
import { InjectionToken } from '@angular/core';
import type { SessionRecord } from './session-record';

export interface SessionRepository {
  /** The session in progress, or `null` if there is none. */
  loadActive(): Promise<SessionRecord | null>;
  /** Store `record` as the session in progress, replacing whatever was there. */
  saveActive(record: SessionRecord): Promise<void>;
  /** Leave no session in progress. */
  clearActive(): Promise<void>;
}

export const SESSION_REPOSITORY = new InjectionToken<SessionRepository>('SessionRepository');
