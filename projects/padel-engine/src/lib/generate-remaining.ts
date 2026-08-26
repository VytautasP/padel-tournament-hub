/*
 * Americano and Mixicano scheduling for any roster of four or more, on any number of courts.
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
 * Mixicano is not a second walk. It is this one carrying a `MixedPairing` — the mode's answer to
 * "are these two the same gender?" — down into the round planner, where it becomes one more term
 * in the cost function. Bench rotation, partner variety and prefix fairness are untouched by it.
 *
 * `planRound` decides who sits out and who partners whom; this file is the walk, the ids and the
 * copying. The rotation is seeded from the session id, so two sessions do not open with the same
 * fixture list and the same session always schedules identically.
 *
 * Everything below is private: only `generateRemaining` is exported from the library.
 */
import { matchId } from './create-session';
import { deepFreeze } from './freeze';
import { mixedPairingIn } from './mixed-pairing';
import type { MixedPairing } from './mixed-pairing';
import type { Match, PlayerId, Round, Session } from './model';
import { planRound } from './plan-round';
import { availableOf } from './roster-availability';
import { copyRound, copySession } from './session-copy';
import { SessionHistory } from './session-history';
import { assertSessionShape, courtsInPlay } from './session-shape';
import { assertSessionOpen } from './session-status';

export function generateRemaining(session: Session): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'generating rounds');

  const order = seededOrder(session);
  const mixed = mixedPairingIn(session);
  const history = new SessionHistory(session.roster, mixed);
  const rounds: Round[] = [];

  for (const round of session.rounds) {
    // A round that has already been generated is carried through untouched: regeneration never
    // rewrites play that has happened — it schedules around it.
    const filled: Round =
      round.matches.length > 0
        ? copyRound(round)
        : { ...round, matches: buildMatches(session, order, round, history, mixed) };

    history.record(filled);
    rounds.push(filled);
  }

  // Copies all the way down, so freezing the session we return never reaches back and freezes
  // arrays the caller still owns.
  return deepFreeze(copySession(session, rounds));
}

/**
 * The roster ids rotated by an offset derived from the session id, so the schedule is seeded
 * from session data rather than from a clock or a random source.
 */
function seededOrder(session: Session): PlayerId[] {
  const ids = session.roster.map((entry) => entry.id);
  const offset = fnv1a(session.id) % ids.length;

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

/** FNV-1a: a small, stable string hash. Same string in, same number out, on every run. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash;
}
