/*
 * The roster moving underneath a session in progress.
 *
 * Someone arrives twenty minutes late; someone twists an ankle and goes home. Neither should
 * derail the evening or corrupt what has already happened, and decision #5 says how: **played
 * rounds are frozen, unplayed rounds are regenerated from history**. That is the whole of this
 * file. `addPlayer` and `removePlayer` differ only in the one line that edits the roster; both
 * hand the amended roster to the same rescheduling, and that rescheduling is what makes them
 * safe rather than any care taken in either one.
 *
 * Three things are worth saying about the shape.
 *
 *   - **A departing player is not deleted.** Their entry stays on the roster with a closed
 *     availability window, so the matches they played still have a name on them, still count
 *     toward everyone else's standings, and still appear on the printout. Removing the entry
 *     would leave those matches naming an id the session no longer knows — which is exactly the
 *     corruption decision #9's stable ids exist to prevent.
 *   - **The freeze line is the last round anyone has scored**, not the last round generated.
 *     Generated is a schedule; scored is play that happened. A round generated for eight players
 *     but never played is a plan, and plans are what a roster change is entitled to redraw.
 *   - **Neither operation schedules anything itself.** `generateRemaining` walks the session from
 *     round one carrying the history of the frozen rounds, so the rounds it redraws are planned
 *     against everything that has actually been played — including the matches of the player who
 *     has just gone home. This is the same delegation `addRound` makes, for the same reason.
 */
import { rosterEntry } from './create-session';
import { generateRemaining } from './generate-remaining';
import type { PlayerId, RosterEntry, Session } from './model';
import { hasLeft, joinedAtRound } from './roster-availability';
import { copyRound, copySession } from './session-copy';
import { assertSessionShape } from './session-shape';
import { assertSessionOpen } from './session-status';
import { teamPlayIn } from './teams';

/**
 * Take a player onto a session already running. They are scheduled from the first round nobody
 * has played yet, and into none of the rounds behind it.
 */
export function addPlayer(session: Session, player: RosterEntry): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'adding a player');
  assertPairsCanStayIntact(session, 'adding a player');

  if (session.roster.some((entry) => entry.id === player.id)) {
    throw new Error(`Player "${player.id}" is already on the roster.`);
  }

  // Built the same way creation builds one, so a gender arrives with a late player exactly as it
  // arrives with an original one — and is demanded of them by the same shape check, which the
  // reschedule below runs.
  const arriving: RosterEntry = {
    ...rosterEntry(player),
    joinedAtRound: firstUnplayedRound(session),
  };

  return rescheduled(session, [...session.roster, arriving]);
}

/**
 * Take a player out of a session already running. Every round they have played stays exactly as
 * it is; no round still to come holds them.
 */
export function removePlayer(session: Session, playerId: PlayerId): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'removing a player');
  assertPairsCanStayIntact(session, 'removing a player');

  const leaving = session.roster.find((entry) => entry.id === playerId);
  if (!leaving) {
    throw new Error(`Player "${playerId}" is not on the roster.`);
  }
  if (hasLeft(leaving)) {
    throw new Error(`Player "${playerId}" has already left the session.`);
  }

  // A player who leaves before the round they arrived for gets a window that never opened,
  // rather than one that closes before it opens.
  const leftAfterRound = Math.max(firstUnplayedRound(session) - 1, joinedAtRound(leaving) - 1);

  return rescheduled(
    session,
    session.roster.map((entry) => (entry.id === playerId ? { ...entry, leftAfterRound } : entry)),
  );
}

/**
 * Team Americano refuses a roster change, for now, and says so at the moment it is asked.
 *
 * The two operations here are built on the roster being a flat list: a player arrives with an
 * open window, a player leaves with a closed one, and the generator reschedules around both. A
 * paired roster does not work that way. Removing one half of a pair leaves the other half a
 * player without a partner, and decision #2b has a whole state for them — flagged `needs partner`,
 * their team skipped in regenerated rounds until it is repaired, and its points kept. Adding a
 * player is the same problem from the other end: one arrival is half a team.
 *
 * That state is the next ticket, and until it exists the honest answer is this error rather than
 * a session quietly rescheduled around a team the engine no longer understands.
 */
function assertPairsCanStayIntact(session: Session, action: string): void {
  if (teamPlayIn(session).plays) {
    throw new Error(
      `Team Americano cannot take a roster change yet — ${action} would leave a player ` +
        'without their partner.',
    );
  }
}

/**
 * The session with a new roster: played rounds carried through untouched, everything after them
 * emptied and handed back to the generator.
 *
 * Emptying rather than amending is the point. There is no partial repair of a round planned for
 * a roster that no longer exists — the generator plans it again from the history in front of it,
 * which is the same code path that produced it the first time and holds it to the same fairness
 * at the same prefix.
 */
function rescheduled(session: Session, roster: readonly RosterEntry[]): Session {
  const frozenThrough = firstUnplayedRound(session) - 1;
  const rounds = session.rounds.map((round) =>
    round.number <= frozenThrough ? copyRound(round) : { ...round, matches: [] },
  );

  return generateRemaining({ ...copySession(session, rounds), roster });
}

/**
 * The first round nobody has scored — the round a roster change takes effect from.
 *
 * Read as one past the *last* scored round rather than as the first unscored one, because courts
 * finish in whatever order they finish: a round three whose second court is still playing is
 * still a round that has been played, and nothing in it may be redrawn.
 */
function firstUnplayedRound(session: Session): number {
  const played = session.rounds.filter((round) =>
    round.matches.some((match) => match.score !== undefined),
  );

  return (played.at(-1)?.number ?? 0) + 1;
}
