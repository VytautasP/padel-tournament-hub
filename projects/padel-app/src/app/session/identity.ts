/*
 * Who the app is, as far as the store is concerned (decisions #12 and #14, ADR-0025 §4, ADR-0028).
 *
 * Anonymous Auth mints a uid on Firebase's servers and every session the organizer owns carries
 * it (ADR-0024 §2). That uid belongs to the browser rather than to the person, which is the whole
 * of the problem decision #14 named: clear site data, switch phone, or let iOS evict storage, and
 * every evening that uid owned is unreachable forever, because `ownerUid` cannot move and nothing
 * can prove a new uid is the same organizer.
 *
 * Linking a Google account is the answer, and it is three operations rather than one because the
 * account can already be taken. `linkGoogle` keeps the uid and attaches an account to it;
 * `durability` says which of the two states the app is in, so the front door can tell the truth
 * about it; and the `adopt` a taken account hands back is the way home from a browser that lost
 * its uid (ADR-0028 §2).
 *
 * It is a token of its own rather than a method on `SessionRepository` because the repository's
 * seven operations are a promise ADR-0019 made, ADR-0025 kept and ADR-0027 extended by exactly one.
 * `FirestoreSessionRepository` implements both interfaces, so decision #19 still holds literally:
 * one file in the app imports the Firebase SDK, and it is that one.
 */
import { InjectionToken } from '@angular/core';

/**
 * How durable the organizer's history is: this browser only, or an account that outlives it.
 *
 * The distinction the front door renders. It is asked of the identity on every read rather than
 * stored anywhere, for the same reason the standings are (ADR-0008): linking changes it, and a
 * second copy of the answer is a second thing to keep in step.
 */
export type Durability =
  { readonly kind: 'browser' } | { readonly kind: 'account'; readonly account: string | null };

/** The account is attached to the uid the organizer already had. Nothing moved; nothing was lost. */
export interface LinkedAccount {
  readonly kind: 'linked';
  readonly account: string | null;
}

/**
 * The account already belongs to another uid — the browser this organizer used before, almost
 * always (ADR-0028 §2).
 *
 * `adopt` is the way through it: sign in as that account and become the uid that owns its
 * sessions. It is a closure rather than a second method on `Identity` for the reason
 * `RosterChange` is a value rather than a flag (ADR-0015) — the caller holds the thing it may
 * commit, so it cannot be committed out of order, and the credential the sign-in needs stays
 * inside the one file allowed to know what a credential is.
 *
 * It resolves to the uid now in hand, which is a *different* uid from the one before it. Every
 * session the app is holding belongs to the old one, so whatever calls this has to read again.
 */
export interface TakenAccount {
  readonly kind: 'taken';
  readonly account: string | null;
  readonly adopt: () => Promise<string>;
}

/**
 * What came of asking to link, including the two answers that are not failures.
 *
 * `dismissed` is the organizer closing the Google window, which is an answer and not an error —
 * saying something went wrong would be telling them they made a mistake by changing their mind.
 * `unavailable` is everything else: no signal, a blocked popup, a project misconfigured. One word
 * for all of them, because the organizer's move is the same and the detail belongs in the console.
 */
export type LinkOutcome =
  LinkedAccount | TakenAccount | { readonly kind: 'dismissed' } | { readonly kind: 'unavailable' };

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

  /**
   * Whether the uid in hand outlives this browser. Read after `signIn`, and again after anything
   * that could have changed it.
   */
  durability(): Durability;

  /**
   * Attach a Google account to the uid already in hand, keeping every session it owns
   * (ADR-0028 §1).
   *
   * A link rather than a sign-in: the uid does not change, so nothing has to be moved and
   * `ownerUid` stays as immutable as ADR-0024 §2 says it is. The one case where that cannot be
   * done is the account already belonging to somebody, and `taken` is that case handed back with
   * the way through it rather than as an error.
   */
  linkGoogle(): Promise<LinkOutcome>;
}

export const IDENTITY = new InjectionToken<Identity>('Identity');
