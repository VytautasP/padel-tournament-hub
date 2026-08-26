# 17. Creation is a four-step wizard, and courts are named by the organizer

- **Status:** Accepted
- **Date:** 2026-08-26
- **Closes:** the open question *"court naming/numbering convention undecided"* in
  [docs/DECISIONS.md](../DECISIONS.md)
- **Relates to:** decisions #2a, #3, #4, #6 and #7

## Context

`createSession` needs a mode, a roster, court count, target score, round count, and — for Team
Americano — the pairing. On a desktop that is one form. On a phone it is not: typing eleven names
is a repeated interaction that wants a whole screen and a keyboard that never dismisses, and
decision #2a already mandates pairing as a screen of its own.

Court identity was left open by the original design interview. The engine stores a 1-based
`courtNumber` and the printout renders `Court 1`, `Court 2`. That is enough to tell four people
where to walk in a two-court session, but clubs do not renumber their courts for a Tuesday
Americano — the booking is for courts 7 and 8, and a screen that says "Court 1" sends people to
the wrong end of the building.

## Decision

**1. Four steps, one of them conditional: Mode → Players → Pairing → Review & create.** Pairing
appears only for Team Americano. Back is non-destructive throughout, and nothing is written to
storage until the last step.

**2. There is no separate settings step.** Court count, target score and round count live on
**Review**, pre-filled — target 24 (decision #3), one court, and a round count equal to a complete
rotation capped at 12 (decision #6). Nobody should be walked through a settings screen to accept
three numbers they were always going to accept, and putting them on Review means they are visible
at the moment of commitment rather than three screens back.

**3. Players is one sticky input, add-and-continue.** Type a name, commit it, the field clears and
keeps focus. Tap a name to edit, × to remove. It is the fastest way to enter a list on a phone and
it survives the interruption every roster gets — *"wait, is Dov coming?"*

**4. The steps gate, and say why inline.** Four players minimum (decision #4); an even roster for
Team Americano (decision #2a); in Mixicano, a gender on every row. Blocking Next with the reason
stated is better than letting someone reach Review and be rejected there.

**5. Gender has no default in Mixicano.** A two-state toggle per row, unset until touched, and an
unset row blocks Next. A default would be guessed, and a guessed gender does not fail loudly — it
silently produces a wrong pairing rule that the schedule then honours all evening.

**6. Courts are named by the organizer, on Review.** One field per court, pre-filled `Court 1…N`,
appearing once the court count is set. The organizer who does not care never touches them.

- A **blank** name falls back to `Court N` rather than being rejected — an empty field is someone
  skipping the question, not making a mistake.
- **Duplicates are allowed.** If a club really has two courts people call "Centre", that is the
  club's problem and not grounds for blocking session creation.
- The name is **display only**. `courtNumber` remains the identity, in the document and in every
  engine operation; the name is a label the app renders over it.
- Names are set at creation and **not editable mid-session** in step 2. You name courts when you
  book them.

## Consequences

- The app carries a court-number-to-name mapping that the engine knows nothing about, and it has
  to live in the session document so a resumed session still says "Court 7". This is the first
  app-owned field on a document the engine otherwise owns entirely.
- Because names are display only, two courts sharing a name are still distinct everywhere it
  matters — scores, matches, validation. Only the human reading the screen has to cope, and they
  are the one who typed it.
- Mixicano cannot be created from a roster with a gender missing anywhere, which ADR-0010 already
  predicted the create screen would have to enforce. This is where it lands.
