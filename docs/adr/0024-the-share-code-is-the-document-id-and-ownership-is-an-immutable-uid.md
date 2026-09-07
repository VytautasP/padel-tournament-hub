# 24. The share code is the document id, and ownership is a uid the rules never let move

- **Status:** Accepted
- **Date:** 2026-09-07
- **Relates to:** decisions #1, #10, #12, #13 and #14 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0013](0013-one-active-session-and-every-ended-session-is-kept.md) and
  [ADR-0025](0025-firestore-is-the-only-source-of-truth.md)

## Context

Step 3 of the build order puts sessions on Firestore, and with them the first authorization this
project has ever had. Decision #1 says one organizer writes and everybody else reads. Decision #10
says a session is unlisted behind an unguessable code. Decision #12 says the security rules *are*
the authorization layer — there is no server to hold a second opinion.

Two things follow that the design interview never spelled out. What is the unguessable code, in
terms of the document it names? And what, on a document, does a rule read to decide that the person
writing is the organizer?

## Decision

**1. The document id is the share code.** A session lives at `sessions/{code}`, where the code is
ten Crockford base32 characters — roughly fifty bits, and no I, L, O or U, so a code retyped from a
QR that would not scan cannot be ambiguous. `Session.id`, `SessionRecord.id` and the share code are
one value with three names.

A separate `shareCode` field was the alternative, with a lookup collection mapping code to
document. It buys a shorter code and the ability to rotate one, and costs a second read on every
spectator load and a second collection to keep consistent. Neither purchase was asked for. This
codebase derives rather than stores everywhere it can — the current round (ADR-0016), the standings
(ADR-0008), the bench mark on the Players tab (ADR-0015) — and a second identifier for one thing is
the same mistake in a different dress.

**2. Ownership is an `ownerUid` field, and it is immutable after create.** It is set to
`request.auth.uid` at creation and no update may change it:
`request.resource.data.ownerUid == resource.data.ownerUid`. Every other field on the document is
the engine's business and the rules have no opinion about it. This is the second app-owned field on
a document the engine otherwise owns entirely — ADR-0019 named `courtNames` as the first and it is
still deferred.

**3. The rules split `get` from `list`.** `allow get: if true` — holding the id is the credential,
which is the whole of what decision #10 promises. `allow list: if request.auth.uid ==
resource.data.ownerUid` — only the organizer may enumerate. `allow create` requires the incoming
`ownerUid` to be the caller's own; `allow update, delete` require it to match the stored one.

This split is the point of the ADR. In Firestore `read` covers both operations, so the obvious
one-line rule — `allow read: if true` — does not mean "anyone who knows a code may watch it". It
means anyone at all may query the collection and receive every session ever run, share codes
included. The unguessable id stops being a credential the moment the collection is listable. This
was got wrong once in the conversation that produced this file, which is the argument for both
writing it down and testing it.

**4. Reads are public, and unlisted is not secure.** A leaked code is permanent access to that
session, for anyone, forever, and there is no revocation. This is the correct trade for standings
that get shouted across a court anyway, and decision #10 already keeps anything worse than a first
name out of the model. It is written here in these words so that nobody later reads "unlisted" as
"private" and builds on a guarantee that was never made.

**5. `status: 'finished'` is not enforced in the rules.** ADR-0009 makes finishing a status the
engine refuses to operate past, and that is where it stays. The only account that can write to a
session is the organizer's own, so a rule forbidding an update to a finished session defends the
organizer from themselves, and forecloses "reopen — we played one more" for nothing. The rules
answer *who*; the engine answers *what*.

**6. Rules are tested against the emulator, in their own script.** `npm run test:rules` runs
`@firebase/rules-unit-testing` against the Firestore emulator. It is deliberately not part of
`npm run verify`: the emulator needs a Java runtime, and `verify` keeps its promise of running
anywhere Node runs. Rules change rarely enough that a script you run when you touch
`firestore.rules` matches the real cadence. The first case it must cover is a signed-in user
listing `sessions` and getting back only their own — an authorization layer nobody has watched
reject anything is, in ADR-0019's phrase about the conventions checker, indistinguishable from one
that always passes.

## Consequences

- Sessions cannot be moved between owners, which also means a session cannot be handed to a
  co-organizer. If that is ever wanted it reopens point 2 and nothing else.
- History is a query rather than a document read, and therefore depends on the `list` rule and on a
  composite index over `ownerUid` and `status`. See [ADR-0025](0025-firestore-is-the-only-source-of-truth.md).
- The hard delete decision #10 promises is a document delete. A spectator holding the link
  afterwards gets a permission error, which the spectator route has to render as "this session is
  gone" rather than as a failure.
- Anonymous Auth ties `ownerUid` to one browser. Cleared site data is an unrecoverable loss of every
  session that uid owned, because nothing can prove the new uid is the same person. This is why
  decision #14's Google linking ships before the spectator view rather than after it.
