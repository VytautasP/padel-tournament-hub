/*
 * The app-level session record: the engine's session document plus the fields the engine has no
 * business knowing (ADR-0017).
 *
 * The engine's `Session` is the whole evening as the rules see it — roster, courts, rounds,
 * scores. It deliberately reads no clock (decision #6), so it cannot know when the evening was
 * created, and it should not learn: a timestamp changes nothing about how a round is scheduled.
 * Wrapping rather than widening keeps that true. Every app-owned field lands here, and what
 * `padel-engine` receives back is the session it handed out.
 *
 * This is the unit the repository stores, so it is also the shape that has to survive a JSON
 * round trip. Nothing in here may be a class, a Date or an undefined-valued key.
 */
import type { Session } from 'padel-engine';

export interface SessionRecord {
  readonly session: Session;
  /** When the organizer created the evening, as an ISO-8601 instant. */
  readonly createdAt: string;
  /**
   * What the organizer calls each court, in court-number order: entry `i` names court `i + 1`.
   *
   * This is the first app-owned field ADR-0017 predicted, and it is the reason the wrapper exists
   * at all. The engine identifies a court by its `courtNumber` and always will; a name is a label
   * the app renders over that number, so it cannot go on the engine's `Session` without making
   * the engine hold a display concern it has no rule about.
   *
   * An entry may be blank — that is somebody skipping the question, and it renders as `Court N`
   * (ADR-0017 §6). Two entries may be identical, because a club with two courts called "Centre"
   * is not a session the app should refuse to create.
   */
  readonly courtNames: readonly string[];
}
