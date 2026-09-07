import { describe, expect, it } from 'vitest';
import { CROCKFORD_ALPHABET, SHARE_CODE_LENGTH, newShareCode } from './share-code';

describe('the share code', () => {
  it('is ten characters long', () => {
    expect(newShareCode()).toHaveLength(SHARE_CODE_LENGTH);
  });

  it('is written only in Crockford base32', () => {
    for (const character of [...codes(200)].join('')) {
      expect(CROCKFORD_ALPHABET).toContain(character);
    }
  });

  /*
   * The four letters a code retyped from a QR that would not scan could be read two ways
   * (ADR-0024 §1). They are absent from the alphabet, so this is a check that the alphabet is
   * still the one the ADR describes rather than a check on any particular code.
   */
  it('never contains a letter that could be read as another character', () => {
    for (const ambiguous of ['I', 'L', 'O', 'U']) {
      expect(CROCKFORD_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('is a different code every time', () => {
    const drawn = codes(500);

    expect(drawn.size).toBe(500);
  });

  /*
   * Fifty bits is only fifty bits if every character can be any of the thirty-two. A generator
   * that took a byte modulo the alphabet, or that quietly emitted the same character in a
   * position, would still pass every test above.
   */
  it('can put any character of the alphabet in any position', () => {
    const drawn = [...codes(2000)];

    for (let position = 0; position < SHARE_CODE_LENGTH; position += 1) {
      const seen = new Set(drawn.map((code) => code[position]));

      expect(seen.size).toBe(CROCKFORD_ALPHABET.length);
    }
  });
});

function codes(count: number): Set<string> {
  return new Set(Array.from({ length: count }, () => newShareCode()));
}
