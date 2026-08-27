/*
 * The pairs a Team Americano evening plays as, asked of the document the app is holding.
 *
 * The engine owns the rules about teams and keeps them to itself: what it exports is the flag on
 * an orphaned one and the table teams are ranked in, not the lookups a screen needs to render a
 * bye strip or name a row. So this is the app's side of `padel-engine/lib/teams.ts` — the same
 * questions, asked of the same fields, for the two screens that show a team to a human.
 *
 * Nothing here is stored. A team's line-up in a round is its members read against the roster's
 * availability windows, exactly as the engine reads it (ADR-0012), which is what keeps a repaired
 * team's round three reading right after its round seven has changed.
 */
import type { RosterEntry, Session, Team } from 'padel-engine';
import { copy } from '../copy/copy';
import { isHereForRound } from './bench';
import { PLAYERS_PER_TEAM } from './round-defaults';

/** Whether this session's competitor is a pair rather than a person. */
export function playsAsTeams(session: Session): boolean {
  return session.mode === 'team-americano';
}

/** The teams, in the order the organizer paired them. Empty in the modes that rotate partners. */
export function teamsIn(session: Session): readonly Team[] {
  return session.teams ?? [];
}

/** The team this player plays for, or `undefined` where the mode pairs nobody. */
export function teamOf(session: Session, playerId: string): Team | undefined {
  return teamsIn(session).find((team) => membersOf(team).includes(playerId));
}

/**
 * How a team reads to a human: `Ana & Ben`, from the pair it fields now.
 *
 * The half a repair replaced is not in it. A team is named by who plays for it, and a name
 * carrying everybody who ever did would grow all evening.
 */
export function teamNameIn(session: Session, team: Team): string {
  const names = new Map(session.roster.map((entry) => [entry.id, entry.name]));

  return copy.team.name(team.playerIds.map((id) => names.get(id) ?? id));
}

/**
 * The teams this round leaves off a court with both their players available — the bye
 * (CONTEXT.md).
 *
 * A team one player short is not on a bye: it is orphaned, which is a different thing said in a
 * different place (`needs partner`, on the Players tab). Reading the scheduled teams off
 * `match.teams` rather than off the players on court is the same choice the engine's standings
 * make, and for the same reason — a side is who was on the court, and the team is who they were
 * playing as.
 */
export function teamsOnByeIn(session: Session, roundNumber: number): readonly Team[] {
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);
  if (round === undefined) {
    return [];
  }

  const onCourt = new Set(
    round.matches.flatMap((match) => (match.teams ? [match.teams.sideA, match.teams.sideB] : [])),
  );

  return teamsIn(session).filter(
    (team) =>
      !onCourt.has(team.id) &&
      lineupIn(session.roster, team, roundNumber).length === PLAYERS_PER_TEAM,
  );
}

/** Everyone who has played for this team: the pair it fields now, and the halves that have left. */
function membersOf(team: Team): readonly string[] {
  return [...team.playerIds, ...(team.formerPlayerIds ?? [])];
}

/** Who this team can field in a round: its members who are in the session for it. */
function lineupIn(
  roster: readonly RosterEntry[],
  team: Team,
  roundNumber: number,
): readonly string[] {
  const entries = new Map(roster.map((entry) => [entry.id, entry]));

  return membersOf(team).filter((id) => {
    const entry = entries.get(id);

    return entry !== undefined && isHereForRound(entry, roundNumber);
  });
}
