# 4. Exact-fit Americano first, and `generateRemaining` takes the session

- **Status:** Accepted
- **Date:** 2026-08-25
- **Amends:** decisions #4 and #5 in [docs/DECISIONS.md](../DECISIONS.md)

## Context

Ticket #3 is the engine's tracer bullet: the first complete path from an organizer's configuration
to a schedule they could actually play. Two rows of the frozen design record are in its way, and
`docs/agents/domain.md` says a contradiction with that record is resolved by an ADR rather than by
editing the row.

Decision #4 says **any roster >= 4**, with the bench rotating evenly. Decision #5 names the
generator `generateRemaining(roster, courts, history)`.

## Decision

**1. The first version schedules exact-fit rosters only.** `createSession` rejects any roster that
is not `courts * 4` players — 4 on 1 court, 8 on 2, 12 on 3 — so nobody is ever benched. This does
not revoke decision #4; it stages it. Bench rotation, and with it rosters of any size >= 4, land in
the fairness ticket that follows. Until then the restriction is enforced rather than assumed, so an
organizer meets it at session creation instead of three rounds in.

The check lives in the shared session-shape rules, which means `assertSessionValid` enforces it too.
That is deliberate for now — with an exact-fit roster, "everyone plays every round" is what a valid
schedule *means* — but it is a precondition rather than one of the invariants in `DECISIONS.md`, and
it moves out of the referee when bench rotation arrives.

**2. `generateRemaining(session)` narrows #5's three arguments to one.** Roster, court count and
history are all fields of the session document (decision #13), so the generator reads them from it.
The inputs to the generator are unchanged; only their packaging is.

**3. `SessionMode` names only `'americano'`.** A mode the engine cannot schedule has no business
being nameable; the union widens as Mixicano and Team Americano are built.

## Consequences

- The engine cannot yet run the awkward rosters the build order calls out by name (11 players on 2
  courts). That case is the whole point of the next ticket, and `assertSessionValid` — which already
  checks bench spread at every prefix — is what it will be held to.
- Partners come from the circle method, which is exact-fit's reward: over a roster of n players
  every partnership is played exactly once in n-1 rounds, so partner variety is a property of the
  construction rather than something a search has to be talked into.
- Because partners are a function of the round number, a session whose played rounds came from
  somewhere other than this engine is scheduled without regard to the partnerships they used. The
  history-aware search arrives with bench rotation.
- The engine's lint config now also forbids `Math.random`, `new Date()` and `Date.now()`, and
  `npm run verify:boundary` proves those rules bite. Determinism (decision #6) is enforced
  mechanically rather than by review.
