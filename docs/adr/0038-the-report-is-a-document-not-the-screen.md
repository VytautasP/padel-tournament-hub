# 38. The report is a document, not the screen

- **Status:** Accepted
- **Date:** 2026-09-14
- **Refines:** [ADR-0021](0021-the-identity-is-court-at-dusk-and-verdana-carries-the-text.md) §4,
  which governs the screen and is untouched
- **Relates to:** [ADR-0008](0008-standings-are-derived-and-ties-stop-at-the-evidence.md),
  [ADR-0023](0023-the-standings-rank-on-total-points-and-the-bench-is-paid-a-credit.md),
  [ADR-0030](0030-a-missing-chunk-is-a-404-and-a-stale-tab-reloads.md),
  [ADR-0037](0037-an-abandoned-round-is-compensated-if-the-organizer-says-so.md), and
  decisions #8 and #15 in [docs/DECISIONS.md](../DECISIONS.md)

## Context

An evening ends, the table is final, and everybody goes home holding nothing. The share code still
opens the session, but a link to a live app is not what gets forwarded into a group chat six months
later, and it is not what a club pins to a board. What people want at that moment is the evening as
a file.

The screen cannot supply it. The Standings tab is a phone-width table of four columns, because a
phone is four columns wide — the record, the bench count and the compensation that explain how a
total was reached are either abbreviated into `W-T-L` or not shown at all. The rounds are on a
different tab, one at a time. The whole evening has never existed in one place.

So the report is not the standings screen made bigger. It is the first thing this app produces that
is read somewhere the app is not, and almost every decision below follows from taking that
seriously.

## Decision

**1. A report exists only for an ended session.** The standings are derived on every read
(ADR-0008) and a mid-evening report would be a photograph of a moving table — one that would be
forwarded as a result, because a PDF looks like a result. `CONTEXT.md` defines a report as a record,
and this is what makes the definition true rather than aspirational. The link sits directly under
the standings table, on the organizer's tab and on the spectator's shell alike: the two read the
same table, and the person most likely to want the evening on their own phone afterwards is the one
who did not run it.

**2. Roboto carries every word, and this is forced.** ADR-0021 §4 chose Verdana because it is
installed everywhere and therefore costs no bytes and no round trip. That property is exactly what
makes it unembeddable: there is no Verdana file in this repo and there could not legally be one. The
fallback a PDF library offers instead is the core-14 fonts, and those are WinAnsi — `ė į ų ū ą č`
have no codepoint in it, so Helvetica cannot spell `Deimantė`. Half this app's audience reads
Lithuanian, so this is not a compromise, it is a wall.

What is left is embedding a Unicode face, and the cheapest correct one is the Roboto that pdfmake
already bundles. The report therefore looks like a document and not like the app, and that is
recorded here rather than apologised for: ADR-0021 is a decision about a phone held at arm's length
in fading light, and none of its reasoning survives the move to paper.

**3. No medals, and joint positions are marked.** The reference this feature was modelled on puts
🥇🥈🥉 in its position column. Roboto has no emoji, so copying that yields three empty boxes at the
top of the table — and drawing the metals as vectors would be spending the report's one flourish on
the thing the Standings tab already calls "the one warm thing on the screen". A monochrome
print-ready document is not that screen.

A **joint position** is marked, though, and that is not the same kind of choice. Decision #8 went to
real trouble to make a shared place a result rather than an unfinished tie-break, and two rows
reading `2` followed by a row reading `4`, unexplained on a page nobody can ask a question about,
reads as a bug in the generator.

**4. There is no `DIFF` column**, despite the reference having one. Point difference is computed
nowhere in `padel-engine`, deliberately: ties are resolved on head-to-head and then stop (decision
#8, ADR-0008). A difference column printed beside the ranking would look like the tie-break and
would not be it, on the one artefact where no reader can tap anything to find out.

What the report gains instead are the columns the phone had no room for: played, the full record,
the **bench credit** that explains why a record does not add up to a total (ADR-0023), and
**compensation** where the evening paid it. `Comp` appears only when `compensatedUnplayed` is set,
because a column of zeros on every ordinary evening teaches a reader nothing and invites them to
wonder what they missed. **Abandoned rounds are printed and marked unplayed** — a report that
silently dropped them could not explain the column sitting above them.

**5. The document is built by a pure function, and pdfmake is behind a token.**
`buildReport(record, rows, copy) → DocDefinition` imports no library and produces a plain data
structure. Every decision in this ADR lives in that function. The lazy `import('pdfmake')` sits
behind a `PDF_MAKER` injection token that takes a definition and returns a blob — three lines, and
the only part of this feature that can fail at runtime.

That seam is what stops the report becoming a second, drifting rendering of the standings: it is
handed the same `StandingRow`s the screen renders and the same copy dictionary the screen reads, so
there is one answer to what a competitor is called and what they scored.

**6. A failed chunk is a sentence, exactly as the QR's is.** pdfmake is the second third-party
library this app fetches on first use, and `share/qr-matrix.ts` already established the whole
pattern: an injection token, the CommonJS interop, `allowedCommonJsDependencies`, and — because
decision #15 commits this app to working offline and there is still no service worker — copy that
says a connection is needed rather than a button that does nothing (ADR-0030).

**7. The file is shared where sharing exists, and downloaded where it does not.**
`navigator.share({ files })` behind a `canShare` check, falling back to a blob download. Choosing
either alone means shipping the bad path to half the audience: a blob download on iOS Safari opens
a tab instead of saving a file, and the share sheet does not exist on desktop Firefox. The name is
`padel-<mode>-<YYYY-MM-DD>.pdf` from `createdAt`; two evenings of one mode in a day collide, and the
browser's own `(1)` is a better answer to that than a timestamp on every file forever.

**8. It ships with no automated tests, on purpose.** What lands is a `tools/` script that prints a
report for an awkward session, read by a person and asserted on by nothing — ADR-0005's treatment,
for ADR-0005's reason: the failure mode of a generated document is that page three breaks mid-round
and looks wrong, and no assertion has ever noticed that.

This is a deferral and is recorded as one. It follows ADR-0021 §6 — the values are a starting
position, not a monument — and the thing being deferred is hardening a layout before anybody has
held one. `buildReport` being pure (§5) is what keeps the bill small: the tests are ordinary
assertions on a data structure whenever they are wanted.

## Consequences

- This app now has two typefaces on screen and a third on paper. That is one more than ADR-0021
  planned for, and the honest summary is that nothing the organizer reads at a court changed.
- The report is the first feature here without a scenario spec, in a repo with fourteen of them.
  Two things narrow the gap for free: `dictionaries.spec.ts` (ADR-0033) still fails on a missing or
  wrong-arity Lithuanian key, and §5's pure builder means a spec is cheap the day it is wanted.
  Nothing else covers this until somebody runs the tool.
- pdfmake is a large dependency for one screen's link, and it is fetched from the network every
  time until decision #15's service worker exists. The offline sentence in §6 is load-bearing, not
  defensive.
- The Vitest suite cannot see the production bundle — its module interop hides exactly the missing
  CommonJS `export` that `qrcode` hit. The built chunk's exports are checked by hand, and this is
  now the second place in this repo paying that tax.
- `CONTEXT.md` gains **Report**, and it has to fight for the word: **record** is a competitor's
  W-T-L, **standings** is the table, **score sheet** is one match's two numbers, and **session
  history** is the list of ended evenings. "Tournament report" is the one name that was never
  available.
