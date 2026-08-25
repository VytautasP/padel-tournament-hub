/*
 * The session document: the single data structure every engine operation takes and returns.
 *
 * Two rules shape every type in here:
 *
 *   - Identity is by id, never by index (decision #9). Roster entries, rounds and matches all
 *     carry a stable id, so a roster that changes mid-session can never silently reassign a
 *     player's results.
 *   - Everything is `readonly`. Operations return a new session; none is mutated in place.
 */

/** Stable id of a roster entry. Never a position in an array. */
export type PlayerId = string;

/** Stable id of a round. */
export type RoundId = string;

/** Stable id of a match. */
export type MatchId = string;

/**
 * The format being played. Mixicano and Team Americano land in later tickets and widen
 * this union then — a mode the engine cannot yet schedule has no business being nameable.
 */
export type SessionMode = 'americano';

/** A player as this session knows them: a name with an id of its own (decision #9). */
export interface RosterEntry {
  readonly id: PlayerId;
  readonly name: string;
}

/** One court's worth of play in a round: two sides of two players. */
export interface Match {
  readonly id: MatchId;
  /** 1-based court number, unique within its round. */
  readonly courtNumber: number;
  readonly sideA: readonly [PlayerId, PlayerId];
  readonly sideB: readonly [PlayerId, PlayerId];
}

/**
 * One round of simultaneous matches, one per court.
 *
 * A round with no matches is **unplayed**: the slot exists because the organizer asked for that
 * many rounds, but `generateRemaining` has not filled it yet. Scoring lands in a later ticket,
 * so for now "generated" and "played" are the same thing.
 */
export interface Round {
  readonly id: RoundId;
  /** 1-based position in the session, matching the round's place in `Session.rounds`. */
  readonly number: number;
  readonly matches: readonly Match[];
}

/** A padel session: the whole evening, in one document (decision #13). */
export interface Session {
  readonly id: string;
  readonly mode: SessionMode;
  readonly roster: readonly RosterEntry[];
  readonly courtCount: number;
  /** Fixed point total per match (decision #3). */
  readonly targetScore: number;
  readonly rounds: readonly Round[];
}

/** Everything `createSession` needs to build a schedulable session. */
export interface SessionConfig {
  readonly id: string;
  readonly mode: SessionMode;
  /** The roster, with the ids supplied by the caller — which is what keeps creation pure. */
  readonly players: readonly RosterEntry[];
  readonly courtCount: number;
  readonly targetScore: number;
  readonly roundCount: number;
}
