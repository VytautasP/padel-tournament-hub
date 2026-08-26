/*
 * Public API surface of padel-engine.
 *
 * This file is the library's only entry point: everything the app is allowed to touch is
 * re-exported from here, and the tests consume the engine through this file and nowhere deeper.
 *
 * The scheduling itself — the bench rotation, the partner and court searches and the history they
 * read — is private and free to be rewritten.
 */
export type {
  Match,
  MatchId,
  MatchScore,
  PlayerId,
  RosterEntry,
  Round,
  RoundId,
  ScoreEntry,
  Session,
  SessionConfig,
  SessionMode,
  Side,
} from './lib/model';

export type { Standing } from './lib/standings';

export { createSession } from './lib/create-session';
export { generateRemaining } from './lib/generate-remaining';
export { recordScore } from './lib/record-score';
export { assertSessionValid } from './lib/assert-session-valid';
export { formatSchedule } from './lib/format-schedule';
export { computeStandings } from './lib/standings';
