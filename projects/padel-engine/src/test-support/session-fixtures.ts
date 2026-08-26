/*
 * Fixture builders, so that tests read as scenarios rather than as object literals.
 *
 * These are test support only: they are excluded from the library build and never exported
 * from the public API. They build *inputs* — every assertion still runs against what the
 * engine returns through `public-api.ts`.
 */
import type { RosterEntry, SessionConfig } from '../public-api';

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
