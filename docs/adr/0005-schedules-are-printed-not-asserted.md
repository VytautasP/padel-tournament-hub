# 5. Schedules are printed for reading, not asserted on

- **Status:** Accepted
- **Date:** 2026-08-25
- **Relates to:** decision #21 in [docs/DECISIONS.md](../DECISIONS.md), build-order step 1

## Context

Build order step 1 asks for schedules to be printed and fairness eyeballed on awkward rosters
(11 players on 2 courts). That is a deliverable, not a debugging convenience: `assertSessionValid`
proves the invariants hold, but only a person reading a printed schedule notices that a
technically-fair evening still feels wrong.

Rendering text is the kind of thing a suite tends to freeze — one snapshot test and the layout
stops being free to change.

## Decision

**1. Rendering ships in the engine as `formatSchedule(session): string`**, exported from the public
API alongside the operations. It is a pure `Session -> string`, so it stays inside the engine
boundary (decision #11) and is available to the app later — a share sheet or a "copy the schedule"
button is the same rendering problem.

**2. No test asserts on the printed text.** `format-schedule.spec.ts` checks only that rendering
survives the session shapes a developer will point it at; every fairness claim in the suite is made
against `assertSessionValid` (decision #21). The layout is free to change without breaking a suite.

**3. `formatSchedule` validates nothing.** It renders whatever session it is handed — half
generated, benched, a player who is not on the roster — because a printout is reached for precisely
when a session is in a state nobody expected. Players scheduled off the roster are labelled as such
rather than throwing.

**4. `npm run print:schedule` is the way to read one.** `tools/print-schedule.mjs` sits outside the
engine (it may touch Node built-ins; the engine may not) and prints against the **built** library,
so the printout also exercises the package build.

## Consequences

- The bench and the "never partnered" lines render today even though the scheduler is exact-fit
  (ADR-0004): the printer's awkward-roster case is hand-rotated so that a benched schedule is
  already legible when bench rotation lands.
- Duplicate names are disambiguated by id in the output. Identity is by id (decision #9), and a
  printout that silently merges two players called Ana would hide exactly the kind of fairness bug
  it exists to expose.
- Any future format change — a share sheet, a court-first layout — is a local edit. Nothing in the
  suite pins it.
