/*
 * The repository the app runs on: one document per session in Firestore (ADR-0025).
 *
 * **This is the only file in the app that imports the Firebase SDK** (decision #19), which is why
 * it also answers for `Identity`: anonymous sign-in — and, since decision #14, linking a Google
 * account to it — is the same vendor and belongs behind the same door. Everything above this line
 * — the store, the screens, the tests — knows only `SessionRepository` and `Identity`, and the
 * in-memory fake answers for both.
 *
 * Four things this file is holding that are worth reading before changing it:
 *
 *   - **Firestore is the only source of truth, and writes are not awaited to the server**
 *     (ADR-0025 §1). A Firestore write promise settles when the *server* acknowledges, which on a
 *     court with no signal is never. Awaiting one would freeze the app at exactly the moment
 *     decision #15 promises it keeps working, so a write is dispatched, applied to the local cache
 *     immediately, and left to the SDK to reconcile on reconnect. Recording a score in airplane
 *     mode, reconnecting, and finding it landed is an acceptance criterion of this slice rather
 *     than a hope about it.
 *   - **The active session is a query, not a pointer** (ADR-0025 §2): `ownerUid == uid` and
 *     `status == 'in-progress'`, limit one. It needs the `list` rule and the composite index in
 *     `firestore.indexes.json`. There is no `users/{uid}` document holding an active session id,
 *     because that is a stored fact the documents already carry and it can drift.
 *   - **Active and history are the same collection**, told apart by `status`. That is what makes
 *     ending an evening one write rather than a move, and it is why `clearActive` deletes what the
 *     active query finds rather than deleting a known id: after `addToHistory` has flipped the
 *     status there is nothing in progress left to clear, and after a discard there is exactly one.
 *   - **`status` is duplicated at the top level** of the document, mirroring `session.status`.
 *     Nothing else in this project stores a derived fact, and this one exists because a Firestore
 *     query cannot reach a field the document nests. It is written from `session.status` on every
 *     write and from nowhere else, so the two cannot disagree.
 */
import { Injectable } from '@angular/core';
import type { SessionStatus } from 'padel-engine';
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  linkWithPopup,
  signInAnonymously,
  signInWithCredential,
} from 'firebase/auth';
import type { Auth, AuthError, User, UserInfo } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { Firestore, Query, QueryConstraint, QuerySnapshot } from 'firebase/firestore';
import { SESSIONS, firebaseConfig } from './firebase-config';
import type { Durability, Identity, LinkOutcome } from './identity';
import type { SessionRecord } from './session-record';
import type { SessionRepository } from './session-repository';

/**
 * A session as it sits in Firestore: the record, plus the two fields the rules and the query read.
 *
 * `ownerUid` is what ADR-0024 §2 makes ownership out of, and `status` is what ADR-0025 §2 finds
 * the active session by. Both are written here rather than by anything above, so no screen and no
 * store has to remember to carry them.
 */
interface SessionDocument extends SessionRecord {
  readonly ownerUid: string;
  readonly status: SessionStatus;
}

/**
 * The two values `status` holds, named rather than spelled out at each of the four places that
 * name one — the two queries, the write, and the guard in `clearActive`.
 *
 * They are the engine's own words (`SessionStatus`), so the compiler holds this file to the
 * vocabulary the document already uses and a typo cannot become a query that silently matches
 * nothing.
 */
const IN_PROGRESS: SessionStatus = 'in-progress';
const FINISHED: SessionStatus = 'finished';

@Injectable()
export class FirestoreSessionRepository implements SessionRepository, Identity {
  private readonly app = initializeApp(firebaseConfig);
  /**
   * Offline persistence, in the multi-tab manager (decision #15, ADR-0025 §1).
   *
   * This is the whole of the answer to the club basement: writes queue in IndexedDB, reads come
   * from the cache, and the SDK reconciles on reconnect. Multi-tab rather than single, because an
   * organizer with the app open on a phone and a laptop is a case ADR-0025 §3 wants to converge —
   * and because the single-tab manager makes the *second* tab the broken one, which is a bug
   * report nobody could describe.
   */
  private readonly db: Firestore = initializeFirestore(this.app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  private readonly auth: Auth = getAuth(this.app);
  private uid: string | null = null;
  /**
   * The evening this repository most recently wrote as ended, and the one thing `clearActive` will
   * not delete.
   *
   * `end()` writes the finished session and then asks for the active slot to be emptied, and both
   * of those are the same document. The active query should no longer match it — the SDK overlays
   * a pending write on the results it gets back — but "should" is doing far too much work for a
   * mistake that would delete the evening a moment after it was kept. So the id is remembered and
   * skipped, and the guarantee stops being one about SDK internals.
   *
   * The window it guards is one call of `end()` and nothing wider, which is why it is a field
   * rather than anything durable: an ended session that survives to a later launch is one the
   * cache or the server already reports as finished, and the query cannot return it at all.
   */
  private lastEnded: string | null = null;

  /**
   * The uid this device writes as, restored from the device where there is one.
   *
   * `authStateReady` settles from IndexedDB without a network, which is what makes every launch
   * after the first work in a basement. Only the first one reaches `signInAnonymously`, and only
   * that call can reject for want of a connection (ADR-0025 §4).
   */
  async signIn(): Promise<string> {
    await this.auth.authStateReady();
    const user = this.auth.currentUser ?? (await signInAnonymously(this.auth)).user;
    this.uid = user.uid;

    return user.uid;
  }

  /**
   * Whether the uid in hand is attached to a Google account, read off the user rather than
   * remembered (ADR-0028 §1).
   *
   * `providerData` is the list of ways this one account can be signed in to, and linking appends
   * to it without touching the uid — which is the whole of what makes linking safe for a session
   * whose `ownerUid` can never move (ADR-0024 §2). An anonymous user's list is empty.
   */
  durability(): Durability {
    const google = googleOn(this.auth.currentUser);

    return google === null ? { kind: 'browser' } : { kind: 'linked', account: google.email };
  }

  /**
   * Attach a Google account to the anonymous uid, keeping every session it owns (decision #14).
   *
   * `linkWithPopup` rather than the bare `linkWithCredential` decision #14 names: the popup is what
   * fetches the credential in a browser, and it hands it to the same operation underneath. A
   * redirect is the alternative and is the one to reach for if an installed iOS PWA turns out not
   * to open the popup — it costs a whole reload of the app and a `getRedirectResult` at startup,
   * which is machinery this does not need until that is known rather than feared (ADR-0028 §3).
   *
   * Nothing here writes to Firestore and nothing has to: the uid is unchanged, so every document
   * carrying it is still this organizer's and still passes every rule it passed a moment ago.
   */
  async linkGoogle(): Promise<LinkOutcome> {
    const user = this.auth.currentUser;
    if (user === null) {
      throw new Error('The app is not signed in. `signIn()` settles before an account is linked.');
    }

    try {
      const linked = await linkWithPopup(user, new GoogleAuthProvider());

      return { kind: 'linked', account: googleOn(linked.user)?.email ?? null };
    } catch (error) {
      return this.refusalOf(error);
    }
  }

  async loadActive(): Promise<SessionRecord | null> {
    return recordsIn(await getDocs(this.activeQuery()))[0] ?? null;
  }

  async saveActive(record: SessionRecord): Promise<void> {
    this.write(record);
  }

  /**
   * Leave no session in progress: delete whatever the active query finds.
   *
   * A query rather than a known id, because two different endings ask for this. `end()` writes the
   * finished session first, so by the time it gets here the query is empty and this does nothing —
   * which is what stops an evening being deleted a moment after it was kept. `discard()` has
   * written nothing, so the query finds the evening and this is decision #10's hard delete
   * arriving early.
   */
  async clearActive(): Promise<void> {
    for (const held of (await getDocs(this.activeQuery())).docs) {
      if (held.id !== this.lastEnded) {
        void deleteDoc(held.ref).catch(reportWriteFailure);
      }
    }
  }

  /**
   * Every ended evening, most recently ended first — ordered here rather than left to the caller.
   *
   * The store sorts what it is handed as well (ADR-0013 §4), and that is not a reason to skip it.
   * The interface says "most recently ended first" and a store returning documents in share-code
   * order would be keeping a signature while dropping its contract; the second sort is the store
   * refusing to depend on any store getting it right, which is what that comment says it is for.
   */
  async loadHistory(): Promise<readonly SessionRecord[]> {
    return recordsIn(
      await getDocs(this.ownedQuery(where('status', '==', FINISHED), orderBy('endedAt', 'desc'))),
    );
  }

  async addToHistory(record: SessionRecord): Promise<void> {
    this.write(record);
  }

  async deleteFromHistory(sessionId: string): Promise<void> {
    void deleteDoc(doc(this.db, SESSIONS, sessionId)).catch(reportWriteFailure);
  }

  watchActive(onChange: (record: SessionRecord | null) => void): () => void {
    return onSnapshot(
      this.activeQuery(),
      (snapshot) => onChange(recordsIn(snapshot)[0] ?? null),
      // A listener that loses its permission — the rules change, the uid does — must not take the
      // evening on screen with it. The store keeps whatever it last held, which is the record it
      // wrote itself.
      (error) => console.error('The session listener stopped.', error),
    );
  }

  /**
   * Write the record at `sessions/{shareCode}`, stamped with its owner and its status.
   *
   * `setDoc` rather than `updateDoc` because one session is one document (decision #13) and the
   * engine hands back a whole session on every operation — there is no partial change to make.
   * The record goes through JSON on the way in for the same reason the in-memory fake puts it
   * through in reverse: `SessionRecord` promises a shape that survives a round trip, Firestore
   * refuses an `undefined` value outright, and this is where a key quietly set to one is dropped
   * rather than thrown at the side of a court.
   *
   * The promise is deliberately not returned. See the note at the top of the file: awaiting a
   * server acknowledgement is the one thing that would make this app unusable offline.
   */
  private write(record: SessionRecord): void {
    const document: SessionDocument = {
      ...(JSON.parse(JSON.stringify(record)) as SessionRecord),
      ownerUid: this.owner(),
      status: record.session.status,
    };

    if (document.status === FINISHED) {
      this.lastEnded = record.session.id;
    }

    void setDoc(doc(this.db, SESSIONS, record.session.id), document).catch(reportWriteFailure);
  }

  private activeQuery(): Query {
    return this.ownedQuery(where('status', '==', IN_PROGRESS), limit(1));
  }

  /** Every query this repository makes is owner-scoped — the `list` rule allows nothing else. */
  private ownedQuery(...clauses: readonly QueryConstraint[]): Query {
    return query(collection(this.db, SESSIONS), where('ownerUid', '==', this.owner()), ...clauses);
  }

  /**
   * What a refused link was refused for, in the four words the app above can act on.
   *
   * The one that matters is `auth/credential-already-in-use`: the account belongs to another uid,
   * and Firebase hands back the credential it just fetched so that signing in as that account
   * needs no second popup. That matters more than it looks — the sign-in happens after a
   * confirmation, by which point the tap is no longer the gesture a browser would open a popup
   * for, so a second one could simply be blocked. Reusing this one is what makes the recovery a
   * question the organizer can take their time over (ADR-0028 §2).
   *
   * Everything that is not a dismissal is one word, `unavailable`, and is logged: the organizer's
   * move is the same for a blocked popup and a dead network, and the difference between them
   * belongs in the console rather than on the front door.
   */
  private refusalOf(error: unknown): LinkOutcome {
    // Read defensively rather than cast, because this is the one place in the file that has to
    // survive whatever it is handed. Everything Firebase rejects with carries a `code`, but a
    // rejection is not a promise about its own shape, and reading a property off a `null` here
    // would throw out of `linkGoogle` — past a caller that is not expecting one, leaving a button
    // that appears to do nothing at all.
    const code = codeOf(error);

    if (code === 'auth/credential-already-in-use') {
      const credential = GoogleAuthProvider.credentialFromError(error as AuthError);
      if (credential !== null) {
        return {
          kind: 'taken',
          account: (error as AuthError).customData.email ?? null,
          adopt: async () => {
            const { user } = await signInWithCredential(this.auth, credential);
            this.uid = user.uid;

            return user.uid;
          },
        };
      }
    }

    // Closing the Google window, and the race that fires when a second one is asked for while the
    // first is open. Neither is a failure and neither has anything to say.
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { kind: 'dismissed' };
    }

    // Everything else, including the collision above arriving without the credential it is
    // supposed to carry. That last one is a Firebase refusing to say which account it refused
    // over, which is a bug rather than a state the organizer is in — so it is logged like the
    // rest rather than given a sentence of its own that nobody could act on either.
    console.error('Linking a Google account failed.', error);

    return { kind: 'unavailable' };
  }

  private owner(): string {
    if (this.uid === null) {
      throw new Error('The app is not signed in. `signIn()` settles before any session is read.');
    }

    return this.uid;
  }
}

/**
 * The `code` on a rejection, where there is a rejection with a `code` on it.
 *
 * `null` for anything else — a string thrown, a `null` rejection, a `TypeError` from inside the
 * SDK. All of those are `unavailable`, which is where the four named codes' `default` goes anyway.
 */
function codeOf(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : null;
}

/**
 * The Google half of a user, or `null` for one that has never been linked.
 *
 * The one question both `durability` and a completed link ask, so it is asked in one place:
 * whether this user carries a Google provider at all is the whole of the browser-bound/linked
 * distinction, and its `email` is the address the front door names the account by. Read off the
 * provider rather than off `user.email`, which is the account's address rather than that
 * provider's and is only the same value by coincidence. The dictionary owns what a missing one is
 * called on screen (decision #20); this file's business is only whether there is one.
 */
function googleOn(user: User | null): UserInfo | null {
  return (
    user?.providerData.find((provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID) ??
    null
  );
}

/**
 * The records a snapshot holds, with the mirrored status dropped on the way out.
 *
 * `ownerUid` comes back because `SessionRecord` carries it; `status` does not, because the record
 * has never had one — the session inside it does, and that is the field every rule in the engine
 * is enforced against. Handing both up would be two answers to one question.
 */
function recordsIn(snapshot: QuerySnapshot): SessionRecord[] {
  return snapshot.docs.map((held) => {
    const { session, createdAt, courtNames, endedAt, ownerUid } = held.data() as SessionDocument;

    // Named field by field rather than spread-minus-status, so that a document carrying something
    // this app has never written cannot reach the store by accident. `endedAt` is put back only
    // where it was there: `SessionRecord` says an evening in progress carries no key for it, and
    // an explicit `undefined` is a different shape from an absent one.
    return {
      session,
      createdAt,
      courtNames,
      ownerUid,
      ...(endedAt === undefined ? {} : { endedAt }),
    };
  });
}

/**
 * A write the server refused, as opposed to one that has not reached it yet.
 *
 * Only a rejection lands here: a queued write on a device with no signal does not fail and does
 * not settle at all. So this is a permission error or a malformed document — a bug in this app
 * rather than anything an organizer can act on, which is why it is logged rather than surfaced.
 */
function reportWriteFailure(error: unknown): void {
  console.error('A session write was refused.', error);
}
