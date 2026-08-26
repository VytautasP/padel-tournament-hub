# 9. Finishing is a status on the session, enforced in the engine

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #6 and #8 in [docs/DECISIONS.md](../DECISIONS.md)

## Context

Decision #6 gives the organizer `+ add round` during play; decision #8 gives them an explicit
`Finish session` that freezes the document. Ticket #8 implements both ends, and each one raised a
question the design record does not answer.

**Adding a round.** A round added in the ninth minute of the evening has nine rounds of history
behind it. Scheduling it on its own — rotating the bench one more step, pairing whoever is left —
would bench the wrong player and repeat partnerships the evening had already used up, and the
session would fail its own fairness invariants at the very prefix the organizer is standing in.

**Finishing.** "Finished" could be inferred rather than stored: every round generated and every
match scored. Inference is wrong here, and in a way that shows up on a real padel night — the last
court is abandoned mid-match because the lights go off, and that session is still finished. It is
also a state that must survive being written to Firestore and read back on another phone, which an
inference over a mutable document does not.

## Decision

**1. `Session.status` is `'in-progress' | 'finished'`, set by `finishSession` and by nothing
else.** Not a clock, not the last score arriving. Finishing is the organizer's choice of moment,
and the standings at that instant are the final ones — a session with rounds still unscored
finishes exactly as readily as a complete one.

**2. A finished session takes no operations that change it.** `assertSessionOpen` guards
`recordScore`, `generateRemaining`, `addRound` and `finishSession` itself, and every operation
added later — the roster edits of #9 — must call it too. Refusing a second `finishSession` is part
of the same rule rather than an exception to it: two stale screens should not both be able to
claim they were the tap that closed the night.

**3. The rule lives in the engine, not in the UI.** The app is not the only thing holding a
session document — a spectator's phone, a tab left open on a laptop, a write queued offline that
arrives late. A screen cannot be trusted to know it is stale, so the refusal has to sit where every
one of those paths goes through. This is the same reasoning that put `assertSessionValid` in
production code (decision #21) rather than in the tests.

**4. Reading a finished session is unrestricted.** `computeStandings`, `assertSessionValid` and
`formatSchedule` work on it exactly as they did a minute earlier. Standings are derived and stored
nowhere (ADR-0008), so "the standings no longer change" needs no freezing of its own: nothing can
change the matches they are computed from.

**5. `addRound` appends a slot and delegates to `generateRemaining`.** The generator already walks
a session in round order carrying its history (ADR-0006), so the added round is planned against
everything already played — it is the round the schedule would have held all along had the
organizer asked for it at creation. Any round left ungenerated ahead of it is filled by the same
walk. `addRound` owns no scheduling of its own, which is what stops a round added mid-evening from
being fair by a different standard than one scheduled at the start.

## Consequences

- The session document gains a field, and every hand-built session in the fixtures and the tests
  carries it. A status the engine never sets is rejected by `assertSessionShape`, so a document
  from storage cannot smuggle in a third state.
- `Finish session` is irreversible in the engine. Reopening a session is not a feature that exists;
  if it is ever wanted it needs its own decision, because it means deciding what happens to a
  podium screen someone has already seen.
- The app's Finish button needs a confirmation step, since the engine offers no undo.
