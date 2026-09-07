# 25. Firestore is the only source of truth, and the first launch needs the network

- **Status:** Accepted
- **Date:** 2026-09-07
- **Relates to:** decisions #11, #12, #13, #15, #19 and #23 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0013](0013-one-active-session-and-every-ended-session-is-kept.md),
  [ADR-0019](0019-the-app-has-no-router-and-the-repository-is-asynchronous.md) and
  [ADR-0024](0024-the-share-code-is-the-document-id-and-ownership-is-an-immutable-uid.md)

## Context

Decision #19 exists so that step 3 is a swap: `FirestoreSessionRepository` replaces
`LocalStorageSessionRepository` behind an interface every caller was already written against, and
ADR-0019 made that interface asynchronous a step early for exactly this moment.

But "replaces" hides a choice. A padel court is a place with bad signal, and the tempting shape is
to keep writing to `localStorage` — which cannot fail — and to push a copy to Firestore for the
spectators. Two stores, one of them authoritative, the other visible to everybody else.

The interface also hides a second problem. `loadActive()` takes no id, because ADR-0013 says there
is at most one session in progress. Over `localStorage` that was a fixed key. Over Firestore the
active session has to be *found*.

## Decision

**1. Firestore is the source of truth, and there is no second store.**
`LocalStorageSessionRepository` survives only as a test double beside the in-memory fake. Firestore's
offline persistence is the answer to the club basement: writes queue, reads come from cache, the SDK
reconciles on reconnect.

Mirroring to `localStorage` would buy immunity to a Firestore outage and would cost the one thing
this project has been careful about everywhere else — a single place where a fact lives. Two stores
that can disagree means owning the reconciliation the SDK already implements, and discovering the
divergence at the side of a court, mid-evening, with eleven people waiting.

The mitigation is a test rather than an argument: recording a score with the device in airplane
mode, reconnecting, and confirming it lands is an acceptance criterion of the slice, not something
to find out on a Tuesday.

**2. The active session is a query, not a pointer.** `loadActive()` queries `sessions` for
`ownerUid == uid` and `status == 'in-progress'`, limit one. It needs the `list` rule from
ADR-0024 §3 and a composite index.

The alternative was a `users/{uid}` document holding `activeSessionId`. It reads in one hop instead
of scanning, and it stores a fact the documents already carry — so it can drift, and then Resume and
the session history disagree about the same evening. The repository still does not enforce the
cardinality; ADR-0013 §5 leaves that to the store, and this changes nothing about that.

**3. Both surfaces read through a live listener.** The organizer's app subscribes to its active
session exactly as a spectator subscribes to theirs. The organizer is the only writer, so a listener
costs one read per write — irrelevant against 50,000 a day — and buys one mechanism instead of two.
It also makes the organizer with the app open on a phone and a laptop a case that converges rather
than one where the last write silently erases an evening of scores.

**4. The first launch on a device needs the network, and says so.** Anonymous sign-in mints the uid
on Firebase's servers; until that has happened once there is no uid, and so no session. Every later
launch restores the uid locally and works offline.

The app is already unstable — via `PendingTasks`, per ADR-0019 §2 — until the first read settles.
This adds unstable-until-first-auth, and with it a state that has to be designed: a screen that says
a connection is needed the first time, not a spinner that never resolves. Creating a session locally
and adopting it once auth succeeds is the mirroring of point 1 wearing a disguise, for a case that
happens once per device.

**5. Sessions already in `localStorage` are left behind.** History starts empty in production. A
migration path is permanent code for a one-time event; if there turns out to be an evening worth
keeping, it is worth a throwaway script and not a branch that ships forever.

## Consequences

- A Firestore outage, or an exhausted quota, stops an evening. Decision #11's pure client-side
  engine means the app could in principle keep playing without a server; after this decision it
  will not. That is the price of one source of truth and it is accepted knowingly.
- `deleteFromHistory` is now a real hard delete of a document, which is what decision #10 promised
  and `localStorage` only approximated.
- The composite index on `ownerUid` and `status` is deployable configuration
  (`firestore.indexes.json`) and part of the deploy, not something clicked in a console.
- A cold cache with no network — a fresh install offline — returns no active session rather than an
  error, because a query has nothing local to answer from. The UI has to tell that truth rather
  than render an empty landing page.
- `SessionRepository` keeps all six of its operations and none of its signatures change. That was
  the point of ADR-0019 and it survives contact with the network.
