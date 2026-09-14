/*
 * Fixture builders, so that tests read as scenarios rather than as object literals.
 *
 * These are test support only: they are excluded from the library build and never exported
 * from the public API. They build *inputs* — every assertion still runs against what the
 * engine returns through `public-api.ts`.
 */
import { recordScore } from '../public-api';
import type { RosterEntry, Session, SessionConfig } from '../public-api';

const NAMES = [
  'Ana',
  'Ben',
  'Cara',
  'Dov',
  'Elin',
  'Finn',
  'Gita',
  'Hugo',
  'Iris',
  'Jonas',
  'Kaja',
  'Liam',
  'Mira',
  'Nils',
  'Olga',
  'Pavel',
];

/** A roster of `count` players with stable ids, named from the list above. */
export function roster(count: number): RosterEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: NAMES[index % NAMES.length],
  }));
}

/**
 * An Americano session config that fills its courts exactly — `courts * 4` players, so nobody is
 * benched. Defaults to 8 players on 2 courts over 5 rounds; override any field, and overriding
 * `players` on its own is how a test asks for a roster that has to bench.
 */
export function americanoConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  const courtCount = overrides.courtCount ?? 2;
  return {
    id: 'session-1',
    mode: 'americano',
    players: roster(courtCount * 4),
    courtCount,
    targetScore: 24,
    roundCount: 5,
    ...overrides,
  };
}

/**
 * Every generated match of a session scored, so no round in it is abandoned.
 *
 * Both specs that need an evening with nothing left to compensate build it this way, and a second
 * copy of the fold would be a second chance to leave one court unscored by accident — which is
 * precisely the state these tests exist to tell apart.
 */
export function scoredThrough(session: Session, points = 15): Session {
  return session.rounds
    .flatMap((round) => round.matches)
    .reduce(
      (scored, match) => recordScore(scored, { matchId: match.id, side: 'A', points }),
      session,
    );
}

/**
 * The session as an organizer left it who ended the evening and said yes to compensation.
 *
 * `finishSession` is the only thing that writes the flag in production, but a standings test
 * wants a hand-built session with an abandoned round in it and no interest in how it froze — so
 * this states the ending outright, the way the fixtures state the rounds outright.
 */
export function compensating(session: Session): Session {
  return { ...session, status: 'finished', compensatedUnplayed: true };
}
