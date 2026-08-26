# 11. Team Americano is the same engine one level up, and the team a match was played by is stored

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #2a, #2b, #2c, #4 and #8 in [docs/DECISIONS.md](../DECISIONS.md), and
  [ADR-0006](0006-fairness-is-a-cost-function.md),
  [ADR-0010](0010-mixicano-is-one-cost-term-and-a-derived-mark.md)

## Context

Team Americano fixes the partnerships for the whole session. The organizer assigns the pairs on a
screen at creation (decision #2a) — no draw, no seeding — and from then on teams face teams, teams
take byes, and teams appear in the standings (decision #2c). Ticket #11 asks for that, minus the
orphaned-partner state of decision #2b, which is its own ticket.

The format is not a new set of rules. Every rule the engine already has applies unchanged, to a
different subject: byes rotate evenly, bench spread stays within one at every prefix, opponents
vary before any repeat, and the standings rank by points per match played with the same tie-break
tiers. So the design question was never *what* the rules are. It was where the level shift lives,
and how a match says which team played it.

Three questions had to be answered.

**Where the shift happens.** A second scheduler would be a second place for bench rotation and
prefix fairness to be got right, which is the mistake ADR-0010 declined to make for Mixicano.

**Whether a match records its teams.** The players on a side already imply the team, today. A
same-gender mark is derived for exactly that reason (ADR-0010), and the same argument seems to
apply.

**What partner variety means when nobody chooses a partner.** The existing rule — no partnership
repeats while any player still has an unplayed partner — is violated by the second round of every
Team Americano evening.

## Decision

**1. The team is the scheduling unit, and the shared rules take the unit as a parameter.** The
bench rule (`bench-sets.ts`) and the pairing search (`pairing-search.ts`) were lifted out of
`plan-round.ts` and given ids rather than players; `plan-team-round.ts` is the second caller.
Nothing about "who sits out" or "what is the cheapest pairing" was rewritten, and Americano's
planner is unchanged behind the extraction. This is ADR-0006 again: fairness is a cost function,
and a new format is a new subject for the same costs rather than a new search.

**2. Team Americano asks two questions where Americano asks three.** Who partners whom was settled
at the pairing screen, so the expensive middle question — the branch-and-bound over every way to
pair the players up — is not asked at all. What is left is the bench and the fixture list, priced
the way partner repeats are priced: a rematch is minimised rather than forbidden, and a rematch
that leaves either team with an opponent it has never faced costs the starvation band. Four teams
have only six fixtures, so an evening longer than three rounds *must* repeat; the ordering is what
makes it repeat in the right order rather than refuse to schedule.

**3. The team a side played as is stored on the match; the players on court are not enough.**
`Match.teams` names both sides' teams. This is deliberately not ADR-0010's derived mark, and the
difference is mutability: a same-gender pair is a lookup against the roster's genders, while a
team's membership is the part decision #2b changes. Repairing an orphaned team gives it a new
player, and every match that team has already played must keep counting for it — which is exactly
what decision #2b means by "points retention is automatic: standings are computed from matches
that reference a team id". Deriving the team from the players on court would hand those points to
nobody. So a side is *who was on the court*, `match.teams` is *who they were playing as*, and the
referee holds the two to each other while the pair is intact.

**4. Partner variety is exempt; opponent variety replaces it.** A fixed partnership is the format
rather than something the scheduler chose, so it answers to nothing — exactly as a Mixicano
same-gender pair answers to minimisation and rotation instead of to the repeat rule. What takes
its place is the same rule about the other axis: no fixture repeats while either team still has an
opponent it has never faced, generalised past the first rotation in the same way.

**5. The referee reports at team level first.** In Team Americano a bye falls on a team, and the
error that says so is more use than one naming one of the two players it also fell on. The
player-level bench spread is still checked afterwards — it holds, and while pairs are intact it is
the same fact stated twice, which costs nothing and stops being redundant the moment a team is
short a player.

**6. The pairing is validated at creation, structurally.** An odd roster, a player in two teams, a
player in none, a team naming somebody who is not on the roster: all are refused by
`assertSessionShape`, so the organizer finds out on the pairing screen rather than three rounds
into the evening. `Session.teams` is absent rather than empty in the modes that have none, so a
stored session reads back as the document it was saved as, and a session that carries teams in a
partner-rotating mode is refused rather than quietly ignored.

**7. One ranking ladder, two leaderboards.** `ranking.ts` holds points per match, total points,
head-to-head and the joint position, and is handed competitors — players from `standings.ts`,
teams from `team-standings.ts`. Writing the ladder twice would be writing two subtly different
tie-breaks. `computeStandings` still works in Team Americano and reads a player's line as their
team's evening under their own name; `computeTeamStandings` refuses a mode that has no teams,
because an empty table would be an answer to a question nobody asked.

**8. Roster changes are refused in Team Americano, for now, and say so.** `addPlayer` and
`removePlayer` are built on a flat roster: one arrival is half a team, and one departure leaves a
player without a partner. That state is decision #2b and the next ticket. Until it exists, an
error naming the reason is the honest answer — the alternative is a session quietly rescheduled
around a team the engine no longer understands.

## Consequences

- Four teams on two courts exhaust the fixture list in three rounds. Longer evenings repeat
  fixtures in rotation, which is what the format is on that roster — the alternative would be
  refusing to schedule a round the organizer has courts for.
- `Match.teams` is a second field that can disagree with the players on the side. It is checked at
  every round by `assertTeamSides`, so a document that drifts is caught rather than silently
  miscounted; the check is what buys the storage its safety.
- Team standings and player standings can be read off the same session at once. They agree by
  construction while pairs are intact, and they will legitimately differ once a team is repaired
  mid-session — the team keeps its points, the new player arrives with none.
- Nothing here handles a team with one player. `teamsAvailableIn` already asks the question the
  right way — a team is as available as its scarcer half — so decision #2b lands as a state on the
  team rather than as a change to the scheduler.
