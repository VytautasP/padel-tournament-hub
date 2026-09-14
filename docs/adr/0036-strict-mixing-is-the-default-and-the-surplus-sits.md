# 36. Strict mixing is the default, and the surplus sits

- **Status:** Accepted
- **Date:** 2026-09-13
- **Supersedes:** decision #7 in [docs/DECISIONS.md](../DECISIONS.md) as the default
- **Amends:** [ADR-0010](0010-mixicano-is-one-cost-term-and-a-derived-mark.md) §3 and §6, and the
  bench-spread clause of [ADR-0006](0006-fairness-is-a-cost-function.md) §3

## Context

Decision #7 settled unequal Mixicano pools with **hybrid fill**: courts take mixed pairs first and
the surplus plays same-gender, marked and rotated. ADR-0010 built the machinery — one cost term
priced above everything else, minimised by the search and held to its floor by the referee.

It works, and it is not what people mean by Mixicano. The format's one rule is that you play with
the other gender; an evening that quietly pairs two women because the arithmetic said so has
broken the rule it was chosen for, however well it marks the pair afterwards. The mark explains the
compromise; it does not make it the thing the group turned up for.

So the default inverts. Same-gender pairing stops being a compromise the engine makes on the
organizer's behalf and becomes a choice the organizer makes explicitly, in advance, knowing the
price.

## Decision

**1. A Mixicano is strict unless the organizer says otherwise.** Under **strict mixing** no
same-gender pair is ever formed. `SAME_GENDER_PAIR` stops being the top term of the cost function
and becomes a filter on the pairing search: a same-gender partnership is not expensive, it is not
available. **Hybrid fill** survives untouched, behind a flag, with ADR-0010's minimise-and-rotate
machinery intact — so the two rules are one branch rather than two schedulers, the same way
Mixicano and Americano already are.

**2. The courts shrink, and this is the price being paid.** A court needs two women and two men,
so for a strict session `courtsInPlay` is `min(courtCount, floor(min(women, men) / 2))`. Seven
women and three men on two courts fill one court: four play and six sit, where hybrid fill would
have seated eight. That is a real cost and it is accepted deliberately — the alternative, falling
back to hybrid fill when strictness would empty a court, is worse than either rule, because it
un-does the organizer's choice at precisely the moment the choice mattered. The organizer is told
before they commit: the create wizard shows the number of courts this roster will actually fill.

**3. Bench fairness is asked per gender.** The one structural rule in this engine — bench counts
within one at every prefix (ADR-0006 §3) — cannot hold across the whole roster under strict mixing:
three men among seven women are on court every round by arithmetic, and the spread reaches five by
round five. So for a strict session `bench-sets.ts` runs **one queue per gender**, and the referee
checks the spread within each. Americano, hybrid Mixicano and Team Americano keep the single queue
and the single check, unchanged.

This is ADR-0020's move made again: *the bench question is asked of the population that could
answer it*. There the population was the team; here it is the gender, because a woman was never a
candidate for the seat a man is taking.

**4. The minority does not get to rest.** A strict evening will not idle a court to bench a
minority player, even though playing every round of a long evening is genuinely tiring. Trading a
court that four people could be playing on for one player's rest is the worse deal for the room,
and the organizer who disagrees has the opt-in. What the app owes them is the truth about it up
front, which is §2's wizard preview.

**5. Two of each gender, or there is no evening.** Below that `floor(min(women, men) / 2)` is zero
and a round has no matches in it at all, which is not a session. Creation refuses it. Mid-session a
departure can reach the same place, and the engine still does not fall back: `changeRoster` already
previews a schedule before it commits (ADR-0015), and that preview is where "0 courts — nobody can
play" is said. The organizer keeps the player, or ends this session and starts another.

**6. The choice is fixed at creation, like the mode.** Switching mid-evening is technically
available — `generateRemaining` rebuilds unplayed rounds from history whenever the roster moves —
and it is refused anyway, because the referee judges *every prefix*. A session switched from hybrid
to strict at round six would be a document whose first five rounds are illegal under its own flag:
a referee that throws on a session nobody damaged. Recording the rule per round would fix that and
costs a schema field plus a rule lookup at three call sites, to serve the case where somebody went
home. The escape that already exists — end the evening, start another — is enough.

**7. An absent flag means hybrid fill.** `strictMixing?: boolean`, and a session that does not
carry it was scheduled under the rule that existed when it was written. Anything else rewrites the
past: every stored Mixicano would re-validate wrong, and an organizer tapping `+ add round` on a
live hybrid evening would get the remaining rounds rescheduled under a rule its played rounds
violate. The wizard writes the flag explicitly on every new session, so "absent" only ever means
"older than this decision" — the same reading `joinedAtRound` and `formerPlayerIds` already have.

**8. The star is replaced by a sentence about the courts.** `sameGenderSides` returns nothing in a
strict session, so the schedule's mark and its legend simply do not appear. The organizer's problem
is not gone, though — it has changed from "why am I paired with another woman?" to "why am I
sitting out again while the men play every round?". The printout and the Round tab answer it once
per round, at the only place the evening visibly differs from a normal one: *Court 2 unused —
strict mixing.* No test asserts on that text (ADR-0005).

## Consequences

- **`bench-sets.ts` is handed a partition rather than a list**, and its guarantee — that it always
  yields at least one bench set — has to hold per gender rather than once. It is the only
  structural rule in the engine and every mode's fairness runs through it, so the per-gender queue
  stays behind the strict flag: a defect there cannot reach an Americano evening.
- **The referee gains two clauses and keeps the old ones.** A strict session must contain zero
  same-gender pairs, and its bench spread is checked within each gender. ADR-0010's
  minimised-and-rotated check still runs, on hybrid sessions, where it is still the right question.
- **A strict Mixicano can seat fewer people than the room.** Six on a bench of a ten-player evening
  is a normal strict round, and every one of those six is paid a bench credit (ADR-0023), so the
  standings absorb it — but the evening is shorter for them, and no credit fixes that. It is the
  format's own arithmetic, now visible instead of hidden behind a starred pair.
- **Decision #7 is not deleted.** Hybrid fill is still a decision this project made and still the
  behaviour of a flag, so ADR-0010 stays accepted rather than superseded. What changed is which of
  the two an organizer gets without asking.
