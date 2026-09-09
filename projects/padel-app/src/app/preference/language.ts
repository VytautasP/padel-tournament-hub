/*
 * The language, as a value (ADR-0032, `CONTEXT.md` → **Language**).
 *
 * `theme.ts`'s sibling, and deliberately shaped like it: two words the store recognises, a key
 * the pre-paint script also reads, and a function that turns anything else back into the default.
 * The one difference is what happens downstream — a theme is a signal and a language is not, and
 * the whole of why is ADR-0032 §3: changing the language reloads the app rather than re-rendering
 * it, because the alternative is `copy().…` in 136 places forever.
 *
 * **English on first run, on every browser.** There is no `navigator.language` here and there is
 * not going to be one (ADR-0032 §2). Sniffing would put more people in the right language on day
 * one and would also let a browser silently change the language of a product an organizer has
 * already learned. The switch is one tap from the front door.
 */

/** The languages the app is written in. `en` unless the organizer said otherwise. */
export type Language = 'en' | 'lt';

/**
 * The two, in the order the sheet offers them: the default first.
 *
 * A list rather than two template entries, for the reason `THEMES` is one — a control that grew a
 * third answer the store does not recognise would be a switch that silently does nothing.
 */
export const LANGUAGES: readonly Language[] = ['en', 'lt'];

/** Where the language is kept, and the string the pre-paint script looks for. */
export const LANGUAGE_KEY = 'pth.language';

/**
 * The locale each language formats numbers and dates in.
 *
 * Not the same fact as the language, which is why it is written down rather than derived: `en` is
 * `en-GB` here because this app writes `26 Aug` rather than `Aug 26`, and a language tag that
 * happened to match its locale in both of today's two entries would be a coincidence the third
 * language breaks.
 *
 * It is read by `Intl.PluralRules` in each dictionary and by `formatDay` in `copy.ts`, which are
 * the two places the app says something in a language without a string being written for it.
 */
export const LOCALES: Readonly<Record<Language, string>> = {
  en: 'en-GB',
  lt: 'lt-LT',
};

/** The stored word as a language, or `en` for anything this version does not recognise. */
export function languageFrom(stored: string | null): Language {
  return LANGUAGES.find((language) => language === stored) ?? 'en';
}
