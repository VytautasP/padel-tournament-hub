# 28. Linking keeps the uid, and an account that is already taken is a question rather than an error

- **Status:** Accepted
- **Date:** 2026-09-07
- **Relates to:** decisions #10, #12 and #14 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0021](0021-the-identity-is-court-at-dusk-and-verdana-carries-the-text.md),
  [ADR-0024](0024-the-share-code-is-the-document-id-and-ownership-is-an-immutable-uid.md) and
  [ADR-0025](0025-firestore-is-the-only-source-of-truth.md)

## Context

ADR-0024 §2 makes `ownerUid` immutable: it is written once at creation and no rule will let an
update change it. That is what makes ownership something the rules can enforce with one comparison,
and it is also what makes an anonymous uid a single point of loss. ADR-0024's own last consequence
says so: *"Cleared site data is an unrecoverable loss of every session that uid owned, because
nothing can prove the new uid is the same person."*

Decision #14 named the fix — Anonymous Auth plus optional Google linking, `linkWithCredential`,
same uid — and said to build it now rather than later. It did not say what happens when the Google
account is already attached to a different uid, and that case is not an edge: it is what a browser
that has lost its uid sees, which is precisely the case the feature exists for.

## Decision

**1. Linking attaches an account to the uid; it never replaces one.** `linkWithPopup` appends a
Google provider to the anonymous user and the uid is unchanged, so every session already carrying
it is still owned, still queryable and still writable a moment later. No document is touched and no
migration exists, which is the only shape compatible with an immutable `ownerUid` (ADR-0024 §2).

A "sign in with Google and copy the sessions across" design was never on the table for the same
reason: copying would need `ownerUid` to move, and moving it is the one thing the rules refuse.

**2. A taken account is answered with a question naming what it costs, not with a failure.** When
Firebase refuses the link with `auth/credential-already-in-use`, the app offers to sign in as that
account instead, using the credential the failure hands back rather than opening a second popup.
The confirmation states the cost, and the cost is the one thing about it that varies:

- A browser holding no evenings loses nothing. This is the recovery path — a new phone, cleared
  site data, an eviction by iOS — and the account is the only thing that can prove the new browser
  is the same organizer.
- A browser holding evenings leaves them behind for good. They are not deleted; they sit in
  Firestore under a uid this browser will no longer be signed in as, and `ownerUid` cannot move, so
  nothing brings them back.

Refusing the link outright was the alternative, and it is what an earlier draft of this ADR said.
It is wrong: it makes durable history durable in theory only. The account would be attachable and
never usable, because every browser that could use it is a browser whose uid is already gone.

The second alternative — merging the two uids' sessions — is `ownerUid` moving again. It is
refused here for the same reason it is refused everywhere else in this project.

**3. It is a popup, and a redirect is the named fallback.** `linkWithPopup` is `linkWithCredential`
with the browser's half of the flow in front of it. A redirect flow (`linkWithRedirect` plus
`getRedirectResult` at startup) is the alternative and would survive an installed iOS PWA refusing
to open a popup; it costs a full reload of the app and startup machinery to pick the result back
up. That is a cost to pay when the popup is *known* to fail on a real device rather than feared to,
and decision #22's preview channel is how that gets found out.

**4. The state is said on the front door, in the quietest voice on the page, and nowhere else.**
One sentence saying whether history is browser-bound or kept with an account, and — while there is
anything to do about it — one neutral button. No banner, no interstitial, no nag at the end of an
evening. The loss is not urgent, it is only permanent, and a warning shown every night is a warning
nobody reads by the third one.

The confirming button is not `danger`. ADR-0021 §3 spends that token on the two acts that destroy
something, and this destroys nothing: the evenings left behind are exactly where they were. This is
the same reasoning that keeps `danger` off **went home**.

## Consequences

- There is still no sign-out, and this ADR does not add one. Once a browser is signed in as an
  account, the only way back to a fresh anonymous uid is clearing site data — which is the act this
  whole feature exists to make survivable, so the loop closes.
- `Identity` grows from one operation to three, and `SessionRepository` grows by none. The vendor
  boundary decision #19 draws is still one file, and it is still `firestore-session-repository.ts`.
- `SessionStore.adopt()` is the first thing in the app that changes who the organizer is mid-run.
  Every read is redone and the live listener is reopened, because both are owner-scoped
  (ADR-0025 §2, §3).
- The in-memory fake now keeps sessions apart by uid and keeps its account list apart from the
  browser. That is not test decoration: a fake with one pile of sessions cannot tell a link that
  keeps the uid from a sign-in that changes it, which is the whole distinction this ADR is about.
- Nothing in `firestore.rules` changes. A linked user's uid is the uid it already was, so every
  rule that passed for the anonymous organizer passes unaltered — which is the clearest evidence
  that §1 is the right shape.
