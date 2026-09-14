# 34. Radius is a role, and the verifier proves it

- **Status:** Accepted
- **Date:** 2026-09-12
- **Relates to:** decision #16 in [docs/DECISIONS.md](../DECISIONS.md),
  [ADR-0018](0018-themed-by-tokens-from-the-first-component.md) §1 and
  [ADR-0021](0021-the-identity-is-court-at-dusk-and-verdana-carries-the-text.md) §4
- **Amends:** ADR-0021 §4, by extending its argument to a third axis

## Context

Two axes of this app's look are already expressed as names rather than measurements, for the same
reason each time. Colour is a token because no component should name a colour, so re-skinning is
editing one file (ADR-0018 §1). Type is a *role* — `text-header`, `text-scoreline` — because a role
carries the face and the tracking as well as the size, so a component that reaches for `text-sm`
gets a third of the answer and silently drops the rest (ADR-0021 §4).

Radius got neither treatment, and it shows. The templates carry **49 arbitrary values**:
`rounded-[15px]` thirty times, `rounded-[20px]` eight, `rounded-[18px]` five, `rounded-[14px]`
four, and one each of `rounded-[22px]` and `rounded-[13px]` — six radii where the design has at
most four roles. `rounded-full` is used fourteen times and is fine, because it names a role
already. Two more literals are hard-coded in `styles.css` itself, as `border-radius: 26px` on the
sheet panel.

This is exactly the failure ADR-0021 §4 described. Nobody wrote a wrong number; each corner looked
right on its own, none of it is wrong in any local sense, and none of it shows up in a diff review.
There is no rule to break, so the drift is not a violation of anything — which is why it reached
six values without being noticed.

The immediate forcing function is [ADR-0035](0035-the-idiom-is-modern-and-the-palette-is-unchanged.md).
The Modern idiom re-dresses every screen in the app and changes the card radius as it goes, so
radius is touched on every card in eight tickets. Fixing the axis once, first, is the difference
between one mechanical change and eight opportunities to re-create the drift. Doing it afterwards
would mean converting templates that had just been rewritten.

## Decision

**1. Three roles, defined in `styles.css` beside the colour and type tokens.**

| Token | Value | The role |
|---|---|---|
| `--radius-card` | `24px` | a card resting on the page — the court card, a standings block, the podium |
| `--radius-control` | `16px` | anything touched that is not a pill — inputs, the score field, toggles, chips |
| `--radius-sheet` | `26px` | a sheet lifted over a scrim |

The values come from the canvas (`docs/design/canvas/Modern*.dc.html`), where `24px` appears
sixteen times, `16px` twenty-three and `26px` three. `26px` is not a new value: it is the number
already hard-coded twice in `styles.css`, now named.

**2. A pill keeps `rounded-full`.** It is the fourth role and it needs no token, because
`rounded-full` is already a name rather than a measurement — the same reason `flex` is allowed and
`w-[390px]` would not be. It is the most common radius in the Modern set by a wide margin, at
seventy-nine of the boards' uses.

**3. Every existing value collapses into the four.** `[15px]`, `[14px]` and `[13px]` become
`control` (thirty-five uses); `[20px]`, `[18px]` and `[22px]` become `card` (fourteen). The
canvas's own strays — a `14px`, an `18px`, a `32px`, a `13px`, seven in total across six boards —
collapse the same way. They are drawing drift, not roles, and adopting them would import the
problem this ADR exists to end.

**4. `tools/verify-app-conventions.mjs` gains a fifth rule: no component names a radius.** A
`rounded-[…]` arbitrary value and a raw `border-radius` in a component style are both rejected;
the three roles and `rounded-full` pass; `styles.css` is exempt, as it already is for rules 2 and
3, because it is where the roles live. Like every other rule in that file it runs over deliberate
violations and deliberate near-misses, because a checker nobody has seen reject anything is
indistinguishable from one that always passes.

## Consequences

- The sheet panel stops spelling `26px` twice. That is the first radius literal this rule would
  have caught, and it was in the token file, which is the one place the rule cannot see.
- A fifth rule is a fifth thing a contributor can trip over while being locally right. That is the
  price of the axis holding, and it is the same price rules 2 and 3 already charge.
- Radius is the third axis to become a role and the last one being done now. Spacing is the
  obvious fourth and is deliberately left alone: the templates use Tailwind's own `gap-*` and
  `p-*` scale, which is already a named scale rather than arbitrary values, so there is no drift
  to end. If arbitrary spacing ever appears, this ADR is the precedent for what to do about it.
- Four roles is a claim about the design, not a measurement of it. If a fifth genuinely appears it
  is added here; what the rule prevents is a fifth appearing as `rounded-[19px]` in one template.
