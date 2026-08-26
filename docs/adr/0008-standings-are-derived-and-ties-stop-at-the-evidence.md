# 8. Standings are derived, and a tie stops where the evidence does

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #4, #8 and #17 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0007](0007-scores-are-a-derived-pair-on-the-match.md)

## Context

Decision #4 ranks by points per match played, decision #8 lists the tie-break order —
points per match, total points, head-to-head, then a declared joint position — and decision #17
says standings are `computed()` rather than stored. That settles the shape of the answer. Ticket
#7 had to settle three things it does not:

- **What "head-to-head" means for more than two players.** Head-to-head is a pairwise idea, and
  three players tied can beat each other in a circle. A rule that compares pairs is not an
  ordering, so it cannot be what a table is built from.
- **What head-to-head means when the tied players never met.** An Americano roster of eleven does
  not produce a complete round-robin: two players can finish level having never been on opposite
  sides of a court.
- **What a joint position does to the places below it.**

## Decision

**1. `computeStandings(session)` reads the rounds and returns a ranked line per roster entry.**
Nothing is stored on the session, there is no cache and no invalidation step; a corrected score is
reflected by the next call, which is the engine-level half of decision #17. A test asserts the
session's own keys to keep it that way.

**2. Points per match, with unplayed matches counting for nothing.** A match without a score is a
court that has not finished (ADR-0007), so it contributes neither points nor a match played. A
player who has not been on court at all has a rate of 0 and a line of zeroes rather than no line.
Rates are compared as fractions — `a.points * b.matches` against `b.points * a.matches` — so two
whole tallies are never separated by a rounding error.

**3. Head-to-head is a mini-league among the tied group, not a pairwise comparison.** Each member's
head-to-head record is their points per match across the matches in which they faced *another
member of the group*. That is a single number per player, so it orders a group of any size and the
circle problem cannot arise. Members of a group need not have met the same number of times, which
is why this tier is a rate too, for the same reason the top-level ranking is.

**4. Head-to-head only speaks where every member of the group has a record.** If any tied player
never faced another member, the tier declines to separate anyone in that group rather than ranking
a record against no record — half a tier is not a tier, and a group where two members met but a
third met nobody has no ordering to offer, only a partial one. The tie then stands as joint. An
Americano roster too big for a complete round-robin makes this the ordinary case rather than an
exotic one.

**5. A surviving tie is a joint position, and it uses up the places it occupies.** Two players tied
for second are both `position: 2`, both `joint: true`, and the next player is fourth. `joint` is on
the line rather than left for the reader to infer from repeated positions, because the list still
has to come out in *some* order: tied players are listed in roster order, and `joint` is what says
that order carries no meaning.

## Consequences

- The engine's public API gains `computeStandings` and the `Standing` type. `Standing` lives with
  the operation rather than in `model.ts`: it is a derived view, not part of the session document,
  and putting it in the model would invite storing it.
- Every tier has a test that isolates it, which needs sessions the scheduler would never produce —
  two specific players facing each other with a chosen score. `test-support/standings-fixtures.ts`
  builds rounds outright for that, alongside the config-level fixtures.
- The tie-break tiers only ever split a group further. A group that survives all three is a genuine
  joint position rather than a tier that was skipped, and that is what makes point 4 safe.
- A player who has been on the bench all evening finishes joint with one who played and was
  whitewashed: both have no points, and points per match is 0 for both. That follows from decision
  #4 rather than working around it — ranking the benched player below would be the bench costing
  position, and ranking them above would be it gaining one.
- Head-to-head counts a player's own points in a meeting, not their partner's or their side's
  margin. Points scored is the currency everywhere else in the engine, and margin would be a fourth
  tier that decision #8 does not list.
- Standings are not printed. `formatSchedule` still renders fixtures only; showing a table is a
  change ADR-0005 leaves free to make at any time.
- "Finish session" and the podium (decision #8) are still absent: the engine has no notion of an
  evening being over, and standings of a half-played session are computed the same way as a
  finished one. That remains a real state transition rather than a cache, as ADR-0007 noted.
