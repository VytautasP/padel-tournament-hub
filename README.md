# Padel Tournament Hub

A web app for running padel sessions in the popular rotating formats — **Americano**,
**Mixicano** and **Team Americano**. One organizer runs the session from their phone and enters
every score; everyone else scans a QR code and watches live standings, their next court and their
next partner. Installable as a PWA, so it behaves like an app without ever touching an app store.

## Status

**Engine, fair scheduling.** `padel-engine` schedules Americano for any roster of four or more on
any number of courts — through `createSession`, `generateRemaining` and the referee that ships with
them, `assertSessionValid`. Players who do not fit onto a court are benched, and the bench rotates:
bench counts never differ by more than one, after every round rather than only at the end, because
an evening that stops early has to be as fair as one that runs its course. Eleven players on two
courts — the case the build order names by name — schedules cleanly; see
[ADR-0006](docs/adr/0006-fairness-is-a-cost-function.md) for why fairness is a cost function rather
than a constraint set. `formatSchedule` renders a session as readable text, so fairness can be
eyeballed and not only asserted — `npm run print:schedule`.

`recordScore` records results: the organizer enters one side's points and the engine derives the
other from the session target, so an invalid scoreline cannot be constructed rather than merely
rejected. Courts are scored in whatever order they finish, across rounds, and re-recording replaces
a score outright — which is what makes correcting a typo at the side of a court safe. See
[ADR-0007](docs/adr/0007-scores-are-a-derived-pair-on-the-match.md). Standings, roster mutation,
Mixicano and Team Americano are still to come. No application code exists yet.

All 26 design decisions — modes, scoring, fairness rules, data model, stack and build order —
live in **[docs/DECISIONS.md](docs/DECISIONS.md)**. That file is the source of truth. If code and
decisions ever disagree, one of them is a bug.

## Planned stack

| Layer | Choice |
|---|---|
| Frontend | Angular — standalone components, signals, zoneless |
| Styling | Tailwind CSS + Angular CDK (no Material) |
| Rules engine | `padel-engine` — a buildable library of pure TypeScript, no Angular or Firebase imports |
| Backend | None. Firebase Hosting + Firestore + Anonymous Auth; security rules are the authorization layer |
| Delivery | PWA — service worker app shell plus Firestore offline persistence |

The engine holds every scheduling and scoring rule and runs entirely in the browser, which is why
there is no custom backend: the server only ever stores and serves session documents.

## Getting started

Requires Node 22.22.3+, 24.15+ or 26+ (Angular 22's floor — see
[ADR-0003](docs/adr/0003-upgrade-to-angular-22.md)).

```bash
npm install
npm run verify         # format, lint, engine boundary check, build, tests
npm run print:schedule # build, then print a few schedules to read
```

The workspace currently holds one project: `projects/padel-engine`, the pure TypeScript rules
library. The Angular app arrives with build-order step 2. The engine may not import Angular or
Firebase, and that is enforced by lint rather than by convention — see
[ADR-0001](docs/adr/0001-enforce-the-engine-boundary-with-eslint.md).

## Build order

1. **`padel-engine` + tests** — no UI. Print schedules, eyeball fairness on awkward rosters. ← *current*
2. **Angular app, `localStorage` only** — create → generate → score → standings → finish. Usable at a real session.
3. **Firebase** — repository implementation, anonymous auth, security rules, share code, QR, spectator view.
4. **Mixicano + Team Americano, PWA polish**, Google account linking, session delete.

Step 2 is deliberately a complete, usable app: swapping `localStorage` for Firestore touches a
single file behind the `SessionRepository` interface.

## Licence

None — all rights reserved.
