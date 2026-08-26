/*
 * The structural rules a session document must satisfy before anything can be scheduled on it:
 * a mode the engine knows, courts to play on, rounds to fill, and a roster of distinct,
 * identifiable players big enough to fill a court.
 *
 * `createSession` and `assertSessionValid` both run these checks, so a configuration the engine
 * refuses to build is described in exactly the same words as a session that has drifted into
 * the same state.
 */
import type { RosterEntry, Session, SessionMode, Team } from './model';
import { availableIn, hasLeft, joinedAtRound, leftAfterRound } from './roster-availability';
import { membersOf, PLAYERS_PER_TEAM, teamLineupIn, teamPlayIn, teamsAvailableIn } from './teams';

/** Teams per match — one on each side of the net, which is what makes a team the unit. */
export const TEAMS_PER_COURT = 2;

/** Players per match — two per side, four per court. */
export const PLAYERS_PER_COURT = 4;

/**
 * How many courts this session can fill in one particular round.
 *
 * An organizer books courts before they know who turns up, so `courtCount` is an upper bound
 * rather than a promise: six players on two courts play on one court and bench two. Every part
 * of the engine that asks "how many matches does a round have?" asks this, so the scheduler and
 * the referee can never disagree about it.
 *
 * It is asked per round rather than per session because the roster moves underneath the evening
 * (decision #5). Nine players fill two courts; once two of them go home the same session fills
 * one — from the round they left onwards, and not in the rounds they played.
 */
export function courtsInPlay(session: Session, roundNumber: number): number {
  // In Team Americano the unit is the team, and a team needs both its players to take the court.
  // Asking the same question of the teams rather than of the roster is what makes the answer
  // right when one half of a pair has gone home (decision #2b).
  if (teamPlayIn(session).plays) {
    const teams = teamsAvailableIn(session, roundNumber).length;

    return Math.min(session.courtCount, Math.floor(teams / TEAMS_PER_COURT));
  }

  const available = availableIn(session, roundNumber).length;

  return Math.min(session.courtCount, Math.floor(available / PLAYERS_PER_COURT));
}

export function assertSessionShape(session: Session): void {
  if (session.id.trim() === '') {
    throw new Error('A session needs an id.');
  }
  if (!MODES.includes(session.mode)) {
    throw new Error(`Unknown session mode "${String(session.mode)}".`);
  }
  if (session.status !== 'in-progress' && session.status !== 'finished') {
    throw new Error(`Unknown session status "${String(session.status)}".`);
  }
  if (!isPositiveInteger(session.courtCount)) {
    throw new Error('A session needs at least one court.');
  }
  if (!isPositiveInteger(session.targetScore)) {
    throw new Error('The target score must be a positive whole number.');
  }
  if (session.rounds.length === 0) {
    throw new Error('A session needs at least one round.');
  }

  const seenPlayerIds = new Set<string>();
  for (const entry of session.roster) {
    if (entry.id.trim() === '') {
      throw new Error('Every roster entry needs a stable id.');
    }
    if (entry.name.trim() === '') {
      throw new Error(`Roster entry "${entry.id}" needs a name.`);
    }
    if (seenPlayerIds.has(entry.id)) {
      throw new Error(`Duplicate roster id "${entry.id}" — roster entries need unique ids.`);
    }
    seenPlayerIds.add(entry.id);
    assertWindowSound(entry);
    assertGenderSound(entry, session.mode);
  }

  // Four players fill one court; below that there is no match to schedule. Above it any roster
  // is schedulable — whoever does not fit onto a court is benched, and the bench rotates.
  if (session.roster.length < PLAYERS_PER_COURT) {
    throw new Error(
      `A session needs at least ${PLAYERS_PER_COURT} players — ` +
        `the roster has ${session.roster.length}.`,
    );
  }

  assertTeamsSound(session);

  session.rounds.forEach((round, index) => {
    if (round.number !== index + 1) {
      throw new Error(`Round at position ${index + 1} is numbered ${round.number}.`);
    }
  });

  const seenRoundIds = new Set<string>();
  for (const round of session.rounds) {
    if (seenRoundIds.has(round.id)) {
      throw new Error(`Duplicate round id "${round.id}".`);
    }
    seenRoundIds.add(round.id);
  }

  assertEveryRoundStaffable(session);
}

/**
 * A player's availability window has to describe a stretch of the evening that could exist.
 *
 * The one window that looks wrong and is not is `leftAfterRound === joinedAtRound - 1`: a player
 * added and then removed before either of them played a round. They were here, briefly, and the
 * document says so.
 */
function assertWindowSound(entry: RosterEntry): void {
  if (entry.joinedAtRound !== undefined && !isPositiveInteger(entry.joinedAtRound)) {
    throw new Error(`Roster entry "${entry.id}" joins at round ${entry.joinedAtRound}.`);
  }
  if (entry.leftAfterRound !== undefined && !isWholeNumber(entry.leftAfterRound)) {
    throw new Error(`Roster entry "${entry.id}" leaves after round ${entry.leftAfterRound}.`);
  }
  if (leftAfterRound(entry) < joinedAtRound(entry) - 1) {
    throw new Error(`Roster entry "${entry.id}" leaves before it joins.`);
  }
}

/**
 * Every round slot has the players to fill a court — including the ones not generated yet.
 *
 * Checking the ungenerated rounds too is what makes a roster change refuse itself: removing the
 * fifth of five players leaves a session whose remaining rounds cannot be scheduled, and the
 * honest moment to say so is when the organizer taps Remove, not when the generator runs.
 */
function assertEveryRoundStaffable(session: Session): void {
  // In Team Americano the unit is the team, and four players who are two orphaned halves of two
  // different teams staff nothing. So the count that matters is the one the round schedules from
  // (decision #2b) — which is also what makes removing the wrong player refuse itself rather than
  // leave an evening with nobody able to take the court.
  if (teamPlayIn(session).plays) {
    for (const round of session.rounds) {
      const teams = teamsAvailableIn(session, round.number).length;
      if (teams < TEAMS_PER_COURT) {
        throw new Error(
          `Round ${round.number} has ${teams} team(s) available — ` +
            `a round needs at least ${TEAMS_PER_COURT} teams with both their players.`,
        );
      }
    }

    return;
  }

  for (const round of session.rounds) {
    const available = availableIn(session, round.number).length;
    if (available < PLAYERS_PER_COURT) {
      throw new Error(
        `Round ${round.number} has ${available} player(s) available — ` +
          `a session needs at least ${PLAYERS_PER_COURT} players.`,
      );
    }
  }
}

/**
 * Mixicano pairs across gender, so it needs one on every entry — and it needs it at the moment
 * the session is built rather than at the moment the generator trips over a player it cannot
 * classify. Americano has no use for the field and does not insist on it, but will not take a
 * value it does not understand either: a typo in a stored document is a defect in both modes.
 */
function assertGenderSound(entry: RosterEntry, mode: SessionMode): void {
  if (entry.gender !== undefined && entry.gender !== 'woman' && entry.gender !== 'man') {
    throw new Error(`Roster entry "${entry.id}" has an unknown gender "${String(entry.gender)}".`);
  }
  if (mode === 'mixicano' && entry.gender === undefined) {
    throw new Error(`Mixicano needs a gender on every roster entry — "${entry.id}" has none.`);
  }
}

/**
 * The pairing Team Americano schedules from: every player in exactly one team, and no team in
 * the modes that have none.
 *
 * Checked here rather than in the scheduler because the organizer pairs the roster on a screen at
 * creation (decision #2a), and the honest moment to say that seven people cannot pair up is while
 * they are still standing at that screen — not three rounds into the evening. It is a property of
 * the document rather than of a prefix, so like every other rule in this file it is checked over
 * the whole roster at once.
 *
 * "Every player in exactly one team" is the whole of the rule, and it is what makes an odd roster
 * refuse itself: the seventh of seven is in no team, and the error says so by name. The roster
 * size is deliberately not checked on its own — a session that has lost a player and gained a
 * replacement (decision #2b) carries both of them and is legitimately odd.
 *
 * A player who has gone home keeps their team, whether as the half still named on it or as a
 * former member a repair replaced (decision #2b): their team's played matches still count for it,
 * and what a half-empty team does to the rounds still to come is the scheduler's business rather
 * than this check's.
 */
function assertTeamsSound(session: Session): void {
  // The one place that reads the mode itself rather than asking `teamPlayIn`: this check is what
  // decides whether a document *is* a team session, so it cannot be built on an answer derived
  // from the document being sound already.
  if (session.mode !== 'team-americano') {
    if (session.teams !== undefined) {
      throw new Error(`Only Team Americano has teams — this session is ${session.mode}.`);
    }

    return;
  }

  if (session.teams === undefined || session.teams.length === 0) {
    throw new Error('Team Americano needs its players paired into teams.');
  }

  const entries = new Map(session.roster.map((entry) => [entry.id, entry]));
  const teamsPerPlayer = new Map<string, number>();
  const seenTeamIds = new Set<string>();

  for (const team of session.teams) {
    if (team.id.trim() === '') {
      throw new Error('Every team needs a stable id.');
    }
    if (seenTeamIds.has(team.id)) {
      throw new Error(`Duplicate team id "${team.id}" — teams need unique ids.`);
    }
    seenTeamIds.add(team.id);

    if (team.playerIds[0] === team.playerIds[1]) {
      throw new Error(`Team "${team.id}" needs two different players.`);
    }

    const members = membersOf(team);
    if (new Set(members).size !== members.length) {
      throw new Error(`Team "${team.id}" names the same player twice.`);
    }
    for (const playerId of members) {
      if (!entries.has(playerId)) {
        throw new Error(`Team "${team.id}" names "${playerId}", who is not on the roster.`);
      }
      teamsPerPlayer.set(playerId, (teamsPerPlayer.get(playerId) ?? 0) + 1);
    }

    // A former member is by definition somebody who has gone home; one still in the session would
    // be a third player the team could field, which is not a thing a pair can be.
    for (const playerId of team.formerPlayerIds ?? []) {
      const entry = entries.get(playerId);
      if (entry && !hasLeft(entry)) {
        throw new Error(
          `Team "${team.id}" holds "${playerId}" as a former player, but they have not left.`,
        );
      }
    }

    assertLineupIsAPair(session, team);
  }

  for (const entry of session.roster) {
    const teams = teamsPerPlayer.get(entry.id) ?? 0;
    if (teams === 0) {
      throw new Error(`Player "${entry.id}" is in no team — every player plays for one.`);
    }
    if (teams > 1) {
      throw new Error(`Player "${entry.id}" is in ${teams} teams — every player plays for one.`);
    }
  }
}

/**
 * A team fields at most two players in any round it could play.
 *
 * The windows are what keep that true across a repair — the half who left closed theirs before
 * the replacement opened one — so this is the check that the two never overlap. Fewer than two is
 * not an error here: one is an orphaned team and none is a retired one, both of which are states
 * decision #2b allows a session to be in.
 */
function assertLineupIsAPair(session: Session, team: Team): void {
  for (const round of session.rounds) {
    const lineup = teamLineupIn(team, session.roster, round.number);
    if (lineup.length > PLAYERS_PER_TEAM) {
      throw new Error(
        `Team "${team.id}" fields ${lineup.length} players in round ${round.number} — ` +
          `a team is ${PLAYERS_PER_TEAM} players.`,
      );
    }
  }
}

const MODES: readonly SessionMode[] = ['americano', 'mixicano', 'team-americano'];

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
