# Spec: Settings — theme and language

**Status:** ready to slice
**Decided by:** [ADR-0031](../adr/0031-the-app-has-a-settings-sheet-and-a-preference-belongs-to-the-browser.md),
[ADR-0032](../adr/0032-two-typed-dictionaries-and-switching-language-reloads.md),
[ADR-0033](../adr/0033-the-parity-check-is-a-spec-because-arity-is-not-a-fact-about-text.md)
**Vocabulary:** `CONTEXT.md` → **Preference**, **Theme**, **Language**

The app gains its first settings surface and its first two preferences: a theme with three answers
and a second language. The ADRs carry the *why*; this file carries the *what*, in the order it
lands.

---

## 1. The preference store

One module owns reading and writing both preferences. Nothing else touches `localStorage`.

- **Storage:** `localStorage`, one key per preference. Values are the literal strings below so the
  pre-paint script (§2) can read them without parsing.
  - `pth.theme` ∈ `system` | `light` | `dark`. Absent or unrecognised ⇒ `system`.
  - `pth.language` ∈ `en` | `lt`. Absent or unrecognised ⇒ `en`.
- **Every read and write is wrapped in `try`.** A browser that refuses storage (private mode,
  blocked site data) yields `system` + `en` and the app works normally. A failed *write* is
  swallowed: the switch appears not to stick, and that is the honest outcome.
- No `navigator.language` sniffing anywhere, for any audience (ADR-0032 §2).
- Exposed to Angular as a small injectable. Theme is a signal — changing it re-stamps the DOM live.
  Language is not a signal: setting it writes and calls `location.reload()` (ADR-0032 §3).

**Not** in Firestore, **not** on the device identity, **not** on the linked account (ADR-0031 §4).

## 2. The pre-paint script

A short `try`-wrapped script inline in `index.html`, running before Angular boots. It reads both
keys and stamps **four** things — all four, or the override is only half applied (ADR-0031 §5):

| What | Value |
|---|---|
| `<html data-theme>` | `light` / `dark`, resolved from the preference and `prefers-color-scheme` when the preference is `system` |
| `<html lang>` | `en` / `lt` |
| `<meta name="color-scheme">` | `light` / `dark` under an override; `light dark` under `system` |
| `theme-color` metas | Today two metas selected by `media="(prefers-color-scheme: …)"` (`index.html:11-12`). Under an override the media selection is wrong, so the script collapses them to a single `theme-color` carrying the surface colour of the resolved theme. |

`data-theme` is always stamped with a resolved value, including under `system`, so that a `system`
user whose OS flips mid-session is handled by a `matchMedia` listener in the app rather than by two
different mechanisms disagreeing.

Keep it small. It is the only JavaScript in this app that no test runs, no linter reads and no
convention check proves (ADR-0031, consequences).

## 3. Theme in `styles.css`

No token *values* change. No component changes. ADR-0018 §1–§2 already made every token
dual-valued.

- The existing `@media (prefers-color-scheme: dark) { :root { … } }` block gains a guard so an
  explicit **light** choice beats a dark OS.
- A `:root[data-theme='dark']` selector carries the same dark values so an explicit **dark** choice
  beats a light OS.
- The two must not duplicate the palette by hand — one list of dark values, one selector list.
- The file header comment currently reads *"`prefers-color-scheme` switches the two themes, and
  there is no in-app toggle."* It is now false and must be rewritten.

## 4. The settings sheet

Opened through `Sheets` (`app/sheet/sheets.ts`), so it is a bottom sheet on a phone and a centered
dialog at the desk tier, like every other focused surface. It knows nothing about width.

Contents, in order:

1. **Theme** — a three-way segmented control: *System*, *Light*, *Dark*. Applies immediately, no
   confirm, no reload.
2. **Language** — a two-way control: *English*, *Lietuvių*. Selecting the one already active does
   nothing. Selecting the other writes and reloads.

The language control names each language **in that language** — *Lietuvių*, not *Lithuanian* — so
it is legible to the person who needs it. This is the one deliberate exception to §7's rule that
every string is translated, and both dictionaries carry the same two words.

Closing is the sheet's normal dismiss. There is no Save.

## 5. Reaching it

- **Landing header:** a gear beside the masthead.
- **Session header:** share and gear paired on the **left**; **Done** keeps the right edge alone
  (ADR-0031 §2). Present in every state, including after the session has ended.
- Both open the same component.
- Both buttons carry an `aria-label` from the dictionary; the glyph is `aria-hidden`, matching the
  share button's existing treatment in `session-shell.html`.

## 6. The spectator

`/s/:code` gets a **language toggle and nothing else** — no gear, no sheet, no theme control
(ADR-0032 §6). It carries the theme from the shared preference if the browser has one, and
otherwise follows the OS, like everything else.

The toggle writes the same `pth.language` key and reloads, exactly as the organizer's does. It has
to: a toggle that stored nothing would revert on the reload it triggers.

## 7. Two dictionaries

- `copy/copy.ts` splits into `copy/copy.en.ts` and `copy/copy.lt.ts`.
- `type Copy = typeof copyEn`, and `copy.lt.ts` ends `satisfies Copy`. A missing entry, a renamed
  one, or a Lithuanian function with the wrong arity is a **build error**.
- The active dictionary is selected once, at startup, from the preference. Consumers keep
  `protected readonly copy = copy` and templates keep `copy.session.done` — **all 136 template
  reads across 26 templates stay exactly as they are** (ADR-0032 §3).
- The dictionaries are walked against each other for what the type cannot see — chiefly a
  translated function that quietly dropped an argument, which TypeScript permits. That walk is
  `copy/dictionaries.spec.ts` rather than a rule in `tools/verify-app-conventions.mjs`, which reads
  source text and cannot see it (ADR-0033). The convention checker keeps its four rules, and its
  "no template writes a word of its own" rule, entirely untouched.
- **Not translated:** mode names (`Americano`, `Mixicano`, `Team Americano`) and `appName`
  (ADR-0032 §5). Player names, court names and session titles are the organizer's own text and are
  never touched.
- **`dayFormat` (`copy.ts:681`) becomes locale-driven** — `en-GB` under EN, `lt-LT` under LT.
- **Plurals use `Intl.PluralRules`** for the locale (ADR-0032 §4). Affects at least
  `players.count`, `round.heading`, `history.row` and `identity.adoptConfirm`. Lithuanian has three
  forms and 11–19 take the third even though 21 takes the first; hand-written modulo arithmetic is
  wrong at 111 and is not acceptable here.

## 8. The Lithuanian text

Drafted by an agent, **reviewed by a native speaker before merge**. Terms flagged for review
because padel has club vernacular a dictionary translates and a player never says:

- **bench** — neither *atsarga* nor *poilsis* is obviously what a player says
- **went home** — `CONTEXT.md` defines this as explicitly *not* a deletion; the Lithuanian has to
  keep that softness
- **needs partner**
- **v** (versus, `round.versus`)

Ship no Lithuanian that has not been read by someone who speaks it.

---

## Acceptance

- [ ] A cold start with `theme=dark` on a light-OS phone paints dark on the **first** frame — no
      flash of light.
- [ ] Choosing **Light** on a dark-OS phone shows the light theme, and the notch bar and scrollbars
      agree with it.
- [ ] Choosing **System** and then flipping the OS theme changes the app without a reload.
- [ ] Both preferences survive a reload, a PWA relaunch and going offline.
- [ ] Blocked site data: the app opens in system theme and English, with no error and a switch that
      simply does not stick.
- [ ] Switching to LT reloads and returns in Lithuanian, with the session state intact.
- [ ] A Lithuanian history list shows Lithuanian weekday names.
- [ ] `1 / 3 / 11 / 21 / 111 players` are all correctly inflected in LT.
- [ ] A spectator opening a share code sees English, can switch to Lithuanian, and has no theme
      control and no gear.
- [ ] Deleting an entry from `copy.lt.ts` fails the build.
- [ ] `verify-app-conventions.mjs` still passes and still catches a literal in a template, and
      `npm run verify` now also catches a dictionary that has drifted (ADR-0033).
