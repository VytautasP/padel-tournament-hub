# 37. An abandoned round is compensated, if the organizer says so

- **Status:** Accepted
- **Date:** 2026-09-13
- **Amends:** [ADR-0023](0023-the-standings-rank-on-total-points-and-the-bench-is-paid-a-credit.md) §4
- **Relates to:** [ADR-0009](0009-finishing-is-a-status-on-the-session-enforced-in-the-engine.md)
  and decision #8 in [docs/DECISIONS.md](../DECISIONS.md)

## Context

Evenings end early. The lights go off, the courts are needed, half the group has a train — and the
organizer ends a session with rounds seven and eight sitting there generated, four names printed on
each court, never played.

Today `finishSession` freezes the document and those rounds stay unscored, which is exactly right
as a record. As a *result* it can be wrong. Under ADR-0023 the standings rank on total points, so a
player whose two remaining matches evaporated has a smaller total than the player whose matches all
happened, and the table says they lost an evening that was never finished. The rate that used to
hide this is gone, deliberately, and this is one of the things it was hiding.

It is not always wrong, either. A night that fizzles out after five of eight rounds was a five-round
night and everybody knows it. Whether the evening owes anybody anything is a judgement about what
happened in the room, and there is no reading of the document that recovers it.

## Decision

**1. The organizer is asked, and the default is no.** Ending a session that still holds generated,
unscored matches asks one further question in the confirmation sheet. It appears only when there is
something to compensate, and it defaults to **no**: the standings on screen when the organizer
reached for the button should be the standings they get, unless they say otherwise.

**2. What is owed is owed for an abandoned round — a generated round that was not played.** Not an
ungenerated round slot. A generated round is a fixture with names on it; a slot is a number in a
form field, and paying for those would let an evening be inflated by setting the round count to
thirty. A round half-scored pays only the competitors in its unscored matches — the courts that
finished, finished.

**3. Everyone available for that round is paid, on court or on the bench.** The players scheduled
onto its courts *and* the players it benched. Paying only the scheduled would make ending early a
penalty for wherever the rotation happened to put you, which is the precise bias ADR-0023 §3 exists
to remove — the bench credit was invented so the rotation could not decide the table, and this
would hand it the decision back at the final whistle. Absence is still not availability: a player
who had not arrived, one who had gone home, an orphaned team and the stranded half inside it are
paid nothing, in exactly the words ADR-0023 §3 already uses.

**4. It pays half the target score — the same as a bench credit.** It is the same payment because
it is the same thing: a round somebody was entitled to and did not get, made good at the one value
that neither rewards nor penalises (decision #3). Paying the full target would make a cancelled
match a win and reward the organizer who ended early. Paying a player's own average so far would
let whoever was scoring well bank their form and go home.

**5. It is a payment, not a match.** No `matchesPlayed`, no win, no tie, no loss. The record is
what happened on court; this is the second thing that happened instead of court.

**6. The answer is stored, because it cannot be derived.** `finishSession(session, { compensateUnplayed })`
writes `compensatedUnplayed` onto the session, and the standings derive the payments from it.
Everything else in this table is computed on every read (ADR-0008, decision #17) and this cannot be:
no amount of reading the rounds recovers a judgement the organizer made about the room. A flag on a
frozen document is the smallest thing that can carry it, and the document is frozen the same instant
it is written, so it can never disagree with anything later.

**7. The referee refuses a flag that pays nobody.** `compensatedUnplayed: true` on a session with no
unscored generated matches is a promise the document cannot keep. It costs one check to catch and it
is the kind of drift the referee is for.

**8. `Standing` gains `compensated`, and the row shows it.** A total can now come from three places
— matches, bench credits, and compensation — and ADR-0023 spent itself on the property that a reader
can check the total by hand. Folding compensation into `benched` would tell a player they sat out a
round they were scheduled into, so the roster tab and the standings tab would contradict each other;
adding the points silently would break the arithmetic the expanded row exists to show.

**9. Team Americano is the same sentence one level up.** Teams scheduled into an abandoned round and
teams on a bye in it are compensated identically, and a **needs partner** team is not available, so
it is paid nothing. The rule lives with the bench credit in `bench-credit.ts` and both leaderboards
ask it the same way, which is what ADR-0011 asks of every team-level rule.

## Consequences

- **The podium can move when the organizer answers yes**, and it can move after they have looked at
  it. The confirmation has to say so, because a leaderboard that reorders itself on the way to the
  final screen is otherwise indistinguishable from a bug.
- **An evening ends with two questions instead of one**, on the one screen where the organizer is
  already being asked to confirm something irreversible. It is asked only when it can be answered,
  which keeps the ordinary ending a single tap.
- **The engine now has one stored fact about the standings.** It is the first, and it is worth
  saying why it will not be the second: it is stored because a person decided it, not because a
  computation was expensive. That is the only reason this file accepts.
- **Compensation and the bench credit will look like duplicates and are not.** A bench credit is
  paid for a round that happened; compensation is paid for one that did not. They are the same
  arithmetic answering two different questions, and `CONTEXT.md` keeps them apart on purpose.
