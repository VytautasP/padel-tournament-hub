/*
 * Americano scheduling for any roster of four or more, on any number of courts.
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
 *
 * `planRound` decides who sits out and who partners whom; this file is the walk, the ids and the
 * copying. The rotation is seeded from the session id, so two sessions do not open with the same
 * fixture list and the same session always schedules identically.
 *
 * Everything below is private: only `generateRemaining` is exported from the library.
 */
import { matchId } from './create-session';
import { deepFreeze } from './freeze';
import type { Match, PlayerId, Round, Session } from './model';
import { planRound } from './plan-round';
import { SessionHistory } from './session-history';
import { assertSessionShape, courtsInPlay } from './session-shape';

export function generateRemaining(session: Session): Session {
  assertSessionShape(session);

  const order = seededOrder(session);
  const history = new SessionHistory(order);
  const courtCount = courtsInPlay(session);
  const rounds: Round[] = [];

  for (const round of session.rounds) {
    // A round that has already been generated is carried through untouched: regeneration never
    // rewrites play that has happened — it schedules around it.
    const filled: Round =
      round.matches.length > 0
        ? copyRound(round)
        : { ...round, matches: buildMatches(session, order, round.number, courtCount, history) };

    history.record(filled);
    rounds.push(filled);
  }

  // Copies all the way down, so freezing the session we return never reaches back and freezes
  // arrays the caller still owns.
  return deepFreeze({
    ...session,
    roster: session.roster.map((entry) => ({ ...entry })),
    rounds,
  });
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

function buildMatches(
  session: Session,
  order: readonly PlayerId[],
  roundNumber: number,
  courtCount: number,
  history: SessionHistory,
): Match[] {
  return planRound(order, courtCount, history).map((planned, index) => ({
    id: matchId(session.id, roundNumber, index + 1),
    courtNumber: index + 1,
    sideA: planned.sideA,
    sideB: planned.sideB,
  }));
}

/** A round carried through untouched, copied so the returned session shares nothing with the input. */
function copyRound(round: Round): Round {
  return {
    ...round,
    matches: round.matches.map((match) => ({
      ...match,
      sideA: [match.sideA[0], match.sideA[1]] as const,
      sideB: [match.sideB[0], match.sideB[1]] as const,
    })),
  };
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
