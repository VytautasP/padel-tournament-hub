/*
 * The two addresses this product has (ADR-0026 §1).
 *
 * The spectator's path is not spelled out here: `SPECTATOR_ROUTE` is the same constant the share
 * sheet builds its link from, so the square a spectator scans and the route that answers it cannot
 * drift apart. That is the whole reason `share-link.ts` exists as a pair of functions rather than
 * as one template string in a component.
 *
 * The code is bound straight onto the spectator page as an input, which is what
 * `withComponentInputBinding()` in `app.config.ts` is for. A component that injected
 * `ActivatedRoute` to read one string would be a component that could only be rendered by a
 * router, and this one is a session view that happens to be routed to.
 */
import type { Routes } from '@angular/router';
import { SPECTATOR_ROUTE } from './share/share-link';

export const routes: Routes = [
  {
    path: SPECTATOR_ROUTE,
    loadComponent: async () => (await import('./spectator/spectator-page')).SpectatorPage,
  },
  {
    path: '',
    loadComponent: async () => (await import('./organizer/organizer')).Organizer,
  },
  /*
   * Anything else is the front door. Hosting rewrites every path to `index.html` (ADR-0026 §1),
   * so a mistyped address arrives here rather than at a 404 the app never sees — and the honest
   * answer to a URL this product does not have is the app itself, not a router error in a console
   * nobody is looking at.
   */
  { path: '**', redirectTo: '' },
];
