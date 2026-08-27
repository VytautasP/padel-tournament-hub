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
 * active session is addressed as *the* active session rather than by id. History is the other
 * half of that decision and is addressed by id, because a list has to be able to name the row
 * being deleted. The repository does not enforce the cardinality — nothing here stops two
 * records being written, and the store is what makes sure only one of them is in progress
 * (ADR-0013 §5 keeps this interface shaped for the Firestore swap rather than for today's counts).
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

  /** Every ended session, most recently ended first. Empty before any evening has been ended. */
  loadHistory(): Promise<readonly SessionRecord[]>;
  /** Keep `record` as an ended session, at the front of the history. */
  addToHistory(record: SessionRecord): Promise<void>;
  /** Forget the ended session with this id, permanently (decision #10). */
  deleteFromHistory(sessionId: string): Promise<void>;
}

export const SESSION_REPOSITORY = new InjectionToken<SessionRepository>('SessionRepository');
