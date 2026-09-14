# 40. A WebView cannot be handed a file, so it is handed a sentence

- **Status:** Accepted
- **Date:** 2026-09-14
- **Refines:** [ADR-0039](0039-the-report-is-downloaded-and-the-browser-is-asked-nothing.md), whose
  §2 open loop closed — against it, and not where it was looking. §1 and §3 stand.
- **Relates to:** [ADR-0038](0038-the-report-is-a-document-not-the-screen.md) §1 and §7,
  [ADR-0026](0026-the-spectator-is-a-route-in-this-app-and-sharing-is-a-header-sheet.md) §2

## Context

ADR-0039 §2 named one open loop — nobody had tapped the report on a phone — and shipped without
closing it. It was tapped the same day, and what came back was not about the platform at all.

The organizer's download works: Android, in the browser, the PDF saves. What fails is a **spectator
who opened the share code from a message in Facebook Messenger**: the link does nothing. No file, no
`The report needs a connection to build`, no reload — which together say the chunk arrived, the
document built, and the anchor was clicked. The file went nowhere.

That is an in-app WebView. Messenger and its kind render pages in an embedded browser rather than
handing them to Chrome, and those WebViews accept `download` on a `blob:` URL, fire no error and
save nothing.

The first attempt at a fix assumed ADR-0038 §7's share sheet had been quietly protecting this path,
and offered sharing as an escape where `canShare({ files })` allowed it. Deployed and tested on the
same phone, **the escape never appeared**: `canShare` is falsy there. The Web Share API is a Chrome
feature and not a WebView one, so the browsers that swallow the download are exactly the browsers
that cannot open a sheet.

Two things follow, and the second is the more useful.

**ADR-0038 §7 would have failed here too.** Its code shared where `canShare` was true and downloaded
otherwise; in this WebView it takes the download branch and is swallowed identically. The report has
never worked for a Messenger spectator, since it shipped. ADR-0039 did not cause this, and the claim
that §7 was load-bearing for the group-chat path — made while diagnosing, before the escape was
tested — was wrong.

**There is no mechanism left.** The download is discarded silently, sharing does not exist, and
nothing reports either. Every in-page route to putting that file in the person's hands has now been
tried on the device that needs it.

## Decision

**1. A tap downloads, on every browser, and that does not change.** ADR-0039 §1 stands. The
organizer is on a real browser every time — they created the session there — and the download is
correct for them and for every spectator who opens the link outside a chat app.

**2. The escape is a sentence, not a control.** After a report has been built, a muted line appears
under the link: **Didn't save? Open this page in your browser**. It is an instruction because there
is nothing left to tap — the chat app's own menu is the only working mechanism on that screen, and
it is not ours to drive.

It is shown **on every browser** after the first tap, with no condition. A WebView that discards a
download is indistinguishable from a browser that saved one, so a gate would have to be a guess. The
sentence is phrased as a question so it addresses the one person it is for and is ignorable by
everyone whose file arrived.

**3. No user-agent detection.** Matching `FBAN|FB_IAB|Instagram` would place the sentence precisely
and was rejected: `preference/language.ts` refuses `navigator.language` and this app sniffs nothing
anywhere, the list is a maintenance liability, and it fails silently for every WebView not on it —
which is the invisible failure this ADR exists to answer.

**4. The Web Share API is not used anywhere in this app.** Recorded so it is not reached for again.
It cannot help the case that needs it, and every case it could serve already works.

## Consequences

- **A Messenger spectator still cannot get the PDF inside Messenger.** They get a sentence sending
  them elsewhere, and some of them will not follow it. This is the ceiling of a file-shaped feature
  inside a WebView, and it is not moved by more work on this feature. If it needs to be moved, the
  answer is a different feature — the report as a page at a URL rather than as a file — which is
  not proposed here.
- The escape only ever helps on a second tap: the first one is what proves nothing happened.
- The report screen has a line that is wrong for most readers most of the time. That is the price of
  refusing to guess which browser somebody is in, and the question mark is the whole of the defence.
- Three decisions in two days on one paragraph of ADR-0038, and the pattern under them is worth
  naming once. §7 was written with reasons attached; ADR-0039 answered the reasons rather than the
  behaviour; the first fix here answered a diagnosis that had not been tested. Each step was
  argued and each was wrong in the same way — reasoning about what a browser would do instead of
  watching one do it. What finally settled it was a deploy and a tap, twice.
