/*
 * The pairs a Team Americano evening plays as, asked of the document the app is holding.
 *
 * Which team a player is on, and what a team is called: the two questions a screen asks that the
 * engine has no reason to answer, because both are about rendering rather than about scheduling.
 *
 * Everything that *is* about scheduling is asked of the engine instead — who is on a bye is
 * `teamsOnByeIn`, who needs a partner is `teamsNeedingPartner` — so a team's line-up is read
 * against the availability windows in exactly one place (ADR-0012). A second reading of a window
 * is a second chance to read it differently, and the strip under the courts and the schedule
 * disagreeing about who is playing is a bug the organizer cannot resolve, standing next to them.
 */
import type { PlayerId, Session, Team, TeamId } from 'padel-engine';
import { copy } from '../copy/copy';

/** Whether this session's competitor is a pair rather than a person. */
export function playsAsTeams(session: Session): boolean {
  return session.mode === 'team-americano';
}

/** The teams, in the order the organizer paired them. Empty in the modes that rotate partners. */
export function teamsIn(session: Session): readonly Team[] {
  return session.teams ?? [];
}

/**
 * The team this player plays for, or `undefined` where the mode pairs nobody.
 *
 * A half a repair replaced still counts: the team they played for is the one their played rounds
 * name, and a row that stopped saying so would be a player the evening no longer places.
 */
export function teamOf(session: Session, playerId: PlayerId): Team | undefined {
  return teamsIn(session).find(
    (team) => team.playerIds.includes(playerId) || (team.formerPlayerIds ?? []).includes(playerId),
  );
}

/**
 * How a team reads to a human: `Ana & Ben`, from the pair it fields now.
 *
 * The half a repair replaced is not in it. A team is named by who plays for it, and a name
 * carrying everybody who ever did would grow all evening.
 */
export function teamNameIn(session: Session, team: Team): string {
  return copy.team.name(
    team.playerIds.map((id) => session.roster.find((entry) => entry.id === id)?.name ?? id),
  );
}

/** The same name, from the id a standings row or a repair is addressed by. */
export function teamNameOf(session: Session, teamId: TeamId): string {
  const team = teamsIn(session).find((candidate) => candidate.id === teamId);

  return team === undefined ? teamId : teamNameIn(session, team);
}
