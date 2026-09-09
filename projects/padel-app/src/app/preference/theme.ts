/*
 * The theme, as a value (ADR-0031 §3, `CONTEXT.md` → **Theme**).
 *
 * Three answers rather than two. `system` is the default and it is a *preference* rather than the
 * absence of one — an organizer who opens the sheet, tries dark and changes their mind has to be
 * able to give the phone its job back, and a two-state toggle would have taken it away for good on
 * the first tap.
 *
 * The stored strings are the literal words below and are read by two entirely separate pieces of
 * code: this module, and the pre-paint script in `index.html` that runs before Angular exists
 * (ADR-0031 §5). That is why they are bare words rather than a JSON document — the script has to
 * read the preference without parsing anything.
 */

/** What an organizer chose. `system` unless they said otherwise. */
export type Theme = 'system' | 'light' | 'dark';

/** What the app actually draws, once `system` has been asked which one it means. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * The three, in the order the sheet offers them: the default first, then the two overrides.
 *
 * A list rather than three template entries, so the segmented control cannot grow a fourth answer
 * the store does not recognise or lose one the store still writes.
 */
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

/**
 * Where the theme is kept, and the string the pre-paint script looks for.
 *
 * Prefixed rather than bare because this key shares an origin with everything else the app might
 * ever store, and `theme` alone is a name three libraries would each think was theirs.
 */
export const THEME_KEY = 'pth.theme';

/** The stored word as a theme, or `system` for anything this version does not recognise. */
export function themeFrom(stored: string | null): Theme {
  return THEMES.find((theme) => theme === stored) ?? 'system';
}
