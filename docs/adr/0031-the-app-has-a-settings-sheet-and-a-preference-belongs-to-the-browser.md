# 31. The app has a settings sheet, and a preference belongs to the browser

- **Status:** Accepted
- **Date:** 2026-09-09
- **Relates to:** decisions #15 and #16 in [docs/DECISIONS.md](../DECISIONS.md),
  [ADR-0025](0025-firestore-is-the-only-source-of-truth.md),
  [ADR-0030](0030-a-missing-chunk-is-a-404-and-a-stale-tab-reloads.md)
- **Supersedes:** [ADR-0018](0018-themed-by-tokens-from-the-first-component.md) §3, "dark mode
  follows `prefers-color-scheme`, with no in-app toggle", and the line
  [ADR-0021](0021-the-identity-is-court-at-dusk-and-verdana-carries-the-text.md) inherited from it
- **Amends:** [ADR-0026](0026-the-spectator-is-a-route-in-this-app-and-sharing-is-a-header-sheet.md) §4

## Context

ADR-0018 §3 refused a theme toggle, and the reason it gave was not that the toggle was wrong: *"a
toggle needs a settings surface this app does not otherwise have, and a persisted preference to go
with it. The OS already knows the answer."* It then wrote its own escape clause: *"If a manual
toggle is ever wanted, it arrives with step 4's PWA polish and needs somewhere to live — which is
an argument for a settings surface, not against the toggle."*

That is the situation now. A toggle is wanted, and so is a language switch
([ADR-0032](0032-two-typed-dictionaries-and-switching-language-reloads.md)), which means the
surface has to exist for two reasons rather than one. This ADR builds the surface ADR-0018 named
and settles what a stored choice *is* — because the app has never stored one, and the obvious place
to put it is the wrong place.

The reasoning of ADR-0018 §3 survives its own supersession, and that is why the default is
unchanged: the OS *does* usually know the answer. The toggle exists for the organizer it is wrong
for — a phone that goes dark at sunset, held at a court where the light has not gone yet.

## Decision

**1. Settings is a sheet, reached from a gear in two headers.** It reuses `app/sheet/sheets.ts`,
the pattern the share sheet already established (ADR-0026 §4), rather than becoming a third route.
This product has two addresses and gains nothing from a third: a settings *page* would be a screen
you navigate away from mid-evening, and the whole point is that it is a detour rather than a
departure.

**2. The session header is share and gear on the left, and End on the right.** ADR-0026 §4 called
that header *"the one piece of chrome a session has"*, and it is now two. They are paired on the
left deliberately: **Done** is the only control on that bar that takes the organizer off the
screen, and giving it the right edge alone is what stops it being read as a third piece of chrome.
The ended header therefore gains a gear and loses nothing.

**3. Three answers, not two: system, light, dark, defaulting to system.** A two-state toggle would
quietly destroy what the app does today — a phone that follows the light would stop the moment the
organizer touched the switch once, and would never start again. `system` is not the absence of a
preference, it is a preference, and it is the one almost everybody should keep.

**4. A preference is stored in `localStorage`, and it belongs to the browser.** Not to the device
identity, and not to the linked account. Three reasons, in order of weight:

- It has to be readable **before anything else is**, including before the first paint and before
  the network. A preference that needed a Firestore round trip could not be applied without a
  flash, which is the defect the toggle exists to remove.
- The app must work signed-out from the front door. A preference on the account is a preference
  most organizers would never have.
- Theme genuinely *is* a browser fact. The phone at the court and the laptop at home are entitled
  to disagree, and syncing them would be a bug wearing a feature's clothes.

**This is the first production write to `localStorage`, and it is not a breach of ADR-0025.**
ADR-0025 makes Firestore the only source of truth *for a session* — for rounds, scores, roster and
history, the things a second device must agree about and a spectator must be able to read. A
preference is none of those. Nothing about the evening is recoverable from it and nothing about it
is worth recovering; clearing site data should lose it, and that is the correct outcome rather than
a tolerated one. `CONTEXT.md` carries the distinction as vocabulary so the next reader does not
have to re-derive it.

**5. The theme is applied by an inline script in `index.html`, before Angular boots.** This is the
only script this app runs outside Angular, and it is worth the exception. Anything Angular does
happens after the first paint, so an organizer who chose the opposite of their OS would see a flash
of the wrong theme on **every** cold start — a toggle that flashes is worse than no toggle, because
it looks broken at the moment it is meant to be helping.

The script owns four things, and it has to own all four or the override is only half applied:
`<html data-theme>`, `<html lang>`, `<meta name="color-scheme">`, and the two `theme-color` metas
that `index.html` currently selects with `media="(prefers-color-scheme: …)"`. Left alone, the notch
bar and the browser's own scrollbars and form controls would keep following the OS while the app
did not. It is a handful of lines, wrapped in `try`, and a browser that refuses storage falls
through to system theme and English in silence.

**6. `styles.css` gains `:root[data-theme='dark']` beside the `@media` block it already has**, and
the media query is guarded so that an explicit *light* choice beats a dark OS. No token values
change and no component changes: ADR-0018 §1 and §2 made every token dual-valued from the first
component precisely so that this day would be cheap, and it is.

## Consequences

- The gear is now on screen during a round, which is chrome competing with the game. It earns that
  by being the only way to fix a screen that is unreadable in the light you are actually standing
  in — which is a problem you have *while* playing, not before.
- `index.html` contains hand-written JavaScript that no test runs, no linter reads and no
  convention check proves. It is the highest-risk few lines in the app for its size, and it should
  stay the size it is.
- Flipping the two themes side by side becomes trivial for the first time. ADR-0018's consequences
  predicted that *"a dark value that was never looked at is not meaningfully defined from the
  start"*, and ADR-0021 §2 hand-tuned `danger`, `warning` and the podium metals per theme. Expect
  this feature to expose a pair nobody has actually eyeballed.
- Once a preference exists, the pressure to sync it to the linked account begins. `CONTEXT.md`'s
  `_Avoid_` line under **Preference** is the standing answer.
