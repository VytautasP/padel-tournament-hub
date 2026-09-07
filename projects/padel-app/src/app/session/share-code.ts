/*
 * The unguessable code a session is identified by, and the id of the document it lives in
 * (ADR-0024 §1).
 *
 * `Session.id`, `SessionRecord`'s document id and the share code are one value with three names.
 * There is no separate `shareCode` field and no lookup collection: a second identifier for one
 * thing is the mistake this codebase avoids everywhere else by deriving rather than storing.
 *
 * Ten Crockford base32 characters — fifty bits, which is unguessable at any rate a stranger could
 * try codes against Firestore, and short enough to read out across a court. Crockford rather than
 * standard base32 because a code is retyped by hand when a QR will not scan, and I, L, O and U
 * are the characters that get retyped wrong.
 *
 * Reads are public and unlisted is not secure (ADR-0024 §4): a leaked code is permanent access to
 * that session, for anyone, and there is no revocation. That is the trade decision #10 makes, and
 * this file is only the part of it that makes the code hard to *guess*.
 */

/**
 * Crockford's alphabet: the digits, then the letters with I, L, O and U taken out.
 *
 * Exported so a test can assert the alphabet rather than restate it — the excluded letters are
 * the whole point of choosing this encoding, and a spec that spelled the alphabet out again would
 * pass a typo through twice.
 */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Ten characters, which at thirty-two per character is fifty bits. */
export const SHARE_CODE_LENGTH = 10;

/**
 * A fresh share code, drawn from the platform's cryptographic generator.
 *
 * Each character is one random byte masked to five bits. The alphabet is exactly thirty-two long,
 * so the mask is uniform and there is nothing to reject and redraw — a modulo over an alphabet
 * that was not a power of two would quietly bias the first characters of it, which is the way
 * fifty bits becomes fewer without anything looking wrong.
 */
export function newShareCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_CODE_LENGTH));

  return [...bytes].map((byte) => CROCKFORD_ALPHABET[byte & 31]).join('');
}
