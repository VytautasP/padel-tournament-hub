/*
 * A number and the noun that agrees with it, in whatever language is asking (ADR-0032 §4).
 *
 * English has two forms and Lithuanian has three, and the Lithuanian rule is not the one an
 * English speaker would guess: `1 žaidėjas`, `3 žaidėjai`, `11 žaidėjų` — 11 through 19 take the
 * third form while 21 goes back to the first. The modulo arithmetic that produces that is the
 * version which looks finished and is wrong at 111, so it is not written here at all.
 *
 * `Intl.PluralRules` is the browser's own copy of the CLDR plural rules for every locale this app
 * will ever be translated into. It is in every browser this PWA targets and costs no dependency.
 * A dictionary asks it for a *category* — `one`, `few`, `other` — and supplies the word for each
 * category it has; a language that does not use a category simply does not write one down.
 */

/**
 * The forms of one noun, by the category the count falls into.
 *
 * `other` is required and the rest are not, because every locale has `other` and no locale has
 * all six. It is also the fallback, which is what makes a dictionary that forgot `many` — the
 * category Lithuanian keeps for fractions — read as slightly wrong rather than as `undefined`.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string };

/**
 * Counting, in one locale: `3` and `žaidėjai` become `3 žaidėjai`.
 *
 * A factory rather than a function taking a locale, so each dictionary builds its rules once at
 * module load. `Intl.PluralRules` is not free to construct and `players.count` is read on every
 * keystroke of the roster step.
 */
export function countIn(locale: string): (count: number, forms: PluralForms) => string {
  const rules = new Intl.PluralRules(locale);

  return (count, forms) => `${count} ${forms[rules.select(count)] ?? forms.other}`;
}
