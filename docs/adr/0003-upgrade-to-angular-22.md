# 3. Upgrade to Angular 22

- **Status:** Accepted
- **Date:** 2026-08-25
- **Supersedes:** [ADR-0002](0002-angular-21-until-node-is-upgraded.md)

## Context

ADR-0002 scaffolded the workspace on Angular 21 for one reason only: the machine ran Node v22.15.1,
below Angular 22's floor of `^22.22.3 || ^24.15.0 || >=26.0.0`. That reason is gone — Node is now
v24.19.0 (Krypton, the current LTS), so the constraint no longer binds.

Doing the upgrade now is deliberate timing. The workspace holds one library with an empty public
API, so the migration surface is as small as it will ever be. Every later ticket adds code that a
deferred upgrade would have to migrate.

## Decision

Upgrade to Angular 22 via `ng update @angular/core @angular/cli angular-eslint`. The three had to
move together: `angular-eslint` 21 declares a peer dependency of `@angular/cli >= 21.0.0 < 22.0.0`,
so updating Angular alone is refused.

Resulting versions: Angular 22.1.3, Angular CLI 22.1.5, ng-packagr 22.1.1, angular-eslint 22.1.0,
and TypeScript 6.0.3 (Angular 22 requires the 6.0 line; the update moved it).

The `packageManager` field moves to `npm@11.17.0`, the npm that ships with Node 24.

The CLI's `nullishCoalescingNotNullable` / `optionalChainNotNullable` migration was **reverted**.
It writes `extendedDiagnostics` suppressions into all three of the engine's tsconfigs to preserve
v21 behaviour, but those are Angular *template* diagnostics, and `padel-engine` has no templates
and by decision #11 never will. Committing them would have been dead configuration in the one
project whose whole point is that Angular does not reach into it.

Both optional CLI migrations were skipped as inapplicable: `migrate-karma-to-vitest` (the workspace
was scaffolded on Vitest) and `use-application-builder` (no application project exists yet).

## Consequences

- The floor to build this repo is now Node `^22.22.3 || ^24.15.0 || >=26.0.0` — sharply higher than
  before, and the README says so. A contributor on Node 22.15 can no longer build it at all.
- TypeScript 6.0 arrives with this upgrade rather than as its own decision. Nothing in the engine
  exercises it yet, which is the point of doing it now.
- `npm run verify` — format, lint, boundary check, build, tests — is green on the new versions,
  including the `ng lint` half of the boundary check, so angular-eslint 22 still enforces the
  import restrictions.
