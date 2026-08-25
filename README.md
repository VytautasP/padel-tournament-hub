# Padel Tournament Hub

A web app for running padel sessions in the popular rotating formats — **Americano**,
**Mixicano** and **Team Americano**. One organizer runs the session from their phone and enters
every score; everyone else scans a QR code and watches live standings, their next court and their
next partner. Installable as a PWA, so it behaves like an app without ever touching an app store.

## Status

**Pre-implementation.** The design is locked; no application code exists yet.

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

## Build order

1. **`padel-engine` + tests** — no UI. Print schedules, eyeball fairness on awkward rosters. ← *current*
2. **Angular app, `localStorage` only** — create → generate → score → standings → finish. Usable at a real session.
3. **Firebase** — repository implementation, anonymous auth, security rules, share code, QR, spectator view.
4. **Mixicano + Team Americano, PWA polish**, Google account linking, session delete.

Step 2 is deliberately a complete, usable app: swapping `localStorage` for Firestore touches a
single file behind the `SessionRepository` interface.

## Licence

None — all rights reserved.
