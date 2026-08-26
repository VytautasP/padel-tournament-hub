/*
 * Fixture builders for Mixicano, so a test can say "seven women and three men" and be read.
 *
 * Test support only: excluded from the library build, never exported from the public API. They
 * build *inputs* — every assertion still runs against what the engine returns through
 * `public-api.ts`.
 */
import type { Gender, RosterEntry, SessionConfig } from '../public-api';
import { roster } from './session-fixtures';

/**
 * A roster of `women + men` players: the women first, then the men, keeping the ids and names
 * `roster` gives so a Mixicano test reads against the same cast as an Americano one.
 */
export function mixedRoster(women: number, men: number): RosterEntry[] {
  const genders: Gender[] = [
    ...Array.from({ length: women }, (): Gender => 'woman'),
    ...Array.from({ length: men }, (): Gender => 'man'),
  ];

  return roster(women + men).map((entry, index) => ({ ...entry, gender: genders[index] }));
}

/**
 * A Mixicano session config. Defaults to an even eight — four of each on two courts over five
 * rounds — so overriding `players` alone is how a test asks for a split that cannot pair cleanly.
 */
export function mixicanoConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  const courtCount = overrides.courtCount ?? 2;

  return {
    id: 'session-1',
    mode: 'mixicano',
    players: mixedRoster(courtCount * 2, courtCount * 2),
    courtCount,
    targetScore: 24,
    roundCount: 5,
    ...overrides,
  };
}
