/*
 * Where a session lives between one opening of the app and the next (decision #19).
 *
 * The interface is the whole of the vendor boundary: `FirestoreSessionRepository` is the only file
 * in the app that touches a storage API, and the only one that imports the Firebase SDK
 * (ADR-0025). Everything above this line — the store, the screens, the tests — knows only these
 * eight operations, and two test doubles answer for them.
 *
 * They returned promises from the first day, months before anything behind them was asynchronous,
 * because the implementation that would replace `localStorage` was never going to be. That bet is
 * the reason step 3 was a swap: the six operations below reached Firestore with their signatures
 * untouched, and the listener that ADR-0027 adds is a seventh rather than a change to any of them.
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

  /**
   * Call `onChange` with the session in progress whenever it changes, until the returned function
   * is called (ADR-0025 §3).
   *
   * The seventh operation, and the only one added by the Firestore swap: the six above kept every
   * signature they had, which was the point of ADR-0019. It is here rather than folded into
   * `loadActive` because a listener has a lifetime and a one-shot read does not, and a caller has
   * to be able to end it.
   *
   * The organizer is the only writer, so this costs one read per write and buys one mechanism
   * instead of two — the spectator subscribes to a session exactly this way. What it is actually
   * for is the organizer with the app open on a phone and a laptop: two views of one evening that
   * converge, rather than a last write that silently erases the other's scores.
   *
   * `onChange` fires with `null` when there is no longer a session in progress, which is what
   * ending or discarding one looks like from here.
   */
  watchActive(onChange: (record: SessionRecord | null) => void): () => void;

  /**
   * Call `onChange` with the session at this share code whenever it changes, until the returned
   * function is called (ADR-0026 §2, ADR-0029 §1).
   *
   * The eighth operation, and the spectator's only one. ADR-0027 left open whether watching a
   * session by id was a widening of `watchActive` or an operation of its own; it is its own,
   * because the two are different queries against different rules. `watchActive` is an
   * owner-scoped `list` over a collection and cannot be asked without a uid; this is a `get` of
   * one document, allowed to anybody holding the code, which is the whole of what makes the code
   * the credential (ADR-0024 §3).
   *
   * `onChange` fires with `null` when there is no session at this code — deleted, or never a code
   * at all. Those are one answer on purpose: from the spectator's end they are indistinguishable,
   * and neither is anything the person holding the phone can act on.
   *
   * Nothing is reported until an answer is known. A device that is offline with nothing cached has
   * not been told the session is gone, and saying so would turn a signal problem into a bereavement.
   */
  watch(sessionId: string, onChange: (record: SessionRecord | null) => void): () => void;
}

export const SESSION_REPOSITORY = new InjectionToken<SessionRepository>('SessionRepository');
