# padel-engine

The rules engine for padel sessions: scheduling, scoring and standings for Americano, Mixicano and
Team Americano. It is the only part of the system that knows what padel is.

It schedules **all three modes for any roster of four or more** on any number of courts, with the
bench rotating evenly, records the results and ranks them.

```ts
createSession(config);          // an organizer's configuration -> a session with empty rounds
generateRemaining(session);     // fill every ungenerated round -> a new session
addRound(session);              // one more round on the end -> a new session
addPlayer(session, entry);      // someone arrives late -> a new session, rescheduled
removePlayer(session, id);      // someone goes home -> a new session, rescheduled
recordScore(session, entry);    // one side's points for one match -> a new session
computeStandings(session);      // the leaderboard, derived on every call
computeTeamStandings(session);  // the same ladder, for the teams of a Team Americano session
finishSession(session);         // the organizer closes the evening
assertSessionValid(session);    // throw unless every invariant holds, at every round prefix
formatSchedule(session);        // the session as text a human can read
sameGenderSides(session, match) // which sides Mixicano had to pair same-gender
```

Who sits out and who partners whom is decided round by round against the history of the rounds
before it, so the evening is as fair after round seven as after round twelve. Bench counts are held
within one by construction; partner and opponent repeats are costs a bounded search minimises
(ADR-0006). Nothing reads a clock or a random source: the player rotation is seeded from the
session id, so the same input always yields the same schedule.

## Mixicano

`mode: 'mixicano'` wants every pair mixed-gender, and needs a `gender` on every roster entry to
know what that means. It is the same scheduler: bench rotation, partner variety and prefix
fairness are untouched, and mixing is one more term in the cost function (ADR-0010).

Real rosters do not split evenly, so seven women and three men fill the courts with mixed pairs
and let the surplus play same-gender — **hybrid fill** (decision #7). Two rules govern the
compromise, and the referee checks both at every round prefix. There are never more same-gender
pairs than the players on court force, `|women - men| / 2`. And they rotate: nobody is in one
while a player of their gender is on court, out of one, and has been in fewer.

```ts
sameGenderSides(session, match); // -> ['A'] — side A had nobody left to mix with
```

The mark is derived from the roster rather than stored, so correcting a gender re-marks the whole
schedule instead of leaving stale flags behind. `formatSchedule` stars those pairs.

## Team Americano

`mode: 'team-americano'` fixes the partnerships for the whole evening. The organizer assigns them
at creation and passes them as `teams` — an even roster, every player in exactly one team, checked
on the way in so a bad pairing is refused at the pairing screen rather than three rounds later.

From there it is the same engine with the team as its unit (decision #2c, ADR-0011). Five teams on
two courts bench a whole team each round and rotate the bye; team bench counts stay within one at
every prefix; teams meet every other team before meeting any of them twice. Each match records the
teams that played it, so a team's points follow the team rather than the two names that happened
to be on court:

```ts
computeTeamStandings(session); // -> [{ teamId: 't3', name: 'Elin & Finn', position: 1, ... }]
```

`computeStandings` still works, and reads a player's line as their team's evening under their own
name. A roster change is refused for now: one arrival is half a team, and one departure leaves an
orphaned partner, which is decision #2b's state and its own ticket.

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
npm run print:schedule             # a few sessions worth looking at, benched and skewed
npm run print:schedule -- 12 3 7   # 12 players, 3 courts, 7 rounds
npm run print:schedule -- 10 2 8 7 # ...as Mixicano, seven of the ten women
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
