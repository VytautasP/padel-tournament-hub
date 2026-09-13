/*
 * Finishing: the organizer closing the evening, at a moment they choose.
 *
 * Nothing infers this. Not a clock, and not the last court's score arriving — a session whose last
 * round was abandoned when the lights went off is finished the moment the organizer says so, and
 * the standings at that instant are the final ones. What changes is one field; what it means is
 * that every operation which would change the document from here on is refused
 * (`session-status.ts`), so a stale screen cannot reopen a closed night.
 *
 * It is also the one moment an answer can be *taken*. Whether an evening that stopped early owes
 * anybody anything is a judgement about the room rather than a reading of the document (ADR-0037),
 * so it arrives as an option here and is written into the same object the same instant it freezes
 * — which is what stops it ever disagreeing with the rounds it is an answer about.
 */
import { abandonedRounds } from './bench-credit';
import { deepFreeze } from './freeze';
import type { Session } from './model';
import { copyRound, copySession } from './session-copy';
import { assertSessionShape } from './session-shape';
import { assertSessionOpen } from './session-status';

/** What the organizer is asked on the way out, beyond the confirmation itself. */
export interface FinishOptions {
  /**
   * Pay every competitor who was available for an abandoned round half the target score
   * (ADR-0037). Defaults to no: the standings on screen when the organizer reached for the button
   * are the standings they get, unless they say otherwise.
   */
  readonly compensateUnplayed?: boolean;
}

/**
 * Freeze the session at the moment the organizer chose.
 *
 * Nothing else about the document changes. In particular an unscored round is left unscored: a
 * night that ended with one court abandoned mid-match is a normal way for a night to end, and the
 * standings at that instant — computed from the matches that do have scores — are the final ones.
 *
 * Called without options it does exactly what it has always done, which is what lets every session
 * ever written read back and rank unchanged: the flag is absent, and absent means no.
 */
export function finishSession(session: Session, options: FinishOptions = {}): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'finishing the session');

  const compensate = options.compensateUnplayed === true;
  if (compensate) {
    assertSomethingToCompensate(session);
  }

  const finished: Session = {
    ...copySession(
      session,
      session.rounds.map((round) => copyRound(round)),
    ),
    status: 'finished',
    ...(compensate ? { compensatedUnplayed: true as const } : {}),
  };

  return deepFreeze(finished);
}

/**
 * Refuse to write a promise the document cannot keep (ADR-0037 §7).
 *
 * The referee refuses the same flag on the same grounds, and refusing here as well is what stops
 * this function being the one thing in the engine that can build a session its own referee throws
 * on. The organizer never sees it: the question is only asked where there is something to answer.
 */
function assertSomethingToCompensate(session: Session): void {
  if (abandonedRounds(session).length === 0) {
    throw new Error(
      `Session "${session.id}" has nothing to compensate — ` +
        'every generated round has been scored.',
    );
  }
}
