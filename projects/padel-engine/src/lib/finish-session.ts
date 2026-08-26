/*
 * Finishing: the organizer closing the evening, at a moment they choose.
 *
 * Nothing infers this. Not a clock, and not the last court's score arriving — a session whose last
 * round was abandoned when the lights went off is finished the moment the organizer says so, and
 * the standings at that instant are the final ones. What changes is one field; what it means is
 * that every operation which would change the document from here on is refused
 * (`session-status.ts`), so a stale screen cannot reopen a closed night.
 */
import { deepFreeze } from './freeze';
import type { Session } from './model';
import { copyRound, copySession } from './session-copy';
import { assertSessionShape } from './session-shape';
import { assertSessionOpen } from './session-status';

/**
 * Freeze the session at the moment the organizer chose.
 *
 * Nothing else about the document changes. In particular an unscored round is left unscored: a
 * night that ended with one court abandoned mid-match is a normal way for a night to end, and the
 * standings at that instant — computed from the matches that do have scores — are the final ones.
 */
export function finishSession(session: Session): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'finishing the session');

  const finished: Session = {
    ...copySession(
      session,
      session.rounds.map((round) => copyRound(round)),
    ),
    status: 'finished',
  };

  return deepFreeze(finished);
}
