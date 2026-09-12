# The UI design canvas

The source of the design canvas **"Padel Tournament Hub UI"**, committed here so the visual
refactor has a primary source in the repo rather than only a URL.

- **Canvas:** <https://claude.ai/code/artifact/ca52ae55-e500-4de9-ac8a-6bea4358a29f>
- **Captured:** 2026-09-04, verbatim. These files are the canvas's own source, not a transcription.

Open the URL to *look* at the design. Read the files here to know what a value actually is — the
canvas is what the artboards look like, and these are what they are made of.

## These files do not open in a browser

Each `.dc.html` is a canvas artboard, not a page. It loads a `./support.js` that does not exist
here, and its markup is templated — `{{t.brand}}`, `{{t.inkMuted}}` for theme tokens, `<sc-if>` for
the variants (Mixicano's same-gender mark, Team Americano's bye, the ended session's Done bar).
Reading them is the point; rendering them is what the canvas URL is for.

They are also exempt from Prettier (see `.prettierignore`). They are a captured artefact, and
reformatting them would silently make this a paraphrase.

## What is here

`canvas.json` is the index: every artboard's file, size, title and page — and the five
**annotations**, which carry the reasoning behind the design and are worth reading before any of
the artboards.

| Page | Artboards |
|---|---|
| Phone (390×844) | `Landing`, `Wizard`, `Main` (the Round tab), `Score`, `Standings`, `Players`, `PlayersTeam`, `RosterPreview` |
| Desktop (1440×900) | `DesktopLanding`, `DesktopSession` |
| Dark | `RoundDark`, `StandingsDark` |
| Foundations | `Palette` — every colour token, light and dark; `TypeScale` |
| Directions | `DirectionA`, `DirectionB`, `DirectionC` |
| Modern | `ModernRound`, `ModernScore`, `ModernStandings`, `ModernPlayers`, `ModernRoundDark`, `ModernDesktop` |

The **Modern** page is a later pass: the Phone set re-dressed in a more current idiom, adding no
screen and no copy. The `modern-note` annotation lists the five moves. **Modern is the idiom the app
is built in** — ADR-0035 chose it over direction A's component treatment, keeping ADR-0021's palette,
faces and type scale untouched, because the five moves are about how a surface is held rather than
what colour it is.

`Main.dc.html` is the Round tab, named for its position as the canvas's entry artboard rather than
for anything in the app.

Three visual directions were drawn and **A — Court at dusk** was taken forward; every other
artboard uses its palette, and every artboard outside the Modern page uses its component treatment
too. B and C are kept as the record of what was considered — the `directions-note` annotation says
what each one costs.

## What this proposes

`Palette.dc.html` holds the whole colour proposal. In outline: a teal brand (`#0e6f87`, lightening
to `#3fa8c4` in dark) on a cool blue-grey neutral ramp, plus **eight new tokens** —
`podium-gold`, `podium-silver`, `podium-bronze`, `warning`, `warning-surface`, `danger`,
`shadow-raised`, `shadow-sheet`. The body face is **Verdana**, chosen because it is installed
everywhere and drawn for small sizes, so no webfont carries the text the organizer has to read at
arm's length; only **Space Grotesk** loads, and only titles and numbers depend on it.

Adding those tokens keeps ADR-0018's rule intact: a component still names a utility
(`bg-podium-gold`, `shadow-sheet`) and never a colour. Implementing the palette is editing the top
half of `projects/padel-app/src/styles.css` and nothing else.

## Which pages are live, and which are a record

Every board is kept, but they no longer all describe the app. ADR-0035 split the canvas by page,
because the Modern idiom replaced direction A's while the palette underneath it did not change.

| Page | Standing |
|---|---|
| **Foundations** (`Palette`, `TypeScale`) | **Live.** The token record. It carries ADR-0021's eight tokens and the five ADR-0035 added, and if a value changes in `styles.css` it changes here too — a second copy of a palette out of step is worse than none. |
| **Modern** | **Live.** The idiom the app is built in. |
| **Phone**, **Desktop**, **Dark** | **Historical.** Direction A as it was built and shipped, before ADR-0035 re-dressed it. Kept as the record of what the app looked like, not as a description of what it looks like. |
| **Directions** (`A`, `B`, `C`) | **The record of what was considered.** Always was. |

Two consequences worth knowing before reading a board:

- **The desktop widths here are not the app's.** `DesktopSession` and `ModernDesktop` draw a rail
  and an aside at 232 and 366 pixels. ADR-0022 §1 fixes them at **248 and 340**, and reasons about
  those numbers to place the 1280 breakpoint — the boards' widths are drawing slack.
  ADR-0035 §6 kept the ADR's.
- **The `modern-note` undercounts its own tokens, and so did the ADR.** The note names two the set
  lacks. Extracting every value from the six Modern boards, ADR-0035 §3 counted four: one gradient
  and three shadows, one of which was drawn at two slightly different values and none of which was
  drawn in dark; §4 records the one value in the whole change with no drawing behind it. Building
  it found a fifth, which is the ink on the header's gradient — the boards draw it white in light
  and the reading ink in dark, and nothing already in the palette is both. ADR-0035's consequences
  record it.

## What the annotations still settle

The five annotations in `canvas.json` carry the reasoning, and they remain the primary source for
*why* rather than *what*. Two of them flag questions that have since been answered, so read them
with the answers in hand:

- The `desktop-note` flags its own divergence from ADR-0016's "three tabs, bottom nav". That was
  resolved by **ADR-0022**, which amended ADR-0016 §1: at the desk tier standings stop being a
  destination and become a permanent aside.
- The `foundations-note` and the `directions-note` call the identity a proposal rather than a
  decision, pending the real padel night of issue #25. That was resolved by **ADR-0021**, which
  chose direction A and struck decision #16's open question. Issue #25 is closed. ADR-0021 §6
  still stands, though, and ADR-0035 widened it: the values are a starting position, and so is the
  idiom.
