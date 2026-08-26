# 6. Any roster of four or more, with fairness as a cost function

- **Status:** Accepted
- **Date:** 2026-08-26
- **Supersedes:** decision 1 of [ADR-0004](0004-exact-fit-americano-first.md)
- **Restores:** decision #4 in [docs/DECISIONS.md](../DECISIONS.md)

## Context

ADR-0004 staged decision #4 — "any roster >= 4, bench rotates evenly" — behind an exact-fit
restriction, and named the ticket that would lift it. This is that ticket (#5).

Lifting it is not a matter of allowing a shorter roster through the door. Once people sit out, the
schedule is an over-constrained system: eleven players on two courts have 55 possible partnerships
and consume four of them a round, while only eight of the eleven are on court to be paired at all.
Writing every fairness rule as a constraint and asking a solver to satisfy them all produces a
generator that refuses to schedule the exact evening it exists for.

## Decision

**1. `createSession` accepts any roster of four or more.** The exact-fit check is gone from the
shared session-shape rules. Below four there is no match to schedule; above it, whoever does not
fit onto a court is benched.

**2. Courts booked are an upper bound, not a promise.** `courtsInPlay(session)` is
`min(courtCount, floor(roster / 4))`, and both the scheduler and `assertSessionValid` ask it. Six
players on two courts play on one court and bench two, rather than being rejected — an organizer
books courts before they know who turns up.

**3. The hard rules are structural; fairness is a cost.** They are split deliberately:

| Rule | How it is held |
|---|---|
| No double-booking, four distinct players a match | Construction — a player is on the bench or in exactly one pair |
| Bench counts within one, at every prefix | The bench always falls on players who have sat out fewest. Benching only minimum-count players keeps the maximum at most one above the minimum, so the spread is a property of the rule rather than of a search |
| Partner repeats | A cost the search minimises, weighted so a repeat that would leave someone without a partner they have never had is chosen only when nothing else exists |
| Opponent repeats | A smaller cost, settled once the pairs are known |

**4. The slack between those two is what buys partner variety.** When more players are tied on the
bench count than there are bench places, *which* of them sits out is free. The planner enumerates
those bench sets in a fixed order and takes the first that admits a repeat-free round. Bench
fairness is never traded away for partner variety — it is what pays for it.

**5. The pairing search is most-constrained-first.** The player with fewest never-partnered players
left is paired first, cheapest partner first. This is the difference between a generator that
schedules eleven players cleanly for eleven rounds and one that paints itself into a corner by
round five; it was measured, not assumed.

**6. The scheduler reads history rather than the round number.** The circle-method rotation of
ADR-0004 is gone. Rounds the engine did not generate — a session mid-edit, a session back from
storage — now count exactly as much as ones it did, which is the limitation ADR-0004 deferred to
this ticket.

## Consequences

- Fairness holds for every roster of 4 to 16 against 1 to 4 courts, checked at every round prefix,
  and that grid is walked in full by `bench-rotation.spec.ts`.
- The partner-variety invariant is not indefinitely satisfiable, and the engine does not pretend
  otherwise. Most configurations stay clean well past twenty rounds; the tightest — twelve players
  on a single court, where eight of twelve sit out and the bench rule leaves no choice at all —
  starts repeating a partnership at round twelve. That is beyond decision #6's "complete rotation
  capped ~12", so the tests hold the whole grid to eleven rounds. A session that runs past its
  configuration's limit still schedules; `assertSessionValid` is what will say so.
- The round planner spends a bounded number of search steps and then takes the best plan it has
  found. The bound is a step count rather than a time limit, so a schedule cannot depend on how
  fast the machine is (decision #6).
- Opponent variety is the weakest of the three. On a heavily benched roster a player can face the
  same opponent four times in eight matches, because the pairing search does not look at opponents
  at all — only the court assignment does, and only within one round. Nothing in `DECISIONS.md`
  requires better, but it is the obvious next thing to improve if a printed schedule feels wrong.
- Reading `courtCount` as an upper bound costs the referee something: because the number of matches
  a round should hold is now derived from the roster, a round that genuinely under-fills the courts
  it could staff is indistinguishable from one that legitimately benches. That is the price of
  scheduling six players on two courts at all rather than rejecting them.
- `assertSessionValid` no longer enforces exact fit, as ADR-0004 said it would stop doing once
  bench rotation arrived.
