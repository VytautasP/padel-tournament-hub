# 15. A roster change previews its regenerated schedule before it commits

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #5 and #6 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0006](0006-fairness-is-a-cost-function.md)

## Context

Decision #5 makes the roster mutable mid-session: played rounds freeze, unplayed rounds are
regenerated from history. The engine does this cleanly — completed rounds come back
byte-identical, and every fairness rule holds at every prefix.

What it cannot do is make the change invisible to the people standing on the court. Adding one
player to an eleven-player evening rewrites every unplayed round: the partners someone was told
about two minutes ago are gone, and so is the round they were looking forward to sitting out. The
schedule is fair before and after, and completely different.

Three responses were considered. Say nothing, and the organizer is contradicted by their own app
in front of eight people. Show a toast — "rounds 5–9 regenerated" — and they at least know to
re-announce. Show the regenerated schedule and require confirmation, and they can read the new
evening before anyone else does.

The argument against the third is that the roster change is a fact about the world: Ana has gone
home whether or not the organizer likes round 6. A confirmation implies a choice that does not
exist.

## Decision

**1. Any roster change opens a preview of the regenerated schedule before committing.** Adding a
player, marking one as gone home, and repairing an orphaned team all go through it.

**2. The preview shows the whole regenerated remainder, scrollable — not a diff.** A diff of a
rotation is nearly every line, which is noise wearing the costume of signal. Rounds from the
current one onward, rendered as they will be.

**3. The dismissal is worded "Don't change the roster", not "Cancel".** This is what makes the
preview honest about the objection above. It is not a chance to reject the schedule and keep the
roster change — that state does not exist — it is a chance to see the consequence before causing
it, and to back out of the cause. An organizer who dismisses it has decided not to record that Ana
left, which is a real decision with a real consequence: she stays on the schedule.

**4. There is no reroll.** The preview offers no "generate a different one". The scheduler is
deterministic (ADR-0006), so a second run on the same inputs returns the same evening; making it
return a different one would mean seeding it, and a schedule the organizer shopped for is a
fairness claim nobody can check.

## Consequences

- Every roster mutation is a two-step interaction. On the Players tab, "went home" therefore does
  not need a separate confirmation dialog — the preview is the confirmation, and it states the
  consequence in the strongest available form: the actual schedule.
- The preview has to render an ungenerated remainder, which means the app calls
  `generateRemaining` against a candidate session before it stores one. The engine is pure and
  returns a new session, so this is free — but it does mean the app holds two sessions in hand for
  the length of the interaction, and must not write the candidate anywhere until confirmed.
- If mid-session roster changes turn out to be frequent enough that the preview becomes a tax, the
  fallback is the toast, not silence.
