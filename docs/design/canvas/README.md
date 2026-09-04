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

`Main.dc.html` is the Round tab, named for its position as the canvas's entry artboard rather than
for anything in the app.

Three visual directions were drawn and **A — Court at dusk** was taken forward; every other
artboard is built in it. B and C are kept because the choice between them is still reversible —
the `directions-note` annotation says what each one costs.

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

## Two decisions this does not settle

Both are called out by the canvas's own annotations. Neither should be resolved inside an
implementation ticket.

1. **The desktop boards diverge from ADR-0016.** `DesktopSession` turns the three tabs into a left
   rail and puts standings permanently alongside the round. ADR-0016 words the navigation as
   "three tabs, bottom nav". That is an amendment to the ADR, not a stylesheet change.
2. **The identity is a proposal, not a decision.** ADR-0018 defers the visual identity until after
   a real padel night; issue #25 is still open, so that night has not happened. Every value here is
   a starting position to be tested at a court. `docs/DECISIONS.md` § Open questions still reads
   *"Visual identity: colours, typography, dark mode — undecided"*, and it stays open until it is
   decided rather than merely drawn.
