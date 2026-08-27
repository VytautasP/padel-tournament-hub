/*
 * Where the evening is right now, worked out from the scores (ADR-0016).
 *
 * The lowest-numbered generated round that still holds an unscored match. Derived on every read
 * and stored nowhere, so correcting a typo in round 2 moves the evening back to round 2 — which is
 * the whole point of it being derived rather than a pointer somebody has to remember to move.
 *
 * A plain function rather than a method on the store because two screens ask it about two
 * different sessions: the Resume card asks about the evening in progress, the Round tab asks about
 * the session on screen, and those stop being the same session the moment history can be opened.
 */
import type { Session } from 'padel-engine';

export function currentRoundNumber(session: Session): number {
  const unfinished = session.rounds.find(
    (round) => round.matches.length > 0 && round.matches.some((match) => !match.score),
  );

  return (unfinished ?? session.rounds[session.rounds.length - 1]).number;
}
