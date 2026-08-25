# padel-engine

The rules engine for padel sessions: scheduling, scoring and standings for Americano, Mixicano and
Team Americano. It is the only part of the system that knows what padel is.

Nothing is implemented yet — this is the empty shell the rest of the engine tickets land in.

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
| `npm run build:engine`    | Builds the library to `dist/padel-engine`                        |
| `npm run test:engine`     | Runs the engine's unit tests once                                |
| `npm run verify:boundary` | Proves the no-Angular / no-Firebase rules still fail as intended |
