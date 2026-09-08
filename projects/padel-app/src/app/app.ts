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
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
