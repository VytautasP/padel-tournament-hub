/*
 * Sessions damaged on purpose, for testing the referee.
 *
 * `assertSessionValid` exists for sessions the engine did not build — one loaded from storage, one
 * edited by hand — so the only honest way to test it is to hand it a session that is wrong. The
 * engine's own types forbid writing one, and its operations deep-freeze what they return, so a
 * test has to clone its way out of both before it can break anything.
 *
 * That escape hatch lives here rather than in each spec, so the casts are written once and every
 * spec damages a session the same way.
 */
import type { PlayerId, Session } from '../public-api';

export interface MutableScore {
  sideA: number;
  sideB: number;
}

export interface MutableMatch {
  id: string;
  courtNumber: number;
  sideA: [PlayerId, PlayerId];
  sideB: [PlayerId, PlayerId];
  /** Which teams played the match, in Team Americano — and a field a test can put anywhere. */
  teams?: { sideA: string; sideB: string };
  score?: MutableScore;
}

export interface MutableSession extends Omit<
  Session,
  'id' | 'status' | 'roster' | 'teams' | 'rounds'
> {
  id: string;
  /** Widened to `string`, so a test can damage a session with a status the engine never sets. */
  status: string;
  roster: {
    id: string;
    name: string;
    /** Widened to `string`, so a test can damage a roster with a gender the engine never sets. */
    gender?: string;
    joinedAtRound?: number;
    leftAfterRound?: number;
  }[];
  teams?: { id: string; playerIds: [PlayerId, PlayerId]; formerPlayerIds?: PlayerId[] }[];
  rounds: { id: string; number: number; matches: MutableMatch[] }[];
}

/** Clone a session, break it in one specific way, and hand it back for validation. */
export function damaged(session: Session, damage: (copy: MutableSession) => void): Session {
  const copy = structuredClone(session) as unknown as MutableSession;
  damage(copy);

  return copy as unknown as Session;
}
