/*
 * Scheduling every mode: any roster of four or more, on any number of courts.
 *
 * The generator walks the session in round order, carrying a `SessionHistory` with it. Rounds that
 * are already generated are carried through untouched and folded into that history; empty ones are
 * planned against it. Two things follow from that shape, and they are the point of the design:
 *
 *   - **Fairness is decided at every prefix, not at the end** (decision #6). Each round is planned
 *     knowing only what came before it, so the evening is as fair after round seven as after round
 *     twelve — which matters, because that is when the court time runs out.
 *   - **History is read, not assumed.** Rounds this engine did not generate — a session mid-edit,
 *     a session back from storage — count exactly as much as ones it did. This is what ADR-0004
 *     deferred until bench rotation arrived, and it arrives here.
 *   - **The roster is read per round, not per session** (decision #5). Who is available and how
 *     many courts that staffs are asked at each round rather than once at the top, because people
 *     arrive late and go home early. It is this walk, carrying history across a roster that moves
 *     under it, that lets `addPlayer` and `removePlayer` own no scheduling of their own.
 *
 * Neither of the other two modes is a second walk. Mixicano is this one carrying a `MixedPairing`
 * — the mode's answer to "are these two the same gender?" — down into the round planner, where it
 * becomes one more term in the cost function. Team Americano is this one asking the same questions
 * of teams instead of players (decision #2c): the unit it rotates onto the bench and across the
 * net is a team, so `planTeamRound` answers where `planRound` would, and everything around it —
 * the walk, the history, the prefix fairness, the ids — is unchanged.
 *
 * The planners decide who sits out and who plays whom; this file is the walk, the ids and the
 * copying. The rotation is seeded from the session id, so two sessions do not open with the same
 * fixture list and the same session always schedules identically.
 *
 * Everything below is private: only `generateRemaining` is exported from the library.
 */
import { matchId } from './create-session';
import { deepFreeze } from './freeze';
import { mixedPairingIn } from './mixed-pairing';
import type { MixedPairing } from './mixed-pairing';
import type { Match, PlayerId, Round, Session, TeamId } from './model';
import { planRound } from './plan-round';
import { planTeamRound } from './plan-team-round';
import { availableOf } from './roster-availability';
import { copyRound, copySession } from './session-copy';
import { SessionHistory } from './session-history';
import { assertSessionShape, courtsInPlay } from './session-shape';
import { assertSessionOpen } from './session-status';
import { teamPlayIn, teamsAvailableIn } from './teams';
import type { TeamPlay } from './teams';

export function generateRemaining(session: Session): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'generating rounds');

  const mixed = mixedPairingIn(session);
  const play = teamPlayIn(session);
  const order = seededOrder(
    session.id,
    play.plays ? play.teams.map((team) => team.id) : session.roster.map((entry) => entry.id),
  );
  const history = new SessionHistory(session.roster, mixed, play);
  const rounds: Round[] = [];

  for (const round of session.rounds) {
    // A round that has already been generated is carried through untouched: regeneration never
    // rewrites play that has happened — it schedules around it.
    const filled: Round =
      round.matches.length > 0
        ? copyRound(round)
        : {
            ...round,
            matches: play.plays
              ? buildTeamMatches(session, order, round, history, play)
              : buildMatches(session, order, round, history, mixed),
          };

    history.record(filled);
    rounds.push(filled);
  }

  // Copies all the way down, so freezing the session we return never reaches back and freezes
  // arrays the caller still owns.
  return deepFreeze(copySession(session, rounds));
}

/**
 * The scheduling units — players, or teams where teams are the unit — rotated by an offset
 * derived from the session id, so the schedule is seeded from session data rather than from a
 * clock or a random source.
 */
function seededOrder(sessionId: string, ids: readonly string[]): string[] {
  const offset = fnv1a(sessionId) % ids.length;

  return [...ids.slice(offset), ...ids.slice(0, offset)];
}

/**
 * Plan one empty round, against the players the session holds *at that round*.
 *
 * Both the roster the planner sees and the number of courts it fills are read per round rather
 * than once for the session: a player who has left is not on court after they left, and the
 * courts an evening staffs change with them (decision #5).
 */
function buildMatches(
  session: Session,
  order: readonly PlayerId[],
  round: Round,
  history: SessionHistory,
  mixed: MixedPairing,
): Match[] {
  const available = availableOf(order, session.roster, round.number);

  return planRound(available, courtsInPlay(session, round.number), history, mixed).map(
    (planned, index) => ({
      id: matchId(session.id, round.number, index + 1),
      courtNumber: index + 1,
      sideA: planned.sideA,
      sideB: planned.sideB,
    }),
  );
}

/**
 * Plan one empty round of Team Americano: which teams sit out, and which teams face which.
 *
 * The teams a round may schedule are read per round for the same reason the roster is
 * (decision #5) — a team both of whose players are here is a team that can take the court, and
 * decision #2b's orphaned partner is the case where one is not.
 *
 * A match holds both: the players who are on the court, so every reader that counts players
 * counts them, and the teams they played as, so every reader that counts teams needs no lookup.
 */
function buildTeamMatches(
  session: Session,
  order: readonly TeamId[],
  round: Round,
  history: SessionHistory,
  play: TeamPlay,
): Match[] {
  const here = new Set(teamsAvailableIn(session, round.number).map((team) => team.id));
  const available = order.filter((id) => here.has(id));
  const playersOf = (id: TeamId): readonly [PlayerId, PlayerId] => {
    const team = play.byId(id);
    // The planner is only ever given ids from this session's own teams, so this cannot happen
    // from here — and if it ever does, saying so beats fabricating a match out of a team id.
    if (!team) {
      throw new Error(`Round ${round.number} scheduled team "${id}", which this session has not.`);
    }

    return team.playerIds;
  };

  return planTeamRound(available, courtsInPlay(session, round.number), history).map(
    (planned, index) => ({
      id: matchId(session.id, round.number, index + 1),
      courtNumber: index + 1,
      sideA: playersOf(planned.sideA),
      sideB: playersOf(planned.sideB),
      teams: { sideA: planned.sideA, sideB: planned.sideB },
    }),
  );
}

/** FNV-1a: a small, stable string hash. Same string in, same number out, on every run. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash;
}
