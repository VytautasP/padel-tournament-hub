# 22. Three tiers, and only the navigation knows about width

- **Status:** Accepted
- **Date:** 2026-09-04
- **Relates to:** decision #17 in [docs/DECISIONS.md](../DECISIONS.md),
  [ADR-0019](0019-the-app-has-no-router-and-the-repository-is-asynchronous.md), and
  [the design canvas](../design/canvas/README.md)
- **Amends:** [ADR-0016](0016-the-session-is-three-tabs-and-one-round-at-a-time.md) §1, "three tabs
  — Round, Standings, Players", and
  [ADR-0014](0014-a-score-is-one-number-typed-into-either-side.md) §1, "score entry is a bottom
  sheet"

## Context

Every screen in the app is written for one width. `max-w-md` and `h-screen` pin the phone shape at
every viewport, and there is not a single responsive utility anywhere in `padel-app`. On a laptop
the app is a narrow column in an empty field.

The phone is not negotiable — it is the case the whole design serves, one hand at the side of a
court — but the organizer sets an evening up on a laptop, and step 3's spectator view will be
opened on whatever the spectator owns. Desktop has to be a place the app works rather than a place
it merely renders.

The canvas drew a desktop session: a left rail, courts two-up, and standings in a permanent aside.
That is a good answer and it contradicts ADR-0016 §1 in two ways at once, so it cannot be adopted
as a stylesheet change. It also raises a question the drawing does not answer — what happens
between 390px and 1440px — and a second one it cannot see at all, which is what a restructured
layout does to the way this app is tested.

## Decision

**1. Three tiers, two breakpoints: `md` at 768px and `xl` at 1280px.**

- **Below 768** — the phone, exactly as drawn.
- **768 to 1279** — the same layout widened, with courts two-up on the grid the desktop board
  already specifies. Bottom navigation stays. No aside.
- **1280 and above** — a 248px rail and a 340px standings aside.

The upper line is 1280 rather than 1024 because the chrome decides it: 248 + 340 is 588px before
any content, which leaves 436px at 1024 — too narrow for the two-up grid the tier exists to show.
At 1280 it leaves 692px, and at 1440, 852px.

The middle tier invents nothing. It is the desktop court grid wearing the phone's navigation, which
is why a third tier costs almost nothing here despite usually costing a third set of decisions per
screen.

**2. At 1280 and above the rail carries two destinations, not three: Round and Players.** Standings
stop being a destination and become context. A rail item that changes nothing when it is clicked is
a defect found within a minute, and the aside makes the Standings tab exactly that.

This is the amendment to ADR-0016 §1. What that ADR was actually claiming — one round at a time,
and the table never more than one move away — is honoured harder by an aside than by a tab, because
the table stops being a move away at all.

**3. The aside persists on both destinations.** It is not bound to the Round view. Once Standings
has been removed from the rail, an aside that appears only on Round leaves the table unreachable
from Players — and Players is precisely where it is wanted, because deciding whether to let
somebody go home is a question about how the evening is going. Players itself stays a single column
in the main area; a roster list two-up is harder to scan, not easier.

**4. Below 1280 a focused surface is a bottom sheet; at 1280 and above it is a centered dialog.**
That covers the score sheet, the confirmations, the partner sheet and the roster preview. ADR-0014
§1 put them at the bottom because "the tap that matters has to land under the thumb that asked for
it" — an argument explicitly about a phone. Above the breakpoint there is no thumb, and keeping the
position would be cargo-culting a conclusion past its premise. The helper every sheet opens through
is already the one place that decides this, so it stays one place — it is `sheet/sheets.ts`, named
for the two answers it now gives rather than for the one it used to.

**5. CSS expresses every width change that does not duplicate a label. A `layout()` signal
expresses the two that do.** Courts going two-up is a grid utility and involves no JavaScript.
Navigation and the aside genuinely restructure between tiers, and those read the tier from a signal
over CDK's `BreakpointObserver`, so exactly one of them is in the DOM at a time.

This is not a preference. The DOM test seam (`app-harness.ts`) drives the app by visible label, and
`isHidden` recognises only the `hidden` attribute and `aria-hidden` — it does not evaluate CSS,
because jsdom does no layout and the stylesheet is not loaded in a unit test. A Tailwind-only
responsive navigation puts two buttons labelled "Round" in the DOM at once, and `control()` throws
on the second. Expressing the restructuring as a signal keeps the seam honest by construction
rather than by care, and makes the tier a stated thing a test can set. Tests default to the phone
tier, so every spec written before this ADR passes unchanged and desktop specs opt in.

## Consequences

- The app still has no router (ADR-0019). A tier is not a destination; it is which destinations
  exist.
- There is now a third thing a screen can be wrong about. Both themes already had to be eyeballed
  as components land (ADR-0018); now both themes at three widths do. The middle tier is the one
  most likely to be forgotten, because neither the phone nor the desktop boards show it.
- A 1100px laptop window gets bottom navigation rather than the rail. That is the accepted cost of
  two breakpoints instead of three, and the tier is chosen on the proxy that matters — whether the
  device is likely being held — rather than on width for its own sake.
- The canvas never drew the wizard, Players, the score sheet or the roster preview at desktop
  width. Decision 4 is the rule that covers all four, which is why no further artboards are needed
  before building.
- The desktop boards were drawn in literal light hex, but every one of their thirteen colours is an
  existing token. Desktop dark therefore falls out of the token layer for free, and is verified in
  a browser rather than by drawing it twice. The one thing to watch is the rail and the aside: they
  are large flat `surface-raised` planes separated from the page by very little in dark, and if
  that reads as mush the fix is a `line` border, not a new token.
