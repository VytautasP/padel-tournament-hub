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

/** Which side of a match a number belongs to. */
export type Side = 'A' | 'B';

/**
 * A finished match's points, always summing to the session target (decision #3).
 *
 * Both numbers are stored even though the organizer enters one, because a stored pair is what
 * every later reader — standings, the printout, a spectator — actually wants. The pair is
 * derived on the way in by `recordScore`, so the two halves cannot disagree.
 */
export interface MatchScore {
  readonly sideA: number;
  readonly sideB: number;
}

/** One court's worth of play in a round: two sides of two players. */
export interface Match {
  readonly id: MatchId;
  /** 1-based court number, unique within its round. */
  readonly courtNumber: number;
  readonly sideA: readonly [PlayerId, PlayerId];
  readonly sideB: readonly [PlayerId, PlayerId];
  /**
   * The result, once someone has entered it. Absent means **not yet scored** — a court still
   * playing, or one whose result has not reached the organizer. Rounds finish in whatever order
   * the courts do, so an unscored match may sit between two scored ones.
   */
  readonly score?: MatchScore;
}

/** One side's result for one match: the single number the organizer types (decision #3). */
export interface ScoreEntry {
  readonly matchId: MatchId;
  readonly side: Side;
  /** That side's points. The other side's are `targetScore - points`. */
  readonly points: number;
}

/**
 * One round of simultaneous matches, one per court.
 *
 * A round with no matches is **ungenerated**: the slot exists because the organizer asked for
 * that many rounds, but `generateRemaining` has not filled it yet. Generated is not the same as
 * played — whether a round has been played is read off its matches' scores, not off the round.
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
