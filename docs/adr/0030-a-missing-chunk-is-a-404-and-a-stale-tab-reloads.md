# 30. A missing chunk is a 404, and a tab that missed a deploy reloads itself

- **Status:** Accepted
- **Date:** 2026-09-08
- **Amends:** [ADR-0026 §1](0026-the-spectator-is-a-route-in-this-app-and-sharing-is-a-header-sheet.md)

## Context

ADR-0026 §1 ends "Hosting rewrites everything to `index.html`", which is the standard configuration
for a single-page app and was correct about the thing it was deciding: an address a person types is
answered by the app, not by a 404 page the app never gets to see.

`**` is broader than that sentence, though. It also answers requests for files — and every lazy
import in this app asks for a file named after the hash of its contents: the two routes of §1, and
the `qrcode` encoder of §4. A deploy changes those names. A tab that was open across the deploy is
still asking for the old ones, so it asks for a file that no longer exists, and hosting hands it the
front page with a `200`. The browser then tries to run HTML as a module, and the import rejects.

That is what was actually happening on a phone that reported "The QR needs a connection to draw"
with four bars of signal. Every guard in the app was working correctly on a fact that was wrong: the
share sheet caught a rejected import, and the only meaning a rejected import had was "no network".
A phone is where this surfaces because a phone keeps a tab alive for days, while the laptop it was
deployed from reloads a dozen times an afternoon.

## Decision

**1. Hosting rewrites addresses, not files.** The rewrite is `**/!(*.*)` — every path without a file
extension, which is every address this product has: `/`, `/s/:code`, and whatever gets mistyped
towards them. A request for a path with an extension is a request for one of this build's own
files, and a missing one now answers `404` instead of impersonating the app.

This does not repair a stranded tab; it makes the failure honest. The alternative was to keep `**`
and detect HTML at the call site — sniffing the response of an import the app does not make itself —
which is a workaround for a configuration that is simply too broad.

Share codes are Crockford base32 (ADR-0024), so no address this product has contains a dot. A future
route that did would have to revisit this line.

**2. A refused chunk asks whether it is offline or behind.** `BUILD_RELOAD` is a token, alongside
the clipboard and the QR encoder, with one method: a caller that was refused a chunk asks it, and
learns whether a reload is on its way. Where it is, the caller renders nothing — the page is going
away. Where it is not, the caller's own fallback is what the person in front of it needs.

The browser implementation reloads once per tab and only while online. Online, because a reload
offline takes away a working app and returns nothing. Once, recorded in `sessionStorage` because a
field does not survive the reload it exists to count, because a chunk genuinely missing from a
deploy would otherwise reload the page every time the sheet is opened — a loop that looks like the
app crashing rather than like the bug it is.

A prompt — "the app was updated, reload?" — was the alternative, and it was rejected for the share
sheet: the organizer tapped Share to get a QR, and a question about builds is not an answer to that.
The state that would be lost is in Firestore (ADR-0025), and the sheet reopens in a tap.

**3. The offline sentence stays, and now means it.** `qrUnavailable` still says the QR needs a
connection and the code below works without one. That sentence was wrong about half the phones that
saw it and is now only shown to the half it was written for.

## Consequences

- A stranded tab is self-healing once, at the first lazy import it fails to fetch. For the QR that
  is the share sheet; for a route it is the first navigation.
- `BUILD_RELOAD` lives in `share/` because the share sheet is its only caller. The routes are the
  obvious second one, and moving it out of `share/` is the moment to do that.
- Specs get a third device to launch onto, after the phone with no signal and the browser with no
  clipboard: the tab that is one deploy behind. `RecordingBuildReload` answers `false` by default,
  so every spec written before this one goes on meaning what it meant.
- Tabs that are open right now have neither half of this: they are running a build with no
  `BUILD_RELOAD` in it, and they will be handed HTML for a missing chunk exactly as before. They
  get the offline sentence and a manual reload. This ADR is for every deploy after the one that
  ships it.
- Verified against the hosting emulator rather than reasoned about: `/`, `/s/:code`, `/nosuchroute`
  and `/deep/mistyped/path` all reach `index.html`, and `/chunk-<old hash>.js` is a `404`.
