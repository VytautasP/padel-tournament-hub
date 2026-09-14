/*
 * Which dictionary the app is speaking, and the one place that answer is given (ADR-0032).
 *
 * Every consumer in this app imports `copy` from here and holds it as `protected readonly copy =
 * copy`, exactly as it did when there was one dictionary. That is the whole point of this file
 * existing: splitting the strings into two files changed this module and nothing else, and not one
 * of the 136 `copy.…` reads across 26 templates moved (ADR-0032 §3).
 *
 * **The binding is reassigned once, before anything reads it.** `Preferences` calls `useLanguage`
 * as it is constructed, which is inside the root component's field initialisers and therefore
 * before any screen exists to hold a dictionary. A module that captured `copy` at import time
 * would capture English and keep it, which is why `destinations.ts` builds its labels when it is
 * asked rather than when it is loaded — it is the one file that ever did that, and now nothing
 * does.
 *
 * **Changing the language reloads the app.** That is `Preferences.chooseLanguage`, not this file,
 * and the reason is ADR-0032 §3: the alternative is a signal, and a signal turns every one of
 * those 136 reads into `copy().…` permanently. Nothing here is reactive and nothing here needs to
 * be — the app that comes back up has already chosen before it paints.
 */
import { copyEn } from './copy.en';
import { copyLt } from './copy.lt';
import { LOCALES } from '../preference/language';
import type { Copy } from './copy.en';
import type { Language } from '../preference/language';

export type { Copy } from './copy.en';
export { appName, modeNames } from './names';

/** The dictionaries there are, by the word the preference store keeps. */
const DICTIONARIES: Readonly<Record<Language, Copy>> = {
  en: copyEn,
  lt: copyLt,
};

/**
 * Every string the organizer can read, in the language they are reading it in.
 *
 * `let` rather than `const`, which is the one unusual thing in this file. An ES module export is a
 * live binding, so reassigning it here is seen by all 38 files that import it — which is exactly
 * what is wanted and is also why it may only happen once, at startup, before any of them has
 * looked. English is the value until somebody says otherwise, on every browser (ADR-0032 §2).
 */
export let copy: Copy = copyEn;

/**
 * The two shapes a day is written in, side by side so the one field between them is visible.
 *
 * `DAY` is which Tuesday, for somebody scrolling a list of their own evenings. `DATE` is which
 * Tuesday of which year, for a report that has left the app and has no list around it to say
 * (ADR-0038). Each drops what the other needs, which is why neither can serve both.
 */
const DAY: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const DATE: Intl.DateTimeFormatOptions = { year: 'numeric', day: 'numeric', month: 'short' };

/**
 * The day an evening was played, as a history row says it: `Wed 26 Aug`, or `tr 26 rugp.`.
 *
 * It is here rather than in a dictionary because there is nothing to translate — the weekday and
 * the month are words the browser already knows in every language, and writing them down would be
 * writing down what `Intl` is for. What the dictionaries would disagree about is only the locale,
 * and that is `LOCALES` (ADR-0032 §5).
 *
 * The formatter is rebuilt when the language is, rather than being constructed per call: history
 * formats a row per evening and `Intl.DateTimeFormat` is not cheap to make.
 */
let dayFormat = formatterFor('en', DAY);

export function formatDay(instant: string): string {
  return dayFormat.format(new Date(instant));
}

/**
 * A day with its year on it: `26 Aug 2026`, or `2026 m. rugp. 26 d.`.
 *
 * The same argument as `formatDay` and one more field, because the one place this is read is the
 * footer of a report (ADR-0038) — a file that is forwarded into a group chat six months later and
 * pinned to a club board after that. A history row is a list of this year's Tuesdays and says so;
 * a document that left the app has no list around it to say which year it came from.
 *
 * The weekday goes, for the same reason the year arrives: which Wednesday is a question somebody
 * scrolling their own history asks, and not one anybody asks of a footer.
 */
let dateFormat = formatterFor('en', DATE);

export function formatDate(instant: string): string {
  return dateFormat.format(new Date(instant));
}

/**
 * Speak this language from here on.
 *
 * Called once, by `Preferences`, before the first screen is built. It is not exported for anybody
 * else: a second caller would be a language changing under a rendered app, which is the thing
 * ADR-0032 §3 declined to support and `location.reload()` is the answer to.
 */
export function useLanguage(language: Language): void {
  copy = DICTIONARIES[language];
  dayFormat = formatterFor(language, DAY);
  dateFormat = formatterFor(language, DATE);
}

function formatterFor(language: Language, fields: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALES[language], fields);
}
