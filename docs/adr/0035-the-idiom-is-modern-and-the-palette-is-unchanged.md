# 35. The idiom is Modern, and the palette is unchanged

- **Status:** Accepted
- **Date:** 2026-09-12
- **Relates to:** decision #16 in [docs/DECISIONS.md](../DECISIONS.md),
  [ADR-0018](0018-themed-by-tokens-from-the-first-component.md),
  [ADR-0022](0022-three-tiers-and-only-the-navigation-knows-about-width.md),
  [ADR-0034](0034-radius-is-a-role-and-the-verifier-proves-it.md), and
  [the design canvas](../design/canvas/README.md)
- **Amends:** [ADR-0021](0021-the-identity-is-court-at-dusk-and-verdana-carries-the-text.md) §2,
  by adding four tokens to its eight, and ADR-0021's consequence that "the canvas is a primary
  source", which is now true per page rather than wholesale
- **Supersedes:** nothing

## Context

ADR-0021 chose direction A, *Court at dusk*, and the app was built out in it: every screen, both
themes, and after ADR-0022, three tiers. The canvas then drew a sixth page, **Modern** — the Phone
set re-dressed in a more current idiom, adding no screen and no copy.

The first thing to establish is what kind of change this is, because the obvious reading is wrong.
Modern is **not** a fourth direction alongside A, B and C. It keeps the teal brand, both faces and
the whole type scale. Its `modern-note` describes five moves, all of them about how a surface is
held rather than what colour it is: a card's border becomes a shadow, a header becomes a gradient,
a bottom bar becomes a floating island. So ADR-0021 §1 is not in question here and neither is §4.
What is in question is the *idiom* — the component vocabulary the identity is expressed through,
which ADR-0021 never named because it had no reason to.

That distinction decides the cost. ADR-0021's case for deciding the palette before the padel night
was that ADR-0018 §1 makes a palette the cheapest thing in the app to revise, while "the layout,
the type scale and the responsive structure are the expensive half". This change is in that
expensive half, and it should be said plainly rather than argued around: re-dressing every screen
is markup work across the whole app, and no token file makes it free.

Two things make it cheaper than that framing suggests. **No spec in the app asserts on a class
name** — zero hits across twenty-five spec files — so the behaviour the tests describe is untouched
by any of the five moves, and a restyle that breaks a test has broken something real. And the four
values the moves need can be tokens, which puts the parts of the change most likely to be revised
on a real evening into the one file that is cheap to revise after all.

The alternative considered was shipping Modern as a second skin the organizer could choose. It was
rejected: the five moves are structure, not colour. A card held by a shadow is different markup from
a card held by a border, and a floating pill island is a different component from a bottom bar. Two
idioms means every component carries both, forever, and no convention check can help because neither
one is wrong.

## Decision

**1. Modern replaces direction A's idiom. There is one idiom and no toggle.** ADR-0021's palette,
its two faces, its type scale and its eight tokens are unchanged. If a real evening rejects the new
idiom, reverting is a branch, not a feature flag.

**2. All five moves, as one idiom.**

1. Cards lose their hairline border and are held by a shadow instead, at `--radius-card`.
2. The round header becomes a full-bleed gradient with a segmented progress bar. The bar is a
   graphic, not a string, so it adds no copy.
3. The bottom bar becomes a floating pill island, inset 16px, with the active tab a filled brand
   pill and its label beside the icon rather than under it.
4. Primary actions become gradient pills with a coloured shadow.
5. Emphasis moves from borders to tinted fills: a winning side sits on `brand-wash`, and *no score
   yet* becomes a chip.

Half the moves would be neither look. The two most contestable are the gradient header — a saturated
brand block at the top of a phone read in fading light is precisely what ADR-0021's reasoning would
question, and the dark board already concedes it — and the pill island, which costs vertical space
and must keep ADR-0021's 44px targets and its `env(safe-area-inset-bottom)` padding. Both are kept,
and both are what a real evening is for.

**3. Four tokens join ADR-0021's eight, each named for its role rather than its colour.**

| Token | Light | Dark |
|---|---|---|
| `--gradient-header` | `brand-strong` to `brand` | `surface-sunken` to `surface-raised` |
| `--shadow-card` | `0 6px 20px` ink 8% | `0 6px 20px` black 45% |
| `--shadow-float` | `0 10px 30px` ink 16% | `0 10px 30px` black 55% |
| `--shadow-brand` | `0 8px 22px` brand 32% | `0 8px 22px` black 45% |

`--gradient-header` carries the reason for the whole naming rule. The canvas calls it a brand
gradient, and in light it is one; in dark it is drawn from two surfaces with no brand in it at all,
because — as the `modern-note` puts it — a saturated brand header at night is the one thing a phone
at a court cannot afford. A token named `--gradient-brand` would therefore be honest in one theme
and a lie in the other, while ADR-0018 §2 requires both values from the start. Named for the role it
fills, it stays true in both. `shadow-raised` and `shadow-sheet` were named the same way and for the
same reason.

`--shadow-brand` was drawn at two values, `0 8px 22px` at 32% and `0 8px 24px` at 28%. That is
drawing drift, and it collapses to the first.

**4. `--shadow-brand`'s dark value goes black, and it is the one value here with no drawing behind
it.** The canvas drew the brand-coloured pill shadow only in light, hard-coded at the light brand.
In dark the brand lightens to `#3fa8c4`, and a pale blue glow under a button on a dark screen reads
as a focus ring rather than a lift. ADR-0021 §2 already settled this shape of question — ink at 6%
is invisible on a dark surface, so dark shadows go black and much stronger — and this follows that
precedent rather than inventing a glow nobody has looked at.

**5. Every screen, including the ones Modern never drew.** The canvas drew Round, Score, Standings
and Players, plus a dark and a desktop board. The app also has the landing page, the four-step
wizard, the roster preview, the Team Americano roster, the settings sheet, the share sheet, the
confirmations and the spectator page. The five moves are rules rather than drawings, so they are
applied by hand to all of them. A pill island over a bordered card is not a half-finished idiom, it
is two idioms.

The **spectator page is last and on its own**, because it is the only surface the organizer never
sees and a stranger always does, and it has no artboard in any direction. If it turns out to need
real design attention rather than re-dressing, that surfaces as one blocked ticket instead of a
stalled branch.

**6. ADR-0022's tiers and widths stand.** `ModernDesktop` draws a 232px rail and a 366px aside;
ADR-0022 §1 fixes 248 and 340 and reasons about those numbers to place the 1280 breakpoint. The
board did not. The board's widths are drawing slack, not a proposal.

**7. The canvas becomes a primary source per page, not wholesale.** ADR-0021's consequences called
the canvas a primary source when every board agreed with the app. Now:

- **Foundations** (`Palette`, `TypeScale`) stays **live** and gains these four tokens. It is the
  token record rather than an idiom drawing, and a second copy of a palette out of step is worse
  than none.
- **Modern** is the **live idiom**.
- **Phone**, **Desktop** and **Dark** become a **historical record** of direction A as built. They
  are kept, not deleted — the same argument ADR-0021 §1 makes for keeping directions B and C.
- **Directions** stays what it always was: the record of what was considered.

## Consequences

- No copy changes anywhere in this work. The progress bar is a graphic and no move adds a string, so
  ADR-0032's two dictionaries are untouched and rule 1 of the convention check has nothing new to
  police.
- The progress bar has as many segments as the session has rounds. The canvas drew seven because
  that session had seven; ADR-0016 §2 pages `Round 4 of 9`, and `+ add round` grows the number
  during the evening. A hard-coded seven would be a bug the canvas invites.
- `CONTEXT.md` does not change. Card, pill, island, rail and aside are presentational; nothing here
  touches session, round, match, side, bench, bye, went home or joint position.
- The convention check needs no new rule for any of this. Its colour literal pattern already matches
  a hex or an `rgba(` anywhere in a template or a component style, so a component spelling out a
  gradient stop or a shadow is caught today, and rule 4 already forces each of these four tokens
  into both dark selectors. Radius is the one axis that did need a rule, and
  [ADR-0034](0034-radius-is-a-role-and-the-verifier-proves-it.md) adds it.
- Issue #73, the both-themes walk, is deliberately left alone rather than re-scoped around this
  change. `--shadow-brand` in dark is judged instead when the first ticket lands, by the person who
  built it, on the screen it appears on.
- **The extraction undercounted by one, and the fifth value is `--palette-header-ink`.** §3's table
  names the header's *ground* and not its foreground, and nothing already in the palette reads on
  both: the ground is teal in light and near-black in dark, so `brand-ink` is white in light and
  near-black in dark, and `ink` is the other way round. The header therefore carries a pair of its
  own, named for its role like the other four, and one pair covers the whole surface — the words,
  the two paging discs at a low opacity, and the progress bar's three strengths. The canvas drew
  all three of those from it in both themes (`#ffffff` and `#e6ebf2`) except the bar, which it drew
  from the dark brand; that would have wanted a sixth pair to say nothing the ink does not already
  say at full strength. This is recorded here rather than by editing §3, because §3's count is what
  was decided and this is what building it found. It changes nothing else in this ADR: it is the
  same argument §3 makes about `--gradient-header`, applied to the half of that surface §3 did not
  write down.
- The progress bar has a third state the canvas never drew. The boards show a round played out and
  a round untouched; a round with some of its courts scored is neither, and it is the state the
  bar is in for most of an evening. It is the same ink at a middle strength.
- ADR-0021 §6 still holds, and now covers more: the values are a starting position, and so is the
  idiom.
