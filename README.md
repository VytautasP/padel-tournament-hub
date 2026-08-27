# Padel Tournament Hub

A web app for running padel sessions in the popular rotating formats — **Americano**,
**Mixicano** and **Team Americano**. One organizer runs the session from their phone and enters
every score; everyone else scans a QR code and watches live standings, their next court and their
next partner. Installable as a PWA, so it behaves like an app without ever touching an app store.

## Status

**Engine, fair scheduling.** `padel-engine` schedules Americano, Mixicano and Team Americano for
any roster of four or more on any number of courts — through `createSession`, `generateRemaining` and the referee that ships with
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
[ADR-0007](docs/adr/0007-scores-are-a-derived-pair-on-the-match.md).

`computeStandings` turns those results into the leaderboard: ranked by points per match played, so
sitting out never costs or gains position, and derived on every call rather than stored, so a
corrected score recomputes for free. Ties break by total points and then by a head-to-head
mini-league among the tied players; a tie that survives all three tiers is returned as a declared
joint position rather than ordered arbitrarily. See
[ADR-0008](docs/adr/0008-standings-are-derived-and-ties-stop-at-the-evidence.md).

**Mixicano** is the same scheduling machinery with one more term in its cost function: pairs
should be mixed-gender. Real rosters do not split evenly, so seven women and three men fill the
courts with mixed pairs and let the surplus play same-gender — never more such pairs than the
players on court force, and rotated so the same two people are not the ones compromised every
round. Same-gender pairs are marked in the schedule, derived from the roster rather than stored,
so the organizer can explain a pairing rather than appear to have invented it. Bench spread,
partner variety and prefix fairness hold unchanged throughout; see
[ADR-0010](docs/adr/0010-mixicano-is-one-cost-term-and-a-derived-mark.md).

**Team Americano** is the same engine one level up. The organizer pairs the roster themselves at
creation — no draw, no seeding — and from there the team is the unit: teams face teams, a whole
team takes the bye when there are more teams than courts, team bench counts stay within one at
every prefix, and teams meet every other team before meeting any of them twice. The standings are
the same ladder handed teams instead of players, so points per match played and the tie-break
tiers mean exactly what they already meant. See
[ADR-0011](docs/adr/0011-team-americano-is-the-same-engine-one-level-up.md). When one half of a
pair goes home the team keeps its slot and its points and the other half is flagged
`needs partner`, until a replacement repairs the team or the stranded player leaves too; see
[ADR-0012](docs/adr/0012-an-orphaned-team-keeps-its-slot-and-the-fixture-ledger-restarts-with-the-field.md).
**The app runs an evening end to end, in every format.** `padel-app` opens on a landing page, walks
a wizard of three steps — mode, names, then a review screen already holding a target of 24, one
court, a complete rotation capped at 12 and a name per court, pre-filled `Court 1…N` for the club
that books courts 7 and 8 (ADR-0017 §6) — and generates the schedule. The session is a
three-tab shell (ADR-0016): the Round tab renders the round the evening is on — every court, both
sides, whoever is sitting out — and tapping a court opens the score sheet, two views of one number
bounded by the session's target, which refuses anything larger rather than quietly clamping it
(ADR-0014). The Standings tab is the same table the engine derives, live: position, name and points
per match, a tap for the detail behind a row, and a dash rather than a column of zeroes before
anybody has played. The evening lives in `localStorage` behind a `SessionRepository`
(decision #19), so closing the app and reopening it offers Resume rather than New session — and
reopens on the current round, which is worked out from the unscored matches every time and stored
nowhere. Prev and next reach every generated round with one control back to the current one, and
one page past the last round is where a round gets added — which is where "have we time for
another?" is actually asked (ADR-0016 §4).

**The Players tab is where the roster moves during the evening** (decision #5, ADR-0015). It lists
the roster with a badge on whoever this round leaves off a court — the same derivation the bench
strip renders, so the two cannot disagree — takes a late arrival through the wizard's own single
input at the bottom of the list, and puts **went home** on the row's overflow rather than on a
swipe, because a stray thumb at the side of a court must not be able to remove a player. A player
who has gone home keeps their played matches and their line in the standings, and is scheduled into
no later round. Every one of these opens a preview of **the whole regenerated remainder** first,
scrollable, rounds from the current one onward as they will be rather than a diff of a rotation
that would be nearly every line. Its dismissal reads **"Don't change the roster"**, because there
is no state in which the schedule is rejected and the change kept, and there is no reroll: the
scheduler is deterministic (ADR-0006), and a schedule the organizer shopped for is a fairness claim
nobody can check. Nothing reaches storage until the preview comes back confirmed.

**Team Americano is the same app one level up** (ADR-0011). The wizard grows a fourth step, in that
mode and no other, where the organizer assigns the pairs themselves — tap two names and they are a
team, no draw and no seeding, because the pairs are the ones the group already agreed on. An odd
roster is held at the Players step with the reason inline, so the pairing screen is never reached
with somebody left over. From there the team is the unit: teams face teams, the strip under the
courts names the team on a **bye** rather than two loose players, and the Standings tab is the same
ladder handed teams instead of players, joint positions and all. When one half of a pair goes home
the other is flagged **needs partner** on their Players tab row, with **Assign partner** beside it —
the fix where the problem is displayed — and the repaired team keeps every point it had already won
(ADR-0012). A repair is a roster change, so it rides the same regeneration preview as the other two.

**End session** is in the Standings footer, because the evening ends when the table is final and
the table is what the organizer is looking at when they decide that. Behind a confirmation naming
what freezes, it sets the engine's finished status (ADR-0009) and moves the evening into **session
history** in the same breath — after which the session takes no score and no roster change, and a
podium block sits above the same final table rather than on a screen that would render those rows
twice. A joint first is repeated rather than broken, because the engine declared that tie on the
evidence and stopped (decision #8).

That makes the landing page the app's front door (ADR-0013). One evening is in progress at a time:
a Resume card names the mode, the round and the player count, New session is *absent* rather than
disabled while it stands, and **Discard** — the only way past an evening that fell apart in round
3 — is in that card's overflow and nowhere inside a running session. Below it, every ended session,
read-only and uncapped, each row naming itself `Wed 26 Aug · Americano · 11 players` with the
winner, because a padel night is identified by when it was and who won it and the wizard therefore
asks for no name. Opening a row replays its rounds and its final table with nothing on screen to
tap; deleting one is behind a confirmation and is the hard delete decision #10 promises. The
Players tab and the other two modes are the slices after this one.

Every string the organizer reads comes from one typed dictionary and every colour from one token
file with a light and a dark value (ADR-0018); `npm run verify:conventions` proves no template has
grown a literal of either kind. The screens are tested by rendering the whole app and driving it
by typing and tapping — never by reaching for a component or a signal.

All 26 design decisions — modes, scoring, fairness rules, data model, stack and build order —
live in **[docs/DECISIONS.md](docs/DECISIONS.md)**. That file is the source of truth. If code and
decisions ever disagree, one of them is a bug.

## Stack

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
npm run verify         # format, lint, engine boundary, app conventions, build, tests
npm run print:schedule # build, then print a few schedules to read
```

`print:schedule` takes players, courts and rounds — and a fourth number, how many of those
players are women, which prints the session as Mixicano instead:

```bash
npm run print:schedule -- 10 2 12     # 10 players, 2 courts, 12 rounds of Americano
npm run print:schedule -- 10 2 12 7   # ...as Mixicano, seven women and three men
```

```bash
npm start              # serve padel-app
```

The workspace holds two projects: `projects/padel-engine`, the pure TypeScript rules library, and
`projects/padel-app`, the Angular application that consumes it. The engine may not import Angular
or Firebase, and the app may only reach it through its published entry point; both are enforced by
lint rather than by convention — see
[ADR-0001](docs/adr/0001-enforce-the-engine-boundary-with-eslint.md).

## Build order

1. **`padel-engine` + tests** — no UI. Print schedules, eyeball fairness on awkward rosters.
2. **Angular app, `localStorage` only** — create → generate → score → standings → finish. Usable at a real session. ← *current*
3. **Firebase** — repository implementation, anonymous auth, security rules, share code, QR, spectator view.
4. **PWA polish**, Google account linking, session delete.

Step 2 is deliberately a complete, usable app: swapping `localStorage` for Firestore touches a
single file behind the `SessionRepository` interface.

## Licence

None — all rights reserved.
