# 2. Scaffold on Angular 21, not 22, until Node is upgraded

- **Status:** Superseded by [ADR-0003](0003-upgrade-to-angular-22.md) (2026-08-25)
- **Date:** 2026-08-25

## Context

The workspace was scaffolded on a machine running Node v22.15.1. Angular 22 — the current latest —
requires Node `^22.22.3 || ^24.15.0 || >=26.0.0` and refuses to run at all below that floor.
Angular 21 requires `^20.19.0 || ^22.12.0 || >=24.0.0`, which this machine satisfies.

## Decision

Scaffold the workspace on Angular 21 (`@angular/cli@21`, Angular 21.2). Revisit after Node is
upgraded to 22.22.3 or later; `ng update` from 21 to 22 is a supported single-major step.

## Outcome

Superseded the same day: Node was upgraded to v24.19.0, and the workspace moved to Angular 22.
See [ADR-0003](0003-upgrade-to-angular-22.md).

## Consequences

- Nothing in the build order depends on an Angular 22 feature, so this costs nothing today.
- The upgrade is a deliberate follow-up, not a drift: it needs a Node upgrade first, and both
  should happen before the app grows enough code to make the migration interesting.
- Contributors on a Node older than 20.19 cannot build the workspace.
