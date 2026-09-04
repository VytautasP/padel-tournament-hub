# 21. The identity is Court at dusk, and Verdana carries the text

- **Status:** Accepted
- **Date:** 2026-09-04
- **Relates to:** decisions #15, #16 and #20 in [docs/DECISIONS.md](../DECISIONS.md), and
  [the design canvas](../design/canvas/README.md)
- **Supersedes:** [ADR-0018](0018-themed-by-tokens-from-the-first-component.md) §4, "the identity
  itself is deliberately not decided"

## Context

ADR-0018 settled how the app would be themed and refused to settle what it would look like. Its
reasoning was that a palette chosen for an app nobody has held at a court, in evening light, at
arm's length, is a guess wearing a decision's clothes — so it built both themes from tokens,
deferred the values, and left decision #16's open question open.

The deferral was aimed at a specific event: the real padel night of decision #23, tracked as issue
#25. That night has not happened. Deciding now therefore breaks the letter of ADR-0018 §4, and the
question is whether it breaks the spirit.

It does not, and ADR-0018 §1 is the reason. Because no component names a colour, re-skinning is
editing the top half of one file — so the palette is the *cheapest* part of the app to revise
after a night at a court. The layout, the type scale and the responsive structure are the expensive
half, and none of them is waiting on anything. Holding the whole refactor for the night would trade
a cheap revision for an expensive delay; worse, the alternative of building layout on the
provisional grey means running the night on a look nobody can judge, which is the one outcome that
would waste the night itself.

Three directions were drawn, and the canvas built out fourteen artboards in one of them. That
choice, the palette it implies, the two faces and the eight tokens it needs are what this records.

## Decision

**1. Direction A, "Court at dusk".** A teal brand — `#0e6f87`, lightening to `#3fa8c4` in dark —
on a cool blue-grey neutral ramp. The two rejected directions stay on the canvas as the record of
what was considered: **B, "Clubhouse board"**, warm cream and clay, the most likeable indoors and
the least readable outdoors; **C, "Scoreboard"**, near-black with lime and orange, the most legible
of the three and a dark design whose light theme would always have been the lesser half. The case
to design for is a phone read at arm's length in fading light, and A is the one that stays legible
without shouting.

**2. Eight tokens join the existing set**, all of them with a light and a dark value, per ADR-0018
§2: `podium-gold`, `podium-silver`, `podium-bronze`, `warning`, `warning-surface`, `danger`,
`shadow-raised` and `shadow-sheet`. The two shadows are two roles rather than a scale — a card
resting on the page, and a sheet lifted over a scrim — and their dark values are not the light ones
dimmed: ink at 6% is invisible on a dark surface, so dark shadows go black and much stronger.

Adding tokens rather than reaching for a utility is what keeps ADR-0018 §1 true. A component still
names `bg-podium-gold` and `shadow-sheet`, never a colour, and
`tools/verify-app-conventions.mjs` still proves it.

**3. `danger` is spent on two things and no others: the confirming button inside Discard, and
inside Delete a past session.** Those are the app's only unrecoverable acts. It does not go on the
overflow entry that opens them, because a menu that shouts before the organizer has asked for
anything teaches them to stop reading it. It does not go on **End session**, which is how every
evening is supposed to finish and which produces the podium; colouring it as a hazard would teach
the organizer to fear the happy path. It does not go on **went home**, which `CONTEXT.md` defines
as explicitly not a deletion — nothing about the evening so far changes.

**4. Two faces. Verdana carries every word that is read; Space Grotesk 700 carries titles, round
headers and scorelines.** Verdana because it was drawn for small sizes on screen and is installed
everywhere, so the text the organizer must read at a court arrives with no network in the path.
Nothing on a phone falls below 13px, and numbers are always tabular.

**5. Space Grotesk is self-hosted**, from `projects/padel-app/public/`, not linked from
`fonts.googleapis.com`. The reasoning that chose Verdana does not survive leaving the other face on
a CDN: decision #15 commits this app to working offline, and a scoreline is exactly the text that
matters at exactly the moment — a court, bad signal — when a third-party fetch fails. Self-hosting
is also what lets step 4's service worker cache it at all.

**6. The values are a starting position, not a monument.** Issue #25 is still the test. The first
ticket lands the palette and the Round tab together precisely so there is something real to hold at
a court, and what that night says goes back into one file.

## Consequences

- Decision #16's open question in `DECISIONS.md` — *"Visual identity: colours, typography, dark
  mode — undecided"* — is struck. Dark mode remains as ADR-0018 §3 left it: `prefers-color-scheme`,
  no in-app toggle.
- The canvas is a primary source, not decoration. `docs/design/canvas/Palette.dc.html` holds every
  token's light and dark value and `TypeScale.dc.html` the full scale; this ADR deliberately does
  not copy them, because a second copy of a palette is a second thing to get out of step.
- Verdana is the most contestable line here. It is wide, and to an eye that recognises it, it reads
  as undesigned. That is the price of a body face that costs no bytes and no round trip, and it was
  paid knowingly.
- A `danger` token ships with two consumers and four plausible ones. `warning` and
  `warning-surface` are used by the *needs partner* flag alone. Both are additions to one file
  rather than scattered, so an unused token is visible in the place it is defined.
