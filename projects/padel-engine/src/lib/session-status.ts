/*
 * The line between a session that can still change and one that is a record.
 *
 * The organizer finishes a session explicitly (decision #8), and from that moment the document is
 * immutable: scores, generation and roster changes are all refused. The rule lives in the engine
 * rather than in the app because the app is not the only thing holding the session — a spectator's
 * phone, a tab left open on the bar's laptop, a queued write that arrives late. None of them may
 * reopen a night the organizer closed, and a screen cannot be trusted to know that it is stale.
 *
 * So every operation that returns a changed session asks `assertSessionOpen` first — `recordScore`,
 * `generateRemaining`, `addRound`, `addPlayer`, `removePlayer` and `finishSession` itself — and any
 * operation added later must do the same. Reading is free: `assertSessionValid`, `computeStandings`
 * and `formatSchedule` work on a finished session exactly as they did a minute before it was
 * finished.
 *
 * The rule lives here rather than beside the operation that sets the status, the way
 * `score-rules.ts` sits beside `record-score.ts`: it is asked by four operations and owned by
 * none of them.
 */
import type { Session } from './model';

/**
 * Refuse to change a finished session.
 *
 * Finishing is itself a change, so finishing twice is refused too. That is not pedantry about
 * idempotence: two Finish taps from two stale screens should not both be able to claim they were
 * the one that froze the evening, and a caller that wants to know whether it is looking at a
 * closed session can read `status` and see.
 */
export function assertSessionOpen(session: Session, operation: string): void {
  if (session.status === 'finished') {
    throw new Error(`Session "${session.id}" is finished — ${operation} is no longer possible.`);
  }
}
