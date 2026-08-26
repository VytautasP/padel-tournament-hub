# 18. Themed by tokens from the first component, identity deferred

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decision #16 in [docs/DECISIONS.md](../DECISIONS.md), and its open question
  *"Visual identity: colours, typography, dark mode — undecided"*

## Context

Decision #16 picked Tailwind and Angular CDK over Material precisely so this app could have its
own look — and then left every question about that look open. Step 2 has to be built anyway, which
forces a smaller question: how much of the identity has to be settled before the first component
is written?

Two of the three answers are bad. Deciding a full identity now means choosing a palette and a type
scale for an app nobody has held at a court, in an evening light, at arm's length. Shipping
Tailwind's default greys and styling later sounds cheap, but the expensive half of theming is not
the palette — it is retrofitting a second theme through components that were written assuming one.

## Decision

**1. Colour is expressed only as tokens.** A neutral scale plus a single brand hue, defined as CSS
custom properties in the Tailwind config. No component names a raw colour. Changing the identity
later is editing the token file, not auditing templates.

**2. Both themes are defined from the first component, not retrofitted.** Every token has a light
value and a dark value from the start, even while the values themselves are provisional.

**3. Dark mode follows `prefers-color-scheme`, with no in-app toggle.** A toggle needs a settings
surface this app does not otherwise have, and a persisted preference to go with it. The OS already
knows the answer.

**4. The identity itself is deliberately not decided.** Palette, typography and the actual look are
deferred until after the real padel night that step 2 exists to enable (decision #23). The open
question in `DECISIONS.md` stays open; this ADR only settles how the app is built while it does.

## Consequences

- Reviewing an early screen means judging layout and hierarchy, not colour. A provisional palette
  will look provisional, and that is not a defect to fix.
- Both themes have to be eyeballed as components land. A dark value that was never looked at is
  not meaningfully "defined from the start".
- If a manual toggle is ever wanted, it arrives with step 4's PWA polish and needs somewhere to
  live — which is an argument for a settings surface, not against the toggle.
