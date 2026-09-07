# 23. The standings rank on total points, and the bench is paid a credit

- **Status:** Accepted
- **Date:** 2026-09-07
- **Relates to:** decisions #3, #4, #8 and #2c in [docs/DECISIONS.md](../DECISIONS.md),
  [ADR-0011](0011-team-americano-is-the-same-engine-one-level-up.md) and
  [ADR-0020](0020-bench-fairness-in-team-americano-is-asked-of-the-team-and-only-the-team.md)
- **Supersedes:** the ranking clause of decision #4 ("Standings rank by **points per match
  played**") and the first tier of decision #8 ("pts/match ->")

## Context

Decision #4 ranks on points per match played, and the reason is the bench. A roster that does not
divide into courts leaves somebody sitting out every round; they score nothing that round; ranking
on totals would charge them for a seat the scheduler assigned. Dividing by matches played makes
the bench cost nothing, which is what makes it possible to seat any roster at all.

It works, and it produces a table nobody reads. Two things are wrong with it.

**The rate is not the number the evening is played in.** Four people walk off a court having
scored 17, and 17 is what they say. The table answers with `15.8`, a figure with no event behind
it — nobody scored it, nobody watched it happen, and two evenings of the same padel produce
different ones because the divisor moved. The organizer is holding the phone at the side of a
court, reading a column of numbers that are not the numbers on the courts.

**And the rate hides the bench rather than compensating it.** "Sitting out costs you nothing" is
true of a *position* and false of everything the position was supposed to summarise. A player who
sat out two of six rounds has a rate as good as anyone's and a total that says they lost the
evening. Both are on the same screen. The table's own arithmetic contradicts what the table is
for.

There is a third option, and it is the one social padel actually uses: **give the bench the
points**. A benched player is not asked to skip a round for free; they are credited with the round
they were not allowed to play.

## Decision

**1. The ranking figure is total points.** Every leaderboard in the engine — players in Americano
and Mixicano, teams in Team Americano — ranks on the points a competitor has, and nothing is
divided by anything.

**2. A benched competitor is credited half the target score for the round they sat out.** A
match's two scores always sum to the target (decision #3), so half of it is exactly a drawn match:
the one result that is neither a reward nor a penalty. The credit is exact. On a target of 21 it
is `10.5`, and it is shown as `10.5` rather than rounded, because a credit rounded to 10 or 11 is
no longer the thing this decision is about.

**3. The bench is paid; absence is not.** A competitor earns a credit for a round they were
*available for and not seated in*. Not the player who had not arrived yet, not the player who went
home, not an orphaned team or the stranded player inside it — a team marked **needs partner** is
off court because it is broken, not because the rotation put it there, and paying it would let a
broken team win the evening.

**4. A credit lands only once its round is complete:** the round has at least one match, and every
match in it has a score. Rounds are generated ahead of play (decision #6), so a round slot exists
long before anybody stands on a court; crediting on generation would put a benched player at the
top of a table for an evening nobody has started.

**5. A bench round is not a match.** It does not increment matches played, and it is neither a win
nor a tie nor a loss. The record is what happened on court; the credit is what happened instead of
court. Keeping them separate is what makes both readable.

**6. The tie-break ladder is total points, then head-to-head, then joint (decision #8, less its
first tier).** Points per match is not demoted to a tie-break: as one, it would read "equal totals,
fewer matches wins", handing the tie to whoever was benched most — the precise bias the credit
exists to remove. Head-to-head keeps its own points-per-meeting rate, which is a rate for a reason
local to that tier: members of a tied group need not have met the same number of times.

**7. `pointsPerMatch` is deleted, not deprecated.** It ranks nothing after §1, and after §2 it is
false: the numerator carries credits earned off court and the denominator counts only matches on
it, so a benched player's "rate" is inflated by the very rounds it claims to divide out. A derived
field that lies the moment it is read is worse than an absent one.

## Consequences

- **The table can be checked by hand, and the screen has to let it be.** A total is the sum of
  scores plus credits, and a reader who cannot see the credits sees a number that does not add up.
  This is why the expanded row carries `Benched` beside the record and the matches played: the
  count is the missing term in the arithmetic, and without it `W-T-L 3-0-1` beside `63.5` looks
  like a bug.
- **Points are no longer integers.** An odd target makes every credit a half, and totals carry it.
  Nothing in the model was relying on whole numbers, but formatting was — the app now prints a
  half where there is one and drops the decimal where there is not.
- **Fairness moves from the table to the scheduler.** Under a rate, an uneven bench spread was
  merely untidy; under a credit it is a real advantage or a real handicap, because a credit is
  worth exactly a draw and a court is worth anywhere from nothing to the whole target. Prefix
  fairness (decision #6) and the bench-spread checks in the referee were already the rules that
  keep that even. They now have something to protect.
- **Team Americano inherits all of it and states none of it.** The ladder, the credit and the
  record live in `ranking.ts` and are handed competitors (ADR-0011); the bye is the bench one
  level up (decision #2c, ADR-0020). The only thing the team level says for itself is which teams
  were available, which is the same sentence the player level says about players.
