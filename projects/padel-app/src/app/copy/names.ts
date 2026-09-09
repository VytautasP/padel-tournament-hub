/*
 * The words that are the same in every dictionary (ADR-0032 §5).
 *
 * *Americano*, *Mixicano* and *Team Americano* are the sport's proper nouns and
 * *Padel Tournament Hub* is the product's. A translated mode name would be a format nobody could
 * ask for by name at a club, and a translated product name would be a different product.
 *
 * They live here rather than being written identically in both dictionaries because identical is
 * a thing that has to be maintained and shared is a thing that cannot drift. It is also what makes
 * "the mode names are the same in both languages" a fact about the code rather than a test.
 */
import type { SessionMode } from 'padel-engine';

/**
 * The product's name, out on its own because two entries in each dictionary need it in a sentence.
 */
export const appName = 'Padel Tournament Hub';

/** The three formats an evening can be, named as the sport names them. */
export const modeNames: Readonly<Record<SessionMode, string>> = {
  americano: 'Americano',
  mixicano: 'Mixicano',
  'team-americano': 'Team Americano',
};
