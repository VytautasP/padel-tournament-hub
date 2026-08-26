# 13. One active session, and every ended session is kept

- **Status:** Accepted
- **Date:** 2026-08-26
- **Relates to:** decisions #10, #13, #19 and #23 in [docs/DECISIONS.md](../DECISIONS.md)

## Context

Step 2 of the build order is the local-only app: `localStorage` only, create through finish, run a
real padel night on it. That leaves one product question the engine never had to answer — how many
sessions does the app hold at once?

The engine has no opinion. Every operation takes a session and returns one, and `Session.id`
exists because decision #13 stores one document per session. An app could hold exactly one of
those, or a shelf of them, and both are a faithful reading of the model.

The pull in each direction is real. A single-session app has no list screen, no empty state and no
delete, but it makes "new session" destructive: last Tuesday's podium is gone the moment this
Tuesday starts. A free-for-all of concurrent sessions removes that, but it makes "resume" a
question rather than an action, and it lets three half-finished evenings accumulate with nothing
to distinguish the one that matters.

## Decision

**1. At most one session is in progress at a time.** The landing page shows a Resume card when one
exists, and hides New session entirely while it does. Offering an action the model cannot honour
invites a dead end; the way to start an evening is to end the one you are in.

**2. Every ended session is kept, read-only, forever.** Ending moves the session to **session
history**, a list on the landing page. Nothing there can be scored, regenerated or repaired —
`status: 'finished'` already means the engine takes no further operations (decision #8), and the
app simply renders that state.

**3. An abandoned session is discarded explicitly.** An evening that stops without an ending is
still the active session, and the only way past it is **Discard**, in the Resume card's overflow.
It is on the landing page rather than inside the session so it cannot be reached courtside.

**4. A history entry names itself.** `Tue 26 Aug · Americano · 11 players`, with the winner.
There is no name field in the wizard: a padel night is identified by when it was and who won it,
and taxing every creation with a naming step to serve a recall problem the date already solves is
the wrong trade. Delete lives behind a per-row confirm, because decision #10 promises hard delete
and history is the only place that promise can be kept.

**5. `SessionRepository` stays addressed by id.** It is not narrowed to a single-document store,
even though at most one document is ever active. Decision #19 exists so the Firestore swap in step
3 is a swap; a repository shaped around the app's current cardinality would have to be rewritten
the moment sessions become shareable.

## Consequences

- History is uncapped and unpaged. A padel night a week for a year is 52 rows, which is a list,
  not a dataset.
- `localStorage` now holds an unbounded archive rather than one document. At the ~30 KB per
  session decision #13 estimates, a year of play is well inside any browser's quota, but the
  archive is the first thing to look at if that ever stops being true.
- Concurrent evenings are impossible by construction — two courts running two independent sessions
  on one phone is not a thing this app does. If that turns out to be a real request, it reopens
  point 1 and nothing else.
- The first launch has nothing to show: one New session button and one line of copy. No
  onboarding, no illustration.
