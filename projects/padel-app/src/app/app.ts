/*
 * The root of the application: an outlet, and nothing else (ADR-0026 §1).
 *
 * There are two routes and there will not be a third soon. `/` is the organizer's app, which is
 * every screen this project had before there was a router; `/s/:code` is the spectator's, which
 * is the one surface in this product that is genuinely a place — it has an address somebody else
 * holds, it is arrived at by scanning a square on a phone, and it can be reloaded into.
 *
 * Both are lazily loaded, which is the whole point of them being routes at all. A spectator who
 * scanned a QR at the side of a court downloads the round card and the table; they do not
 * download the creation wizard, the score sheet or the Firebase auth flow, none of which they
 * could reach and all of which they would be paying for. The organizer pays nothing for the
 * spectator's view in return.
 *
 * It is also where the organizer's theme is applied from, because it is the one component both
 * routes are inside — see the field below.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Preferences } from './preference/preferences';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /**
   * The one thing the root does besides holding an outlet: it brings the preferences into
   * existence.
   *
   * `Preferences` keeps `<html>` in step with the organizer's theme and with their phone
   * (ADR-0031 §5), and an injectable nobody has asked for is an injectable that does not exist —
   * on the front door the sheet has not been opened yet, and on `/s/:code` it never will be. It is
   * injected here rather than initialised in `app.config.ts` because a spectator's app and a
   * test's app are both this component and neither is that file.
   */
  private readonly preferences = inject(Preferences);
}
