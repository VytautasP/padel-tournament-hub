# 39. The report is downloaded, and the browser is asked nothing

- **Status:** Accepted, and refined by [ADR-0040](0040-a-webview-cannot-be-handed-a-file.md)
  (2026-09-14), which found §2's open loop closed the wrong way
- **Date:** 2026-09-14
- **Refines:** [ADR-0038](0038-the-report-is-a-document-not-the-screen.md) §7, which is reversed.
  Every other section of ADR-0038 stands.
- **Relates to:** [ADR-0026](0026-the-spectator-is-a-route-in-this-app-and-sharing-is-a-header-sheet.md) §4,
  whose share sheet is a different thing and keeps the name

## Context

ADR-0038 §7 asked the browser what it could do and then did that: `navigator.share({ files })`
behind a `canShare` check, falling back to a blob download. The reasoning was that either path
alone ships the bad half of the feature to half the audience — a blob download on iOS Safari
opening a tab full of binary instead of saving a file, and no share sheet at all on desktop
Firefox.

Nine days of looking at it says the sheet is in the way. The link reads **Save this evening as a
PDF**, and on the platforms that have a sheet it does not save anything: it opens a panel and asks
where to put the file, which is a second decision placed in front of somebody who made their
decision when they tapped. Every destination that panel offers — a message, a mail, Files — is one
the downloads folder reaches a minute later, with the file still on the phone afterwards rather
than only in the conversation it was flung into.

The cancellation case is the sharpest version of it. ADR-0038 §7 was careful that a dismissed sheet
means silence, because falling back to a download there would save a file somebody had just
declined. That care is real, and the thing it protects is a state this feature should never have
been able to reach: a person who asked for the evening as a file, and ended up with no file.

## Decision

**1. `download` is the only path.** The object URL, the detached anchor, the deferred revoke —
ADR-0038's fallback, promoted, with the `canShare` branch, the `File` wrapper and the
`application/pdf` constant deleted around it. The last of those is redundant rather than a loss:
pdfmake's `getBlob()` already types its blob `application/pdf`.

**2. The iOS premise behind §7 is believed stale, and this is unverified.** Safari on iOS has
supported the `download` attribute, including on `blob:` URLs, since iOS 13 — the "opens a tab full
of binary" behaviour that half of §7's argument rests on is from before that. This is recorded as a
belief and not as a finding: **nobody has tapped this link on an iPhone**, and the decision to ship
without doing so was taken deliberately rather than overlooked.

The open loop is one tap. Until somebody makes it, the honest statement of this ADR's evidence is
that one path was preferred to two and the platform question was assumed rather than answered. If a
report tapped on an iPhone opens a tab instead of saving, this ADR is where the fault is.

> **Closed, and not where this section was looking** (2026-09-14, [ADR-0040](0040-a-webview-cannot-be-handed-a-file.md)).
> The tap happened the same day. Android, in the browser, downloads the report correctly, and
> nothing has contradicted the iOS claim above. But a spectator opening the share code from a
> message in Facebook Messenger gets an in-app WebView, which accepts the download and silently
> discards it — and has no share sheet either, so ADR-0038 §7's two paths would both have failed
> there. This section's error was not its guess about iOS, and it was not removing the sheet. It
> was treating the platform as the question when the question was where the person was standing.

**3. Delivery is synchronous and reports nothing.** `download` returns `void`. The `try`/`catch`
that wrapped it in `ReportLink` existed for exactly one reason — `navigator.share` rejects when the
sheet is dismissed — and guarding against a rejection that cannot happen is a lie about the code's
failure modes. What is left in that component is one failure mode, the chunk that did not arrive,
handled as ADR-0030 asks.

The cost is that the app now has no signal at all about whether the file reached the disk. A
browser that refuses the download is silence. That was already true of §7's fallback path; what is
new is that there is no other path for it to be true of, and no test that would notice — ADR-0038
§8 shipped this feature with no automated tests on purpose, and the lines this ADR changes are
among the ones that deferral covers.

**4. "Share sheet" goes back to meaning one thing.** ADR-0026 §4 named the app's own header panel —
the share code and the QR — the share sheet. ADR-0038 §7 borrowed the same words for the operating
system's panel, and for nine days a reader of `app.config.ts` had to work out which was meant.
Deleting `navigator.share` resolves that by accident, so `CONTEXT.md` gains **Share sheet** to hold
the word deliberately: it is the header panel, and this app does not open the other kind.

## Consequences

- The organizer taps once and has the file. On a platform with a sheet that is one tap fewer than
  before; on one without, nothing changed.
- Sending the report to somebody is now two steps — save, then attach — where the sheet made it
  one. That is the price, and it is paid on the assumption that the common case is keeping the
  evening rather than forwarding it the same minute.
- `report-file.ts` is now one function and a filename. It stays a file of its own because
  `reportFilename` has reasoning about local time and same-day collisions that would be buried
  inside a component.
- ADR-0038 §7 is the second decision in this repo to be reversed, after ADR-0002 — which ADR-0003
  superseded the same day it was written. Both were calls made ahead of anybody using the thing,
  which is the pattern worth noticing rather than either individual reversal.
