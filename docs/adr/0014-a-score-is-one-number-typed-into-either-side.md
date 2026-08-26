# 14. A score is one number, typed into either side

- **Status:** Accepted
- **Date:** 2026-08-26
- **Supersedes:** the consequence column of decision #3 in
  [docs/DECISIONS.md](../DECISIONS.md) — *"One slider, not two fields"*
- **Relates to:** decision #3, and [ADR-0007](0007-scores-are-a-derived-pair-on-the-match.md)

## Context

Decision #3 fixes a point total per match and has the organizer enter one side's points, with the
other derived — so an invalid scoreline cannot be constructed rather than merely rejected. Its
consequence column then names a control: *"One slider, not two fields."*

The decision and the control are not the same claim. The decision is about how many numbers cross
the boundary into the engine, and `recordScore` enforces it: a `ScoreEntry` carries one side and
one number, and the pair is derived on the way in. The control is about what a thumb does at the
side of a court, and a slider turns out to be the wrong answer for two reasons that were not
visible when the decision was written.

A slider cannot be precise. Landing exactly on 17 out of 24 on a phone-width track is a fiddle,
and the number that gets recorded is the number the standings run on.

And the reading is not one-sided. Players report results in whichever direction they experienced
them — "we got 17" as often as "we only lost 7" — so a control that accepts side A's points and
nothing else asks the organizer to do arithmetic at exactly the moment they are being talked at by
four people.

## Decision

**1. Score entry is a bottom sheet, opened by tapping a court.** One match per sheet. Courts
finish minutes apart (ADR-0007 exists because of that), so a control that stepped through a whole
round would mostly be stepping past matches with nothing to enter yet.

**2. Two text inputs, either one editable, the other derived live.** Typing `17` into side A puts
`7` into side B, and typing `7` into side B puts `17` into side A. This is still one number in —
the app derives the pair before it reaches `recordScore`, which derives it again from whichever
side was typed. Two *independently typed* fields would be the thing decision #3 rules out, because
they make a non-summing scoreline constructible; two views of one number are not.

**3. Digits only, bounded by the session's target.** `inputmode="numeric"` for the keypad, plus
filtering on input, plus `0 <= points <= session.targetScore`. The bound is the session's target
and never the literal 24 — 24 is decision #3's default, not its rule, and a validator hardcoded to
it would silently break every session created with a different target.

**4. An out-of-range number is an inline error, never a clamp.** Typing `27` shows the error and
refuses to commit. Silently rewriting it to `24` produces a wrong score that looks deliberate, and
the organizer has no reason to look again.

**5. Re-tapping a scored court reopens the sheet at its current value.** Correcting a typo is the
ordinary path (ADR-0007), so it uses the ordinary control and is reached the ordinary way.

## Consequences

- Decision #3's *decision* column stands unchanged and is what the engine enforces; only its
  consequence column is superseded. Nothing in `recordScore` changes.
- The sheet needs the target score in its header, because "17" means nothing without "of 24" —
  and a session played to 32 must not look like a mistake.
- A slider may still be the right control for a *target score* in the wizard, where approximate is
  fine and the range is small. This ADR is about match scores only.
