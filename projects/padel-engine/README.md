# padel-engine

The rules engine for padel sessions: scheduling, scoring and standings for Americano, Mixicano and
Team Americano. It is the only part of the system that knows what padel is.

So far it schedules **Americano for any roster of four or more** on any number of courts, with the
bench rotating evenly, and records the results. Standings, roster mutation, Mixicano and Team
Americano land in later tickets.

```ts
createSession(config);       // an organizer's configuration -> a session with empty rounds
generateRemaining(session);  // fill every ungenerated round -> a new session
recordScore(session, entry); // one side's points for one match -> a new session
assertSessionValid(session); // throw unless every invariant holds, at every round prefix
formatSchedule(session);     // the session as text a human can read
```

Who sits out and who partners whom is decided round by round against the history of the rounds
before it, so the evening is as fair after round seven as after round twelve. Bench counts are held
within one by construction; partner and opponent repeats are costs a bounded search minimises
(ADR-0006). Nothing reads a clock or a random source: the player rotation is seeded from the
session id, so the same input always yields the same schedule.

## Recording scores

The organizer enters one side's points and the engine derives the other from the session target
(decision #3), so an invalid scoreline cannot be constructed:

```ts
recordScore(session, { matchId: 'session-1:r1:c1', side: 'A', points: 15 });
// -> that match is now scored 15-9 against a target of 24
```

Matches are addressed by id, so courts are scored in whatever order they finish, across rounds.
Re-recording replaces a score outright — nothing accumulates — which is what makes correcting a
typo at the side of a court safe (ADR-0007).

Every operation returns a new session and mutates nothing; returned sessions are deep-frozen, so
an accidental write fails loudly instead of corrupting a session document.

## Reading a schedule

`formatSchedule` renders a session as text: a block per round showing each court's match and who is
benched, then a block per player showing who they partnered, who they played and how often they sat
out. It exists for reading, not for asserting — no test asserts on its output, so the format stays
free to change (ADR-0005).

```
npm run print:schedule           # a few sessions worth looking at, including a benched roster
npm run print:schedule -- 12 3 7 # 12 players, 3 courts, 7 rounds
```

## The boundary

`padel-engine` is **pure client-side TypeScript** (decision #11). No Angular, no Firebase, no I/O.
That is what lets the app run offline and the backend stay a plain document store.

The boundary is enforced mechanically, not by convention:

- `projects/padel-engine/eslint.config.js` restricts imports of `@angular/*`, Firebase and Node
  built-ins, so `npm run lint` fails on the first one that appears.
- `npm run verify:boundary` proves those rules actually bite: it pushes deliberate violations
  through the engine's own ESLint config, and then runs `ng lint padel-engine` against a real file
  importing `@angular/core` and fails unless that command exits non-zero.

## Entry point

`src/public-api.ts` is the library's single public entry point. Everything the app may touch is
re-exported from there, and tests consume the engine through that file and nowhere deeper.

## Commands

| Command                   | What it does                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| `npm run build`           | Builds the library to `dist/padel-engine`                           |
| `npm test`                | Runs the engine's unit tests once                                   |
| `npm run verify:boundary` | Proves the no-Angular / no-Firebase rules still fail as intended    |
| `npm run print:schedule`  | Builds, then prints schedules so fairness can be eyeballed          |
