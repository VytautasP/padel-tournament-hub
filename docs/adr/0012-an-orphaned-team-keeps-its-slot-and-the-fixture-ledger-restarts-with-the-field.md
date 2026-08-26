# 12. An orphaned team keeps its slot, membership is a line-up per round, and the fixture ledger restarts with the field

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #2a, #2b, #2c and #5 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0011](0011-team-americano-is-the-same-engine-one-level-up.md)
- **Supersedes:** decision 8 of ADR-0011 (roster changes refused in Team Americano), and the
  "requires an even roster" consequence of decision #2a

## Context

Ticket #12 is decision #2b: what happens in Team Americano when one half of a pair goes home. The
team keeps its slot, the player left behind is flagged `needs partner`, the team is skipped while
it cannot field a pair, and a new partner repairs it **with its points intact**. Removing the
stranded player outright retires the team instead.

ADR-0011 left `teamsAvailableIn` asking the right question already — a team is as available as its
scarcer half — and predicted this would land as a state on the team rather than as a change to the
scheduler. That turned out to be true of the *scheduling* and false of three other things:

**A repaired team's played rounds no longer field the pair it names.** `assertTeamSides` held a
side to `team.playerIds`, which was the whole point of storing `Match.teams` — but a repair
changes exactly that field. Held to today's pair, every round the old pair played reads as a
forgery; not held to anything, the stored team id stops meaning anything.

**The stranded player is available but unplayable.** They are on the roster with an open window,
so the referee counted them as benched every round and the bench spread blew up within two rounds.

**Opponent variety became unsatisfiable.** With four teams on two courts a round is a *pairing of
the whole field*: there are exactly three ways to split them, and meeting the two teams who have
never met is what forces the other two to repeat. That is fine over a field the rotation started
on. It is not fine over a field that shrank mid-session: rounds played by five teams leave a
half-filled ledger among the four that remain, and from there no sequence of rounds can avoid a
repeat while a pair is still unmet — the split that introduces the missing pair is the split that
repeats another. Every round the scheduler could plan was a violation.

## Decision

**1. A team's membership is a line-up read per round, not a pair read per session.** `Team` gains
`formerPlayerIds`: the halves that have played for it and gone home. `teamLineupIn` is the members
who are in the session for a given round — two while the pair is intact, one while it is orphaned,
none once it is retired. That is decision #2b's three states, derived from the availability
windows rather than stored as a flag anywhere, and it is what `teamsAvailableIn`, `courtsInPlay`
and the referee all now ask.

`assertTeamSides` holds a side to the team's line-up **in that round**. A team repaired in round
five is still the old pair in round three, and the check says so. The stored `Match.teams` keeps
its meaning — who a side was playing *as* — and points retention falls out exactly as ADR-0011
said it would: the standings count team ids, and the id never changed.

**2. The `needs partner` flag is derived, and the referee checks it.** `teamsNeedingPartner` is
the public reading of it, for a screen that has to show the organizer the problem. A player whose
team cannot field a pair is not benched — no bye fell on them, there was no court to keep them off
— so they are outside the bench comparison entirely, and `assertNobodyStrandedOnCourt` catches any
session that schedules one anyway.

**3. Repair is its own operation.** `assignPartner(session, teamId, player)` amends the roster and
the pairing and hands both to the same rescheduling `addPlayer` and `removePlayer` use: played
rounds frozen, the rest planned again from history. `removePlayer` is now allowed in Team
Americano and needs to know nothing about any of this. `addPlayer` is still refused — a player
arriving alone is a player in no team — but the error names `assignPartner` instead of describing
a state the engine had not implemented yet.

**4. The roster no longer has to be even; the pairing has to be complete.** A session that has
lost a player and gained a replacement carries both, and is legitimately odd. "Every player in
exactly one team" was always the real rule, and it is what refuses an odd roster at the pairing
screen — by naming the player nobody is paired with.

**5. A team back from being orphaned rejoins the bench queue at the floor.** `forgetAbsent` drops
whoever is not in this round, so a returning team is seeded exactly as a late arrival is: level
with the front of the queue, compensated for nothing, owing nothing. Resuming on the count it was
orphaned with would put it byes behind everybody and fail the spread rule on a round nobody
scheduled badly. The scheduler and the referee share the code, as they already did for arrivals.

**6. The fixture ledger restarts when the field changes.** `FixtureLedger` counts meetings over
the set of teams that can take the court, and starts again when that set changes. A fixture list
is a rotation over a field; a team leaving or a team repaired is a new rotation over a new one.
The counts from before are a record of a different tournament shape, and holding the new shape to
them condemns rounds nobody could have planned better — which is what made the rule unsatisfiable
above. It is the same answer the bench queue gives a returning team, on the other axis.

**7. A round that cannot field two teams is refused when it is caused, not when it is played.**
`assertEveryRoundStaffable` counts teams in Team Americano, so a removal that would leave fewer
than two teams able to take the court fails at the moment the organizer asks for it, naming the
round and the count. This is the existing Americano behaviour — removing the fifth of five players
is refused the same way — and it is deliberately a refusal rather than a session full of empty
rounds: an evening nobody can play is not a state worth writing down.

## Consequences

- `Team.formerPlayerIds` is optional and absent on a team that has never been repaired, so
  sessions stored before this reads back unchanged. Every reader that wants "who plays for this
  team now" still reads `playerIds`; only the per-round questions go through `teamLineupIn`.
- Team and player standings diverge after a repair, as ADR-0011 predicted: the team keeps its
  points, the departed player keeps theirs under their own name, and the new partner arrives with
  none.
- Restarting the ledger forgives fixture history across a field change. Two teams who met twice
  before a departure may meet again immediately after it. That is the price of the rule being
  satisfiable at all, and the bench spread — which is not restarted, only re-seeded for returners
  — still holds across the change.
- An organizer whose session drops below two playable teams cannot record the last departure. The
  honest move at that point is to finish the session; the alternative is a document full of rounds
  that no longer describe an evening.
- Nothing here handles two stranded players from different teams pairing up with each other. It
  would need a rule for which of the two teams keeps its points, which is a question for an
  organizer rather than for the engine.
