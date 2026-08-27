# 20. Bench fairness in Team Americano is asked of the team, and only of the team

- **Status:** Accepted
- **Date:** 2026-08-27
- **Relates to:** decisions #2b, #2c and #6 in [docs/DECISIONS.md](../DECISIONS.md),
  [ADR-0011](0011-team-americano-is-the-same-engine-one-level-up.md) and
  [ADR-0012](0012-an-orphaned-team-keeps-its-slot-and-the-fixture-ledger-restarts-with-the-field.md)
- **Supersedes:** the second half of decision 5 of ADR-0011 ("the player-level bench spread is
  still checked afterwards")

## Context

ADR-0011 §5 had the referee check bench spread twice in Team Americano: once over the teams, and
then again over the players of the teams that could take the court. The reasoning was explicit and
was true when it was written — _"while pairs are intact it is the same fact stated twice, which
costs nothing and stops being redundant the moment a team is short a player."_

Decision #2b then made a team's membership mutable (ADR-0012). A team that loses half its pair can
be repaired, and the replacement joins in the round the repair lands in. From that round on, the
two statements are no longer the same fact:

- The **team** has sat out however many byes fell on it since round one.
- The **replacement** has sat out however many fell on it since she arrived, which is fewer, and
  can never be more.

ADR-0012 §5 already settled the returning side of this: a team back from being orphaned rejoins
the bench queue at the floor, because resuming on the count it was orphaned with would put it byes
behind everybody. The player-level check was left asking the other question, and it fails the
mirror image of the same case — the replacement is at the floor of a queue everyone else has been
standing in since round one.

This was not theoretical, and it was not caught by the engine's own specs because they schedule
from one session id. The scheduler seeds its tie-breaking from the session (decision #6), so the
byes of the first two rounds fall differently for different evenings; across forty session ids of
a three-team, one-court evening repaired after round two, **eleven produced a session the referee
rejected** — `After round 4 bench counts differ by 2 — Elin has sat out 2 time(s)` — for a
schedule in which every team's byes were within one of every other team's.

## Decision

**1. In Team Americano the bench spread is a rule about teams, and it is checked at that level
only.** `assertSessionValid` asks the team question in that mode and the player question in the
modes that rotate partners. Neither mode is asked both.

**2. The unit is the whole difference between the modes, and the referee now says so in its
shape.** The two branches are exclusive: teams get the bye spread and opponent variety; players
get the bench spread and partner variety. That is decision #2c stated once more, at the last place
in the engine that was still stating it twice.

**3. Nothing is lost by dropping the player-level check.** A player of a team on a bye was not
kept off a court by the scheduler — their team was — and the one player the check could have had
something of its own to say about, the stranded half of an orphaned team, was already outside it:
they are excluded from the comparison by ADR-0012 §2 and caught instead by
`assertNobodyStrandedOnCourt`.

## Consequences

- A Team Americano session with an unfair *player-level* bench distribution and a fair team-level
  one now passes the referee. That distribution is not reachable while a team's line-up is its two
  members — a bye falls on both halves at once — so what is admitted is exactly the repaired-team
  case this exists for.
- The app can run a Team Americano evening through a repair without the referee rejecting a
  schedule nobody scheduled badly, which is what
  [ticket #24](https://github.com/VytautasP/padel-tournament-hub/issues/24) needed to hold its
  last acceptance criterion.
- Engine fixtures that vary the session id are worth more than they look. One id exercises one
  path through a deterministic search seeded from it; the regression test for this pins the id
  that failed, and names it in the fixture rather than leaving it looking incidental.
