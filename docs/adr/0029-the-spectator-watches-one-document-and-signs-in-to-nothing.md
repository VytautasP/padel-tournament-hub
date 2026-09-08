# 29. The spectator watches one document, signs in to nothing, and shares the organizer's screens

- **Status:** Accepted
- **Date:** 2026-09-08
- **Settles:** the question
  [ADR-0027](0027-the-live-listener-is-a-seventh-repository-operation.md) left open — "an eighth
  operation when it arrives, or a widening of this one, and this ADR does not decide which"
- **Relates to:** decisions #10, #12, #17, #19 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0016](0016-the-session-is-three-tabs-and-one-round-at-a-time.md),
  [ADR-0024](0024-the-share-code-is-the-document-id-and-ownership-is-an-immutable-uid.md),
  [ADR-0025](0025-firestore-is-the-only-source-of-truth.md),
  [ADR-0026](0026-the-spectator-is-a-route-in-this-app-and-sharing-is-a-header-sheet.md)

## Context

ADR-0026 decided what the spectator surface is: one application, two routes, the same three tabs
read-only, `noindex` as an HTTP header. Building it asked three questions that ADR could not have
answered without being written after the code.

## Decision

**1. `watch(sessionId, onChange)` is an eighth repository operation, not a widened seventh.**
ADR-0027 left the choice open. It is its own operation because the two are different queries under
different rules: `watchActive` is an owner-scoped `list` over the collection and cannot be asked
without a uid, while this is a `get` of one document, allowed to anybody holding its id — which is
the whole of what makes a share code the credential (ADR-0024 §3). Folding them together would mean
one signature that sometimes needs an owner and sometimes does not, and a fake that answered for
both with one set of fields would be hiding exactly the distinction the rules draw.

It reports `null` for a session that is not there, and reports nothing at all until it knows. That
second half is not fussiness: with persistence on, the SDK answers a document it has never cached
immediately and offline, and passing that on would tell a spectator standing at the court that the
evening had been deleted.

**2. The spectator route does not sign in.** ADR-0025 §4 made anonymous sign-in the first thing that
happens at startup, because the organizer's every read is scoped to a uid. None of that is true
here: a spectator has no identity (ADR-0026 §3), the rules ask for none on a `get`, and an anonymous
account minted for everybody who scans a QR is a growing pile of users this product would never
look at. So the route holds no `SessionStore`, no `Identity` and nothing that could write —
`SessionStore` stays what it has always been, the organizer's.

The consequence is that the "no connection" screen (ADR-0025 §4) is the organizer's alone. A
spectator with no signal sees the page render nothing until the code is answered, which is the same
nothing the organizer's shell shows until its restore settles.

**3. Read-only is a component that was never given a control, not a control that was hidden.** The
acceptance criterion asked for read-only to be structural. It is done by splitting each of the three
tabs into a board that renders and a tab that acts: `app-round-board`, `app-standings-table` and
`app-roster-list` take inputs and emit what the reader did; `app-round-tab`, `app-standings-tab` and
`app-players-tab` keep the score sheet, the roster preview, Add round and End session and hand the
boards their data. The spectator's shell renders the three boards and nothing else.

The alternative was a `readOnly` flag through the existing tabs. It was rejected for what it would
have left standing: the route would still have been holding the store that performs the operations,
and every control would have been one condition away from a screen that could carry it out.

Being precise about what this buys, because a board does still take an `organizing` input and does
still branch on it: the condition did not disappear, it moved to a component that cannot act on
either answer. What is structural is the route — it injects `SESSION_REPOSITORY` for one listener
and nothing else, holds no `SessionStore`, and has no import path to an engine operation, so a
control appearing on it by accident would have nothing to call.

The boards being shared is what keeps the two screens honest. A spectator's round four and an
organizer's round four are rendered by the same component from the same document, so the argument
at the side of the court cannot become one about whose phone is right.

## Consequences

- Both test doubles grew a `watch` that looks through every owner's sessions rather than the caller's
  own. That is the fake catching up with the rules: `allow get` is not owner-scoped, and a fake that
  could only find the signed-in organizer's evenings could not describe a spectator at all.
- `AppHarness` gained an address to launch at and a `catchUp()`. The address is how a spec reaches
  `/s/:code` the way a phone does; `catchUp` is how a spec waits for something that changed outside
  the app, which no tap can do.
- Only one app is alive in the test bed at a time, so a spec cannot run an organizer and a spectator
  side by side. What crosses between two phones is a document, so the specs write one — the one
  place in this project's tests that goes to the repository rather than to a screen.
- A spectator whose first visit is offline sees nothing at all: the listener stays silent on a
  cache miss rather than calling an unknown document a deleted one, and there is no screen for
  "still asking". That is the deliberate trade of §1 and it is the weakest part of this slice — the
  organizer has `connection` for the same situation (ADR-0025 §4) and a spectator has nothing. A
  screen of their own is the obvious next slice; it needs words that do not promise the evening
  exists.
- The split is real but partial: the organizer's route is a 131 kB lazy chunk and the spectator's is
  4.5 kB, while the Firebase SDK stays in the initial bundle because one file provides the
  repository for the whole application (decision #19). A spectator therefore downloads an SDK they
  make one `get` with. Splitting the providers per route is the first thing to do if the transfer
  cap becomes the binding constraint, which is the reopening ADR-0026 §1 already named.
- `@angular/router` is a dependency for the first time, pinned to the same version as the rest of
  Angular. It costs the organizer nothing they were not already downloading and is what makes both
  halves lazy.
- The three tabs are thinner than they were and one more file deep. A change to how a court card is
  framed is now made in one place for two screens, which is the point; a change to what the
  organizer can do to it is still made in the tab.
