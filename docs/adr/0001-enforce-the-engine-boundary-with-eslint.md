# 1. Enforce the padel-engine boundary with ESLint import restrictions

- **Status:** Accepted
- **Date:** 2026-08-25
- **Relates to:** decision #11 (engine is a pure client-side TS library), #18 (buildable library)

## Context

Decision #11 says `padel-engine` is pure client-side TypeScript with no Angular and no Firebase
imports. Decision #18 makes it a buildable library "for build-level boundary enforcement" — but a
buildable library does not, on its own, enforce anything of the sort. `ng-packagr` will happily
compile an `@angular/core` import inside the library; Angular is a peer dependency of the default
library scaffold, and the workspace hoists a single `node_modules`, so the import resolves. The
boundary would have been a convention, discovered broken months later.

Something has to fail, loudly, the first time someone reaches for the wrong import.

## Decision

Restrict imports inside `projects/padel-engine` with `@typescript-eslint/no-restricted-imports`,
configured in the library's own `eslint.config.js`. The restricted groups are `@angular/*`,
Firebase (`firebase`, `@firebase/*`, `@angular/fire/*`) and Node built-ins (`node:*`), each with a
message naming the decision it protects. `ng lint padel-engine` exits non-zero on a violation.

The rules apply to the library's spec files too, so tests cannot reach for `TestBed` either — the
engine is tested as plain TypeScript.

Because a lint rule nobody has watched fail is indistinguishable from no lint rule,
`tools/verify-engine-boundary.mjs` (`npm run verify:boundary`) demonstrates the boundary on every
run rather than assuming it. It checks two things, because either alone leaves a hole:

1. **The rules reject what they claim to, and nothing more.** Deliberate violations — value
   imports, type-only imports, submodule imports, Firebase, Node built-ins — go through the
   engine's own ESLint config, and a legitimate relative import must still pass.
2. **The rules are wired into the command people run.** A real file importing `@angular/core` is
   written into the engine's `src`, `ng lint padel-engine` is invoked, and the check fails unless
   that command exits non-zero citing the rule. Correct-but-unwired rules would otherwise pass
   step 1 happily.

## Alternatives considered

- **Rely on the buildable library alone.** Rejected: it does not fail, as above.
- **Omit Angular from the library's `package.json` peer dependencies and hope resolution fails.**
  Rejected: npm workspace hoisting resolves the import anyway. (The peer dependencies were removed
  regardless — they are not true of this library — but that is honesty, not enforcement.)
- **A dependency-cruiser rule.** Rejected: a second tool and config to keep alive when ESLint is
  already in the workspace and already runs over these files.

## Consequences

- The engine's lint config is now load-bearing. Deleting or loosening it reopens the boundary, and
  `verify:boundary` catches that only where it is specific: the six probe imports and the `ng lint`
  exit code. Widening the boundary later (a new forbidden group) means adding a probe, or the check
  quietly stops covering it.
- Any legitimate future need to import something from a restricted group (there should be none)
  requires an explicit, visible exemption rather than a quiet import.
- `verify:boundary` writes a temporary file into `projects/padel-engine/src` and removes it in a
  `finally`. An interrupted run can leave `src/boundary-probe.ts` behind; lint will then fail,
  which is loud and self-explaining rather than silent.
- There is no CI (decision #22), so `npm run verify` — format, lint, boundary, build, tests — is
  the gate, and it has to be run by hand before pushing.
