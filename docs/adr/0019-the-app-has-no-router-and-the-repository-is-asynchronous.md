# 19. The app has no router, and the repository is asynchronous from the start

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #17, #19 and #23 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0016](0016-the-session-is-three-tabs-and-one-round-at-a-time.md) and
  [ADR-0017](0017-creation-is-a-four-step-wizard-and-courts-are-named.md)

## Context

Building the first screens of `padel-app` forced two questions that the design interview never
reached, because both are about the shape of the shell rather than about padel.

The first is navigation. An Angular application normally arrives with a router, and the reflex is
to give the landing page, each wizard step and each session tab a URL. The second is the
`SessionRepository` interface (decision #19): `localStorage` is synchronous, Firestore is not, and
the interface written today is the one every caller is written against.

## Decision

**1. There is no router in step 2.** The shell holds which screen is showing as a signal —
landing, wizard, or session — and the wizard holds its own step the same way.

Nothing in this app is a place. ADR-0016 is explicit that a session has no back button and that
leaving is landing, ending or discarding; ADR-0017 makes Back within the wizard a step backwards
through state that is deliberately not yet persisted anywhere. A URL is a promise that the thing
it names can be returned to, shared, and reloaded into — and for `/create/players` every one of
those is false. The browser Back button reaching a wizard step that no longer has a draft behind
it is worse than the browser Back button leaving the app.

**2. `SessionRepository` returns promises, even over `localStorage`.** The interface is the vendor
boundary and step 3 replaces the implementation behind it with Firestore. A synchronous interface
would buy one `await` per call site today and have to be unpicked through every one of them the
moment a network appeared. The app is unstable — literally, via `PendingTasks` — until the first
read settles, and renders nothing rather than flashing a landing page at an organizer who has an
evening in progress.

**3. Both conventions with no type behind them are checked by a script.**
`tools/verify-app-conventions.mjs` fails the build if a template writes a visible string of its own
(decision #20) or if any component names a colour rather than a token (ADR-0018). It follows
`verify-engine-boundary.mjs` in proving itself against deliberate violations and deliberate
near-misses, because a convention checker nobody has seen reject anything is indistinguishable
from one that always passes.

## Not decided here: court names

ADR-0017 §6 says courts are named by the organizer on Review, and that the court-number-to-name
mapping "has to live in the session document" as "the first app-owned field on a document the
engine otherwise owns entirely". `SessionRecord` is that document and it carries only `createdAt`,
because issue #17 scoped the first slice to exactly that field and listed only target score, court
count and round count on Review.

So ADR-0017 §6 is **deferred, not overturned**. The Round tab renders `Court N` from the copy
dictionary today, and the naming fields and the record's `courtNames` belong to whichever slice
next touches Review. Anyone reading this file after that slice lands should expect the mapping to
be there; if it is not, this paragraph is the bug report.

## Consequences

- A deep link into a running session is not available and is not a regression when the spectator
  view arrives in step 3 — that view is a different surface with a real URL of its own (a share
  code), and it can bring the router with it.
- Refreshing the browser mid-wizard drops the draft. This is the same behaviour as abandoning the
  wizard, which decision #17's "nothing is written until the last step" already requires.
- Every screen is reachable only by driving the app, which is what the DOM test seam does anyway.
  There is no shortcut for a test to jump straight to step three, and tests are longer for it.
- The conventions script parses templates with regular expressions and a small hand-written
  scanner. It will need extending as the templates grow — a new visible attribute, a control-flow
  block it has not seen. That cost is deliberate and small next to auditing templates by eye.
