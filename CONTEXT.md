# Padel Tournament Hub

One evening of social padel, run from one person's phone. This context covers everything from
naming the players to declaring a podium — the rotating formats, the fairness rules that make a
rotation acceptable to the people standing on the court, and the leaderboard that comes out of it.

The split between `padel-engine` and `padel-app` is a code boundary, not a domain boundary. Both
speak the language below.

## Language

### The evening

**Session**:
One evening of play: a roster, a mode, a set of courts and the rounds they play. The whole thing
lives in a single document.
_Avoid_: Tournament, event, game, match (a match is one court's play)

**Organizer**:
The one person who creates the session and enters every score. Everyone else only watches.
_Avoid_: Admin, host, owner, referee (the referee is the engine's validator)

**Mode**:
Which format the session plays: Americano, Mixicano or Team Americano. Fixed at creation.
_Avoid_: Format, type, variant

**Roster**:
The players this session knows, by first name. A roster entry is a name with an id and the stretch
of the evening the player is present for — not a person, not an account.
_Avoid_: Squad, participants, attendees, players list

**Target score**:
The fixed point total every match adds up to. The organizer enters one side's points and the other
side's are derived from it, so a scoreline that does not sum to the target cannot be built.
_Avoid_: Points to win, max score, game to

**Active session**:
The one session currently in progress. There is never more than one; the way to start another is
to end or discard this one.
_Avoid_: Current session, live session, open session

**End session**:
The organizer declaring the evening over. It freezes the session — no more scores, no more
regeneration — and produces the podium. Nothing else ends a session: not a clock, not the last
court finishing.
_Avoid_: Finish, close, complete, stop (a *match* finishes; the session ends)

**Session history**:
Every ended session, kept read-only. A session enters history by being ended, and leaves it only
by being deleted.
_Avoid_: Archive, past sessions, log

### Play

**Round**:
One slate of simultaneous matches, one per court, plus whoever is benched. Rounds are numbered from
one.
_Avoid_: Game, rotation, leg

**Match**:
One court's play within a round: two sides of two players, and a score once someone enters it.
_Avoid_: Game, fixture, tie

**Score sheet**:
The sheet a court opens into, holding that one match's two numbers. Either side can be typed into
and the other is derived from the target score, so one number is entered and one number is
recorded. A court that already has a score reopens it at that score — correcting a typo is the
ordinary path, not a separate action.
_Avoid_: Score dialog, score modal, score entry form, edit score

**Court name**:
What the organizer calls a court, so that four people walk to the right one — a club's court 7 is
court 7, not court 1. A label only; the court's identity is its number within the round.
_Avoid_: Court label, court title, pitch

**Side**:
The two players on one half of a court, called A and B. In the rotating modes a side is a pairing
for one round and belongs to nobody; in Team Americano it is a team's line-up for that round.
_Avoid_: Team (reserved for Team Americano), pair (means the fixed partnership)

**Bench**:
The players not on a court in a given round, because the roster does not divide evenly into courts.
A player on the bench is **benched**; benching costs them nothing in the standings.
_Avoid_: Sitting out, resting, sub, waiting list

**Bye**:
A whole team benched for a round in Team Americano. The team-level bench.
_Avoid_: Team bench, sit-out

**Current round**:
The lowest-numbered round that still has a match without a score — where the evening is right now.
Derived from the scores, never stored, and not the same as the last round generated.
_Avoid_: Active round, live round, round pointer

**Went home**:
A player leaving mid-session. Their played matches and their standings line stay; they are simply
not scheduled into any later round. Not a deletion — nothing about the evening so far changes.
_Avoid_: Remove, delete, drop out, deactivate

### Team Americano

**Team**:
Two players who play the whole session as one competitor, paired by the organizer at creation. The
team is what gets scheduled, benched and ranked — everything Americano does to a player.
_Avoid_: Pair (as a noun for the unit), duo, partnership

**Orphaned team**:
A team whose other half went home. It keeps its slot and every point it has already won, and is
marked **needs partner** until a replacement repairs it or the stranded player leaves too. A team
in this state is not scheduled.
_Avoid_: Broken team, incomplete team, half team

### Fairness

**Prefix fairness**:
Fairness that holds after *every* round, not only after the last one. An evening that stops early
has to be as fair as one that runs its course, so bench counts and partner variety are judged at
every round prefix.
_Avoid_: Balance, evenness (unqualified)

**Same-gender pair**:
A Mixicano side whose two players share a gender, played only when the roster forces it. Marked in
the schedule and rotated, so the same two people are not the ones compromised every round.
_Avoid_: Unmixed pair, non-mixed pair, exception

### The table

**Standings**:
The leaderboard, ranked by points per match played and derived from the recorded scores on every
read. Never stored, so a corrected score recomputes for free.
_Avoid_: Leaderboard, table, rankings, results

**Points per match**:
A competitor's points divided by the matches they have actually played. The ranking figure, chosen
so that sitting out neither costs nor gains position.
_Avoid_: Average, PPM, score rate

**Joint position**:
A place shared by competitors who are still level after every tie-break the evidence supports. The
places a joint position occupies are used up: a joint second is followed by fourth. List order
within a joint position means nothing.
_Avoid_: Tie, draw, shared rank
