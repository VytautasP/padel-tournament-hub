# Padel Tournament Hub

A web app for running padel sessions in the popular rotating formats — **Americano**,
**Mixicano** and **Team Americano**. One organizer runs the session from their phone and enters
every score; everyone else scans a QR code and watches live standings, their next court and their
next partner. Installable as a PWA, so it behaves like an app without ever touching an app store.

## Status

**Engine, first slice.** `padel-engine` schedules Americano for an exact-fit roster — 4 players on
1 court, 8 on 2, 12 on 3 — through `createSession`, `generateRemaining` and the referee that ships
with them, `assertSessionValid`. `formatSchedule` renders a session as readable text, so fairness
can be eyeballed and not only asserted — `npm run print:schedule`. Bench rotation for any roster
>= 4, scoring, standings, roster mutation, Mixicano and Team Americano are still to come; see
[ADR-0004](docs/adr/0004-exact-fit-americano-first.md). No application code exists yet.

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
