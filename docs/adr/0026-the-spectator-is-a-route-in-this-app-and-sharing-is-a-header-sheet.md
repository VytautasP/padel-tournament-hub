# 26. The spectator is a route in this app, and sharing is a sheet in the session header

- **Status:** Accepted
- **Date:** 2026-09-07
- **Amended by:** [ADR-0031](0031-the-app-has-a-settings-sheet-and-a-preference-belongs-to-the-browser.md) §2,
  which pairs a settings gear with the share icon in §4's header
- **Relates to:** decisions #1, #10, #12 and #15 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0016](0016-the-session-is-three-tabs-and-one-round-at-a-time.md),
  [ADR-0019](0019-the-app-has-no-router-and-the-repository-is-asynchronous.md) and
  [ADR-0024](0024-the-share-code-is-the-document-id-and-ownership-is-an-immutable-uid.md)

## Context

ADR-0019 removed the router on the grounds that nothing in the organizer's app is a place, and left
one exception standing: "a deep link into a running session is not available and is not a regression
when the spectator view arrives in step 3 — that view is a different surface with a real URL of its
own (a share code), and it can bring the router with it."

This is that arrival. It settles what the spectator surface is built from, what it shows, how a
share code reaches a phone, and how the promise in decision #10 that spectator routes are `noindex`
is actually kept.

## Decision

**1. One application, one router, two routes.** `/` is the organizer shell exactly as it is today;
`/s/:code` is the spectator view, lazily loaded so neither bundle carries the other. Hosting
rewrites everything to `index.html`.

A second Angular application in the workspace was the alternative. It gives a spectator a smaller
download and makes it structurally impossible for the spectator surface to reach organizer code, and
it costs a second build target, a second conventions check, and a duplicated shell, theme and copy
dictionary. The spectator view is the round card and the standings table with the controls removed —
mostly the components that already exist — and a second application turns sharing them into a build
problem. If the Spark transfer cap ever makes bundle size the binding constraint, this is the
decision to reopen.

**2. A spectator sees the whole session, read-only.** The same three tabs of ADR-0016 — Round,
Standings, Players — with every control gone: no score sheet, no add round, no roster change, no
end session. That is what makes a QR worth scanning, and it is a rendering of state the spectator's
listener already holds.

**3. A spectator has no identity, in this slice.** The README's promise of "their next court and
their next partner" is met by a spectator finding their own name, not by the app knowing it. Letting
a viewer tap their name once and having the app highlight their row, their court and their partner
is a genuinely good idea and a genuinely separate one: it introduces a viewer's chosen player, which
is the first thing to push back on `CONTEXT.md`'s line that a roster entry is "not a person, not an
account". It gets its own conversation rather than being buried inside the Firestore slice.

**4. Sharing is a header icon that opens a sheet.** The sheet holds the QR, the share code as text,
and copy-link. The QR is rendered with `qrcode` to SVG, lazily loaded with the sheet — SVG so it is
crisp on every phone and printable if it ends up taped to a net post. A hosted QR image API was
rejected outright: the code is the credential (ADR-0024 §4) and it does not leave the device.

This is an amendment to ADR-0016, not a detail. That ADR gives the session three tabs and no chrome;
it now has one control in the header. **Amended by [ADR-0031](0031-the-app-has-a-settings-sheet-and-a-preference-belongs-to-the-browser.md) §2:**
it has two. A settings gear is paired with the share icon on the left of this header in every
state, and Done keeps the right edge alone. The reasoning below is unchanged — a persistent
affordance answers the question every time it is asked — and the gear is on that header for the
same reason: a screen that is unreadable in the light you are standing in is a problem you have
while playing, not before. The alternative was a screen shown once when the wizard
finishes, at the moment everybody is standing around anyway — a better moment, but it only happens
once, and people arrive late, phones lock, and somebody asks again in round four. A persistent
affordance answers the question every time it is asked.

**5. `noindex` is an HTTP header.** Firebase Hosting sets `X-Robots-Tag: noindex` on `/s/**`, with a
`robots.txt` disallowing the same path. A meta tag injected when the route activates was rejected:
it depends on a crawler executing Angular, which is not a thing to stake a privacy promise on, and
three mechanisms for one promise means two of them are never tested.

## Consequences

- The organizer's app gains a router it does not need, and one route that never changes. This is the
  cost of point 1 and it is small; ADR-0019's reasoning about the wizard and the tabs is untouched,
  because none of those gain URLs.
- A spectator opening a deleted session gets a permission error, not an empty state, and the route
  has to render that as "this session is gone".
- The share sheet is the first surface that shows the share code to a human, which makes ADR-0024's
  choice of alphabet visible: ten Crockford base32 characters, read aloud across a court when the
  QR will not scan.
- `qrcode` is a runtime dependency in an app that currently has none beyond Angular. It is lazily
  loaded, so it costs the organizer nothing until the sheet opens.
