# 27. The live listener is a seventh repository operation, and identity is a seam of its own

- **Status:** Accepted
- **Date:** 2026-09-07
- **Supersedes:** the "all six of its operations" consequence in
  [ADR-0025](0025-firestore-is-the-only-source-of-truth.md)
- **Relates to:** decisions #12, #14, #19 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0019](0019-the-app-has-no-router-and-the-repository-is-asynchronous.md),
  [ADR-0024](0024-the-share-code-is-the-document-id-and-ownership-is-an-immutable-uid.md) and
  [ADR-0025](0025-firestore-is-the-only-source-of-truth.md)

## Context

ADR-0025 asked for two things that its own last consequence did not leave room for.

§3 says both surfaces read through a live listener: "The organizer's app subscribes to its active
session exactly as a spectator subscribes to theirs." §4 says anonymous sign-in has to happen
before anything can be read, because the active session is a query scoped to a uid, and that the
device which cannot sign in needs a designed state rather than a spinner.

The consequences then close with: "`SessionRepository` keeps all six of its operations and none of
its signatures change." Building the slice showed that sentence is two claims wearing one coat. The
six signatures did survive, exactly as ADR-0019 bet they would. The count did not, and it could
not: a subscription has a lifetime a one-shot read does not, and there is nowhere in
`loadActive(): Promise<SessionRecord | null>` to hand a caller the function that ends one.

## Decision

**1. `watchActive(onChange): () => void` is a seventh operation on `SessionRepository`.** It calls
back with the session in progress whenever it changes, and with `null` when there is none, until
the returned function is called. The six operations ADR-0019 designed are untouched — that was the
part of ADR-0025's sentence that was load-bearing, and it held.

The alternative was a second token, `SessionListener`, beside the repository. It was rejected
because a listener over the active session is the same query as `loadActive`, against the same
collection, needing the same `list` rule and the same composite index. Two seams over one query is
a boundary drawn where there is no joint, and it would have made the in-memory fake answer for two
tokens it implements with one set of fields.

**2. `Identity` *is* a second token, and for the opposite reason.** Signing in is not a session
operation. It is a different question about a different thing, asked once at startup by the store
rather than per read, and the screens that care about it care about a state (`needsConnection`)
rather than about a record. A `signIn()` on `SessionRepository` would be the seam drawn where there
is no joint the other way round.

**3. Both are implemented by the same object.** `FirestoreSessionRepository` implements
`SessionRepository` and `Identity` and is provided for both tokens with `useExisting`. Decision #19
says one file in the app imports the Firebase SDK, and one Firebase app, one Firestore and one
`Auth` instance is what that file holds. Two classes would have meant two files importing the SDK,
or a third file exporting a connection for them to share — which is decision #19 with an extra
step, not decision #19 kept.

## Consequences

- The in-memory fake and the demoted `LocalStorageSessionRepository` both grew a watcher set and an
  announce-on-write. That is duplication between two test doubles, accepted: they announce
  different things (the fake its own object, the other a reparsed document) and a shared base class
  between two fakes is more machinery than the four lines it would save.
- The spectator view (#59 onward) needs a listener over *a session by id*, not over the active one.
  That is an eighth operation when it arrives, or a widening of this one, and this ADR does not
  decide which.
- `loadActive()` and `watchActive()` are the same query asked twice at startup — one read the app
  can be unstable until, and one subscription that immediately reports the same record. The
  duplicate read is a rounding error against a 50,000-a-day quota, and it is what lets
  `PendingTasks` wait on something rather than on a callback.
