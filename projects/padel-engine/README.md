# padel-engine

The rules engine for padel sessions: scheduling, scoring and standings for Americano, Mixicano and
Team Americano. It is the only part of the system that knows what padel is.

So far it schedules **Americano for an exact-fit roster** — 4 players on 1 court, 8 on 2, 12 on 3,
so that nobody is ever benched. Bench rotation, scoring, standings, roster mutation, Mixicano and
Team Americano land in later tickets.

```ts
createSession(config);       // an organizer's configuration -> a session with empty rounds
generateRemaining(session);  // fill every unplayed round -> a new session
assertSessionValid(session); // throw unless every invariant holds, at every round prefix
```

Partners come from the circle method — fix one player, rotate the rest — so over a roster of n
players every partnership is played exactly once in n-1 rounds, and a partnership only repeats
once nobody has an unplayed partner left. Which pair faces which is a small deterministic search
that minimises opponent repeats. Nothing reads a clock or a random source: the player rotation is
seeded from the session id, so the same input always yields the same schedule.

Every operation returns a new session and mutates nothing; returned sessions are deep-frozen, so
an accidental write fails loudly instead of corrupting a session document.

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

| Command                   | What it does                                                     |
| ------------------------- | ---------------------------------------------------------------- |
| `npm run build`           | Builds the library to `dist/padel-engine`                        |
| `npm test`                | Runs the engine's unit tests once                                |
| `npm run verify:boundary` | Proves the no-Angular / no-Firebase rules still fail as intended |
