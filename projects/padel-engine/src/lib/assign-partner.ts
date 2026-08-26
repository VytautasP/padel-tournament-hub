/*
 * Repairing a team that has lost half its pair.
 *
 * When one half of a Team Americano pair goes home, the other is stranded: they cannot play,
 * because a team is two people, but throwing them out of the evening would be wrong and voiding
 * their team's results would be worse. So the team keeps its slot and its id, the player left
 * behind is flagged `needs partner`, and the team takes no court until somebody turns up
 * (decision #2b). This is the turning up.
 *
 * Two things make it a small operation rather than a large one.
 *
 *   - **The points look after themselves.** A match records the team a side played *as*
 *     (ADR-0011), and the id is what the standings count. Repairing a team changes who it fields,
 *     not who it is, so every point it won before the repair is still its own — and, just as
 *     importantly, every other team's points per match is untouched, because no match has been
 *     taken away from anybody.
 *   - **The scheduling looks after itself.** Like `addPlayer` and `removePlayer`, this schedules
 *     nothing: it amends the roster and the pairing and hands both to the same rescheduling they
 *     use, which freezes the rounds that have been played and plans the rest from the history in
 *     front of it. The repaired team reappears because it can field a pair again, and for no
 *     other reason.
 *
 * The half who left stays on the team as a former member rather than being dropped from it. Their
 * window is closed, so they are in no line-up the scheduler can see; but the rounds they played
 * still field them under this team's name, and the referee holds a side to the team it was in
 * *that* round. Drop them and every one of those rounds reads as a forgery.
 */
import { firstUnplayedRound, rescheduled } from './change-roster';
import { rosterEntry } from './create-session';
import type { PlayerId, RosterEntry, Session, Team, TeamId } from './model';
import { assertSessionShape } from './session-shape';
import { assertSessionOpen } from './session-status';
import { PLAYERS_PER_TEAM, teamLineupIn, teamPlayIn } from './teams';

/**
 * Give a team that is one player short a new partner, from the first round nobody has played yet.
 *
 * The arriving player is new to the session — the format has no spare players standing around,
 * because everybody on the roster is already in a team.
 */
export function assignPartner(session: Session, teamId: TeamId, player: RosterEntry): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'assigning a partner');

  const play = teamPlayIn(session);
  if (!play.plays) {
    throw new Error(
      `Only Team Americano pairs players into teams — this session is ${session.mode}.`,
    );
  }

  const team = play.byId(teamId);
  if (!team) {
    throw new Error(`This session has no team "${teamId}".`);
  }
  if (session.roster.some((entry) => entry.id === player.id)) {
    throw new Error(`Player "${player.id}" is already on the roster.`);
  }

  // The repair takes effect where every roster change does: at the first round nobody has scored.
  // So that is also the round the team is asked about — who it can field *now*, not who it could
  // field in round one.
  const from = firstUnplayedRound(session);
  const lineup = teamLineupIn(team, session.roster, from);
  if (lineup.length >= PLAYERS_PER_TEAM) {
    throw new Error(`Team "${teamId}" already has two players.`);
  }
  if (lineup.length === 0) {
    throw new Error(`Team "${teamId}" has no player left to partner — it has retired.`);
  }

  const arriving: RosterEntry = { ...rosterEntry(player), joinedAtRound: from };

  return rescheduled(
    session,
    [...session.roster, arriving],
    play.teams.map((existing) =>
      existing.id === teamId ? repaired(existing, lineup[0], arriving.id) : existing,
    ),
  );
}

/** The team fielding the half that stayed and the partner who arrived, with the half that left kept. */
function repaired(team: Team, staying: PlayerId, arriving: PlayerId): Team {
  const departed = team.playerIds.filter((id) => id !== staying);

  return {
    id: team.id,
    playerIds: [staying, arriving],
    formerPlayerIds: [...(team.formerPlayerIds ?? []), ...departed],
  };
}
