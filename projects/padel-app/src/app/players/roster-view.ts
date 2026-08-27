/*
 * The roster as the Players tab renders it: a name, and the two things true of it right now.
 *
 * A plain function for the same reason `round-view.ts` is one — the shape of the list can be
 * checked without rendering it — and, like that one, it derives rather than reads. Neither "is
 * sitting out" nor "has gone home" is a field on a roster entry: the first is the round's line-up
 * seen from the other side, and the second is an availability window that has closed.
 *
 * Sitting out is asked of `bench.ts`, which is the same answer the strip under the courts renders.
 * That is the whole reason that file exists: an organizer reading a strip that says Cara is out
 * and a row that does not is looking at a disagreement they cannot resolve, standing next to Cara.
 */
import type { OrphanedTeam, PlayerId, Session, Team } from 'padel-engine';
import { benchedIn, hasGoneHome } from '../session/bench';
import { MINIMUM_PLAYERS, PLAYERS_PER_TEAM } from '../session/round-defaults';
import { playsAsTeams, teamNameIn, teamOf, teamsIn } from '../session/teams';

/** The fewest teams a round can be scheduled from: one on each side of the net. */
const TEAMS_PER_COURT = 2;

export interface PlayerRow {
  readonly id: PlayerId;
  readonly name: string;
  /** Benched in the round the evening is on, which is the question the badge answers. */
  readonly benched: boolean;
  /** Gone home: their played matches and their standings line stay, no later round holds them. */
  readonly gone: boolean;
  /**
   * The team this player plays for, as a reader knows it, or `null` in a mode that pairs nobody.
   *
   * The name the row shows is still the player's. This is what the actions on the row are
   * addressed to — a partner is assigned to a *team*, not to the person who is short one.
   */
  readonly team: string | null;
  /** That team's id, which is what a repair is addressed to. */
  readonly teamId: string | null;
  /**
   * Whether this is the half of a pair whose partner went home (decision #2b, ADR-0012).
   *
   * The flag is on the player rather than on the team because the Players tab is a list of
   * players, and the row is where the organizer is looking when they notice. What it flags is
   * still a fact about the team: it keeps its slot and its points and takes no court until
   * somebody repairs it.
   */
  readonly needsPartner: boolean;
  /**
   * Whether this player can go home without leaving an evening the engine cannot schedule.
   *
   * Asked per row rather than once for the list, because in Team Americano it is a different
   * question for different people: a round needs two teams with both their players, so the last
   * full half of a third team cannot leave while the stranded half of an orphaned one can. In the
   * modes that rotate partners it is the same answer for everybody — four players fill a court —
   * and the row carries it anyway rather than the screen holding two rules.
   */
  readonly canGoHome: boolean;
}

/**
 * Every player the session knows, in roster order — including the ones who have left.
 *
 * The orphaned teams are handed in rather than derived here: the flag is the engine's answer
 * (`teamsNeedingPartner`), and the store is where this app calls the engine (decision #17).
 */
export function rosterView(
  session: Session,
  roundNumber: number,
  needingPartner: readonly OrphanedTeam[] = [],
): readonly PlayerRow[] {
  const bench = new Set(benchedIn(session, roundNumber).map((entry) => entry.id));
  const stranded = new Set(needingPartner.map((orphaned) => orphaned.playerId));
  const canLeave = departures(session);

  return session.roster.map((entry) => {
    const team = teamOf(session, entry.id);

    return {
      id: entry.id,
      name: entry.name,
      benched: bench.has(entry.id),
      gone: hasGoneHome(entry),
      team: team ? teamNameIn(session, team) : null,
      teamId: team?.id ?? null,
      needsPartner: stranded.has(entry.id),
      canGoHome: canLeave(entry.id, team),
    };
  });
}

/**
 * Who this evening can afford to lose — the engine's staffing rule, asked one round early.
 *
 * The engine refuses a removal that would leave a round it cannot staff (decision #4, #2b), and
 * refusing is the wrong shape for a screen: the organizer would tap Went home and be handed an
 * error about a session they cannot see. So the same arithmetic is done here, and the control is
 * absent rather than offered — which is what the Players tab does with everything it cannot do.
 */
function departures(session: Session): (playerId: PlayerId, team: Team | undefined) => boolean {
  if (!playsAsTeams(session)) {
    const present = session.roster.filter((entry) => !hasGoneHome(entry)).length;

    return () => present > MINIMUM_PLAYERS;
  }

  const isFull = (team: Team): boolean =>
    team.playerIds.filter((id) => isHere(session, id)).length === PLAYERS_PER_TEAM;
  const full = teamsIn(session).filter(isFull).length;

  // Losing a player costs the evening a team only where their team still had both halves. The
  // stranded half of an orphaned team can always go home: their team was taking no court anyway.
  return (_playerId, team) => full - (team && isFull(team) ? 1 : 0) >= TEAMS_PER_COURT;
}

function isHere(session: Session, playerId: PlayerId): boolean {
  const entry = session.roster.find((candidate) => candidate.id === playerId);

  return entry !== undefined && !hasGoneHome(entry);
}
