/*
 * The organizer's preferences, and the only thing that applies one to the document (ADR-0031).
 *
 * One theme, three answers, and a stamp on `<html>` that everything else follows from. Nothing
 * here knows a colour: `styles.css` keys the dark palette on `data-theme`, and the notch bar's
 * colour is read back out of the same tokens rather than written down a second time, so re-skinning
 * the app is still one file (ADR-0018 §1).
 *
 * **The document is stamped twice, by two entirely different pieces of code, and that is the
 * design.** The inline script in `index.html` does it before the first paint, because anything
 * Angular does happens after it and an organizer who chose the opposite of their OS would see a
 * flash of the wrong theme on every cold start — a toggle that flashes is worse than no toggle
 * (ADR-0031 §5). This does it from then on: when the choice changes, and when a `system`
 * organizer's phone goes dark at sunset while the app is open.
 *
 * **It owns three things, or an override is only half applied.** `data-theme` is what the app
 * draws itself with. `color-scheme` is what the browser draws its *own* furniture with — the
 * scrollbars, the form controls, the flash behind a navigation — and left saying `light dark` it
 * would go on following the OS while the app did not. `theme-color` is the bar behind the notch,
 * which would do the same. The pre-paint script collapses the two media-selected `theme-color`
 * metas `index.html` ships into one that carries no media, precisely so that this has one thing to
 * keep up to date rather than a selection to fight.
 *
 * `data-theme` is always stamped with a *resolved* theme, `system` included. The alternative —
 * stamping the preference and letting CSS resolve `system` with its own media query — would be two
 * mechanisms that can disagree, and there would be no single value to read to find out what the
 * app is currently drawing.
 */
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PREFERENCE_STORAGE } from './preference-storage';
import { SYSTEM_THEME } from './system-theme';
import { themeFrom, THEME_KEY } from './theme';
import type { ResolvedTheme, Theme } from './theme';

/**
 * The token the notch bar's colour is read from, and the one place a colour is named here — by
 * name rather than by value. It is the app's own background, which is what makes the bar above the
 * app read as part of it rather than as a coloured band (`index.html`).
 */
const SURFACE_TOKEN = '--color-surface';

@Injectable({ providedIn: 'root' })
export class Preferences {
  private readonly storage = inject(PREFERENCE_STORAGE);
  private readonly system = inject(SYSTEM_THEME);
  private readonly document = inject(DOCUMENT);
  private readonly chosen = signal<Theme>(themeFrom(this.storage.read(THEME_KEY)));

  /** What the organizer chose, which is `system` until they choose otherwise. */
  readonly theme = this.chosen.asReadonly();

  /** What the app is drawing right now: the choice, or the phone's answer where it is `system`. */
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const chosen = this.chosen();

    return chosen === 'system' ? this.system.theme() : chosen;
  });

  constructor() {
    effect(() => this.stamp(this.chosen(), this.resolvedTheme()));
  }

  /**
   * Take a new answer: apply it, then try to keep it.
   *
   * In that order, and the order is the point. The stamp is what the organizer asked for and it
   * cannot fail; keeping it is a favour the browser may decline. A store that wrote first and
   * applied only on success would leave a blocked-site-data phone with a switch that does nothing
   * at all, which is a broken app rather than a forgetful one.
   */
  chooseTheme(theme: Theme): void {
    this.chosen.set(theme);
    this.storage.write(THEME_KEY, theme);
  }

  private stamp(chosen: Theme, resolved: ResolvedTheme): void {
    const root = this.document.documentElement;
    root.dataset['theme'] = resolved;

    // `light dark` under `system` is not the same sentence as naming the resolved one: it tells
    // the browser both are in play, so its own furniture keeps following the OS the way the app
    // is about to. Under an override it is told there is only one, and stops.
    this.meta('color-scheme').content = chosen === 'system' ? 'light dark' : resolved;

    // Read back rather than written down. The value only exists once the stylesheet has landed,
    // which it always has by the time anything here runs in a browser and never has in a unit
    // test — so an empty answer leaves the bar as the pre-paint script set it.
    const surface = getComputedStyle(root).getPropertyValue(SURFACE_TOKEN).trim();
    if (surface !== '') {
      this.meta('theme-color').content = surface;
    }
  }

  /**
   * The meta carrying this name, created if the document has none.
   *
   * `index.html` ships both of them and the pre-paint script leaves both standing, so in a browser
   * this always finds one. It creates rather than skips because the alternative is a method that
   * silently does nothing in exactly the situation nobody would think to check.
   */
  private meta(name: string): HTMLMetaElement {
    const found = this.document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (found !== null) {
      return found;
    }

    const created = this.document.createElement('meta');
    created.name = name;
    this.document.head.appendChild(created);

    return created;
  }
}
