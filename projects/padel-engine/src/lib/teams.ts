/*
 * The teams a session plays as, and the questions every other module asks about them.
 *
 * Team Americano is Americano one level up (decision #2c): the bench rotation, the opponent
 * variety and the prefix fairness are the same rules, applied to teams instead of players. So
 * this module is to Team Americano what `mixed-pairing.ts` is to Mixicano — the one place that
 * knows what the mode changes, handed to the scheduler, the referee, the standings and the
 * printout so that none of them keeps a second copy of the answer.
 *
 * A mode that rotates partners answers "no teams" to everything here, which is what lets the
 * shared code run unbranched: `plays` is false, the team list is empty, and every lookup misses.
 *
 * Two things are deliberately *not* here. Which team a match was played by is read off the match
 * rather than worked out from the players on it (`Match.teams`), because membership is the
 * mutable part and a played match's record is not. And nothing here validates — the structural
 * rules about pairing a roster live in `session-shape.ts`, next to the rest of them.
 */
import type { PlayerId, RosterEntry, Session, Team, TeamId } from './model';
import { isAvailableIn } from './roster-availability';

/** Players per team — the fixed partnership Team Americano schedules as one unit. */
export const PLAYERS_PER_TEAM = 2;

/** What this session's mode has to say about teams. Empty for the modes that rotate partners. */
export interface TeamPlay {
  /** Does this mode schedule teams rather than players? */
  readonly plays: boolean;
  /** The teams, in the order the organizer paired them. */
  readonly teams: readonly Team[];
  /** The team with this id, if the session has one. */
  byId(id: TeamId): Team | undefined;
  /** How a team reads to a human: `Ana & Ben`, or the id where the players are unknown. */
  nameOf(id: TeamId): string;
}

const NO_TEAMS: TeamPlay = {
  plays: false,
  teams: [],
  byId: () => undefined,
  nameOf: (id) => id,
};

/** The teams this session plays as, read off its mode and its pairing. */
export function teamPlayIn(session: Session): TeamPlay {
  if (session.mode !== 'team-americano') {
    return NO_TEAMS;
  }

  const teams = session.teams ?? [];
  const byId = new Map(teams.map((team) => [team.id, team]));
  const names = new Map(session.roster.map((entry) => [entry.id, entry.name]));

  return {
    plays: true,
    teams,
    byId: (id) => byId.get(id),
    nameOf: (id) => {
      const team = byId.get(id);

      return team ? team.playerIds.map((player) => names.get(player) ?? player).join(' & ') : id;
    },
  };
}

/**
 * Everyone who has ever played for this team: the pair it fields now, and the halves that have
 * gone home. Membership is the mutable part of a team (decision #2b) and this is the whole of it.
 */
export function membersOf(team: Team): PlayerId[] {
  return [...team.playerIds, ...(team.formerPlayerIds ?? [])];
}

/**
 * Who this team fields in a given round: its members who are in the session for it.
 *
 * Two while the pair is intact, one while it is orphaned, and none once it is retired — which is
 * decision #2b's three states read off the roster rather than stored anywhere. It is asked per
 * round rather than of the session because a repaired team's line-up in round three is not the
 * one it fields in round seven, and the round three matches have to keep reading right.
 */
export function teamLineupIn(
  team: Team,
  roster: readonly RosterEntry[],
  roundNumber: number,
): PlayerId[] {
  const entries = new Map(roster.map((entry) => [entry.id, entry]));

  return membersOf(team).filter((id) => {
    const entry = entries.get(id);

    return entry !== undefined && isAvailableIn(entry, roundNumber);
  });
}

/**
 * The teams this round may schedule: the ones that field a full pair in it.
 *
 * Availability is a fact about players, and a team is only as available as its scarcer half. A
 * team one player short is exactly decision #2b's orphaned team: it keeps its slot, its id and
 * its points, and it takes no court until somebody repairs it.
 */
export function teamsAvailableIn(session: Session, roundNumber: number): Team[] {
  return teamsAvailableAmong(session.teams ?? [], session.roster, roundNumber);
}

/**
 * The same question asked of a roster and a team list on their own, for the scheduler's history —
 * which walks a session it has already taken apart and holds the two halves rather than the whole.
 */
export function teamsAvailableAmong(
  teams: readonly Team[],
  roster: readonly RosterEntry[],
  roundNumber: number,
): Team[] {
  return teams.filter(
    (team) => teamLineupIn(team, roster, roundNumber).length === PLAYERS_PER_TEAM,
  );
}

/**
 * The teams this round benches whole — the bye (CONTEXT.md).
 *
 * A team one player short is in neither this list nor the round: it is orphaned rather than
 * resting, which is a different state said in a different place (`teamsNeedingPartner`). The
 * teams on court are read off `match.teams` rather than worked out from the players standing on
 * it, for the reason ADR-0011 §3 gives — a side is who was on the court, and the team is who they
 * were playing as.
 *
 * Exported because the bye is what a screen shows a human, and every reading of it has to be the
 * same reading: a strip under the courts naming a team the schedule thinks is playing is a bug
 * the organizer cannot resolve, standing next to them.
 */
export function teamsOnByeIn(session: Session, roundNumber: number): Team[] {
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);
  if (!round) {
    return [];
  }

  const onCourt = new Set(
    round.matches.flatMap((match) => (match.teams ? [match.teams.sideA, match.teams.sideB] : [])),
  );

  return teamsAvailableIn(session, roundNumber).filter((team) => !onCourt.has(team.id));
}

/** A team left with one player, and the player the flag is on. */
export interface OrphanedTeam {
  readonly teamId: TeamId;
  /** The half still in the session, flagged `needs partner` (decision #2b). */
  readonly playerId: PlayerId;
}

/**
 * The teams that are one player short as the session stands now — the `needs partner` flag, for
 * whoever is looking at the session and has to decide what to do about it.
 *
 * Read at the last round rather than at the next unplayed one, because that is the state the
 * document is in: a window closes going forwards and never reopens, so a team short a player at
 * the end of the schedule is short one from here on.
 */
export function teamsNeedingPartner(session: Session): OrphanedTeam[] {
  const play = teamPlayIn(session);
  const roundNumber = session.rounds.length;

  return play.teams.flatMap((team) => {
    const lineup = teamLineupIn(team, session.roster, roundNumber);

    return lineup.length === 1 ? [{ teamId: team.id, playerId: lineup[0] }] : [];
  });
}
