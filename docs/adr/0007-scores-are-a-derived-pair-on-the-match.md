# 7. A score is a derived pair on the match, and "played" is read from it

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #3, #5 and #17 in [docs/DECISIONS.md](../DECISIONS.md)

## Context

Decision #3 fixes a point total per match and says the organizer enters one side's score while the
other is derived. That settles the input. It does not settle two things this ticket (#6) had to
answer:

- **What gets stored** — the one number entered, or both?
- **What "played" means** now that a round can be generated but not yet finished. Until this
  ticket, generated and played were the same thing, and the model said so.

The second question is the sharper one. A session is scored round by round in whatever order the
courts finish, and it is tempting to give a round a status — `pending`, `in progress`, `complete` —
and advance it as results come in. That status would then be a second source of truth about
something the scores already say, and the two would drift the first time a correction is entered.

## Decision

**1. Both numbers are stored, as `Match.score: { sideA, sideB }`.** `recordScore` derives the pair
from the one entered number and the session target. Everything downstream — standings, the
printout, a spectator view — wants the pair, and deriving it once on the way in means the two
halves cannot disagree. An invalid scoreline is unconstructible rather than validated against.

**2. A score is addressed by match id and is entered in any order.** There is no notion of a
current round anywhere in the engine, and `recordScore` neither reads nor advances one. The court
that finished five minutes ago is scored while the slow court beside it is still playing.

**3. Re-recording replaces the score outright.** Nothing merges, accumulates or is applied twice,
and re-entering against the other side corrects a result typed into the wrong column. Corrections
are the ordinary path, not an exceptional one: scores get typed wrong at the side of a court, and a
typo in round two must not poison round nine. This is the engine-level counterpart of decision #17
— standings are `computed()`, never stored, so a correction recomputes for free.

**4. "Played" is derived, never stored.** An unscored match is a court that has not finished; a
played round is one whose matches all carry scores. No status field, no state machine. The model's
`Round` doc now says **ungenerated** where it used to say unplayed, and the referee's message for a
round scheduled after an empty one says the same — with scores in the model, "unplayed round" would
otherwise mean two different things. "Unplayed partner" is untouched: that sense is unambiguous.

**5. The rules about what a score may be live in one module** (`score-rules.ts`), asked by both
`recordScore` and `assertSessionValid`, so a number the engine refuses to record is described in
exactly the same words as one that has drifted into a session loaded from storage. This is the same
split `session-shape.ts` already uses for structure.

## Consequences

- `assertSessionValid` gains "every recorded score pair sums to the target" from the invariant list
  in `DECISIONS.md`. Unlike the fairness checks it is not a prefix property — a score is right or
  wrong on its own — so it walks every match once rather than riding the prefix walk.
- Copying got a shared home. `recordScore` and `generateRemaining` both have to copy a session all
  the way down before freezing it, and a match's score is a nested object that is easy to miss, so
  `session-copy.ts` now owns that and both call it.
- `recordScore` refuses an ambiguous entry rather than guessing. Match ids are unique in anything
  the engine builds, but a session loaded from storage might not be, and silently scoring two
  courts from one entered number is a worse answer than an error naming the id.
- Regeneration already preserves scores for free: `generateRemaining` carries generated rounds
  through untouched, which is decision #5's "played rounds frozen" holding without extra code.
- Nothing yet reads scores. Standings are the next ticket; `formatSchedule` still prints fixtures
  only, and showing results there is a change that ADR-0005 leaves free to make at any time.
- The engine does not know when an evening is over. "Finish session" (decision #8) will need a
  session-level status, and that is a real state transition rather than a cache of what the scores
  already say — point 4 above does not argue against it.
