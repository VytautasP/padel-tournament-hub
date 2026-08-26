/*
 * One more round, decided mid-evening.
 *
 * The round count set at creation is where the session starts, not where it has to end
 * (decision #6): the organizer sees there is court time left and adds a round. The slot is
 * appended and then filled by `generateRemaining`, which plans it against everything already
 * played rather than against the round count it was going to have.
 *
 * That delegation is the whole design, and it is what keeps the added round fair. A round planned
 * in isolation would bench whoever the rotation happened to reach and repeat partnerships the
 * evening had already used up; planned against the full history it is the round the schedule would
 * have contained all along had the organizer asked for it at the start. Any round still
 * ungenerated ahead of it is filled by the same walk, for the same reason.
 */
import { roundId } from './create-session';
import { generateRemaining } from './generate-remaining';
import type { Round, Session } from './model';
import { copySession } from './session-copy';
import { assertSessionShape } from './session-shape';
import { assertSessionOpen } from './session-status';

export function addRound(session: Session): Session {
  assertSessionShape(session);
  assertSessionOpen(session, 'adding a round');

  const number = session.rounds.length + 1;
  const added: Round = { id: roundId(session.id, number), number, matches: [] };

  return generateRemaining(copySession(session, [...session.rounds, added]));
}
