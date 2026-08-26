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
 * The teams this round may schedule: the ones both of whose players are in the session for it.
 *
 * Availability is a fact about players, and a team is only as available as its scarcer half —
 * which is the shape decision #2b's orphaned partner will slot into: a team missing a player is
 * a team that cannot take the court.
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
  const entries = new Map(roster.map((entry) => [entry.id, entry]));
  const here = (id: PlayerId): boolean => {
    const entry = entries.get(id);

    return entry !== undefined && isAvailableIn(entry, roundNumber);
  };

  return teams.filter((team) => team.playerIds.every(here));
}
