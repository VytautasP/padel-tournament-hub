/*
 * The whole of the spectator's settings: two words in a corner (ADR-0032 §6).
 *
 * ADR-0029 gives this page no chrome and no identity, and ADR-0032 §2 gives every browser that has
 * never opened the app English — which between them strand the largest audience this product has.
 * A spectator arrives once, by scanning a square at the side of a court, never installs anything,
 * and so has no stored preference and nowhere to state one. A read-only page whose only flaw is
 * being in a language you do not read is worth this much and no more: no gear, no sheet, no theme
 * control, nothing that could touch the evening.
 *
 * **It writes and reloads, exactly as the organizer's control does**, through the same
 * `Preferences` and the same `pth.language` key. It has to: a language change is a reload
 * (ADR-0032 §3), so a toggle that stored nothing would revert on the reload it triggered. The
 * consequence is that a browser can acquire a language preference from a page that has no settings
 * — which is harmless, and means a spectator who later runs their own evening keeps the language
 * they chose.
 *
 * The words come from `copy.settings.language` rather than from a second entry of this page's own.
 * They are the one pair of strings in the app that is the same in both dictionaries (ADR-0032 §5),
 * and two copies of them would be two names for one control — the argument `shareHeading` is
 * written out of one constant for.
 *
 * It is a second control rather than the settings sheet's, made to take a size: the two say the
 * same thing — `aria-pressed` and the brand fill — and are otherwise nothing alike. The sheet's is
 * a full-width segment under a heading on a surface that exists to hold it; this is a pill in the
 * corner of a table somebody is reading, with no heading and nothing above it. A flag choosing
 * between the two shapes would be a component whose whole body is that flag.
 *
 * Nothing about the language goes into the address. ADR-0024 makes the share code the document id,
 * and a language beside it in the path would make one evening two different pages.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { copy } from '../copy/copy';
import { LANGUAGES } from '../preference/language';
import type { Language } from '../preference/language';
import { Preferences } from '../preference/preferences';

@Component({
  selector: 'app-language-toggle',
  templateUrl: './language-toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageToggle {
  private readonly preferences = inject(Preferences);

  protected readonly copy = copy;
  protected readonly languages = LANGUAGES;

  /** The language this visit is being read in. Not a signal, and cannot be: choosing ends the page. */
  protected readonly held = this.preferences.language;

  /** One segment, named in the language it offers — the word a spectator is looking for. */
  protected label(language: Language): string {
    return copy.settings.language.answers[language];
  }

  /**
   * Take the tap and let `Preferences` decide whether it is a change.
   *
   * Tapping the language already held does nothing, which is why both segments are live buttons
   * rather than one button and one label: a segment that could not be tapped would have to explain
   * itself, and the explanation is that nothing happens.
   */
  protected choose(language: Language): void {
    this.preferences.chooseLanguage(language);
  }
}
