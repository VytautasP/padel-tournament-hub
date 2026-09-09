/*
 * The OS the tests run on: one answer, stated at launch, and changeable on purpose.
 *
 * `FixedLayout`'s sibling, and the same bargain. A spec says which kind of phone it is holding
 * rather than reaching for a media query the test environment does not implement — and unlike the
 * tier, this one can be moved while the app is open, because an organizer's phone going dark at
 * sunset is the situation `system` exists for and therefore a thing worth proving.
 */
import { signal } from '@angular/core';
import type { SystemTheme } from './system-theme';
import type { ResolvedTheme } from './theme';

export class FixedSystemTheme implements SystemTheme {
  private readonly current;

  readonly theme;

  constructor(theme: ResolvedTheme) {
    this.current = signal(theme);
    this.theme = this.current.asReadonly();
  }

  /** The organizer changing their phone's setting while the app is open. */
  set(theme: ResolvedTheme): void {
    this.current.set(theme);
  }
}
