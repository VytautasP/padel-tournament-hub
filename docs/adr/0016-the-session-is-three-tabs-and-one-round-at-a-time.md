# 16. The session is three tabs, and one round at a time

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #1, #4, #6, #8 and #16 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0010](0010-mixicano-is-one-cost-term-and-a-derived-mark.md)

## Context

A running session is used in one posture: an organizer standing at the side of a court, phone in
one hand, being asked things. They read the current round, they type a score, and they are asked
who is winning and who is sitting out. Everything else the app can do is rare by comparison.

Two navigation shapes fit that. A linear stack makes the round the home screen and pushes
standings on top of it — fewer permanent pixels, but checking the table means leaving the session
and coming back. Tabs spend a bar of screen permanently to make all three surfaces one tap apart.

Within the round surface there was a second choice: show the whole schedule scrolled to the
current round, or one round at a time with paging. The whole schedule answers "who am I with in
round 6?" without navigating; one round keeps the screen unambiguous about where the evening
actually is.

## Decision

**1. Three tabs — Round, Standings, Players — with Round as the default.** State and scroll
position survive switching. Standings are consulted constantly and mid-round, not only at the end;
that is the entire reason they are derived on every call (decision #17), and a tab is what makes
them free to consult.

**2. The Round tab shows one round at a time, paged with prev/next.** The header reads
`Round 4 of 9`, and a control returns to the **current round** — the lowest-numbered round with an
unscored match, derived and never stored. Paging is free across every generated round, so the
question the whole-schedule view answered still has an answer, two taps away.

**3. A completed round does not auto-advance.** When the last court in the round is scored, the
screen stays put and offers `Round 4 →`. The moment right after a score lands is exactly when a
typo gets spotted, and pulling the screen out from under the organizer then is the one thing this
surface must not do.

**4. `+ add round` lives past the last round.** Page beyond round 9 and find the Add round card
there. Decision #6 gives the organizer this action during play; putting it where the evening
visibly runs out puts it where the question arises, and keeps a schedule-lengthening button off
the screen in use all night.

**5. The round screen carries the bench and the same-gender mark, and nothing else.** A bench strip
below the courts — `Sitting out: Cara, Dov` — because in an eleven-player session on two courts the
courts name eight of eleven people, and the other three either ask or wander on. A subtle marker on
a same-gender side in Mixicano, because ADR-0010 marks such pairs precisely so the organizer can
explain a pairing rather than appear to have invented one. Team Americano gets **no** special
labelling: a side that is always the same two people reads as a team without being told, and team
identity is what the standings are for.

**6. End session sits in the Standings tab footer.** You end an evening when the table is final,
so the action belongs where you are looking when you decide that. The podium is a block above that
same table, not a separate screen — the top three *are* the standings, and a separate screen would
render the same rows twice.

## Consequences

- No back button exists inside a session. Leaving is Landing, ending, or discarding.
- "Current round" is app-derived state with no engine counterpart, and must be recomputed from
  scores rather than remembered — a corrected score can move it backwards.
- The bench strip is absent, not empty, in a session where nobody sits out. An exact-fit roster
  should not be told every round that nobody is benched.
- A per-player view — tap a name, see their whole evening — was considered and deliberately left
  out of step 2. It is a good idea with no evidence behind it yet; the real padel night is what
  produces that evidence.
