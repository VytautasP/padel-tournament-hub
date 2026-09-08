/*
 * The organizer's half of the app: read the repository once, then show one of three screens.
 *
 * There is one route under all of this and it never changes. Every surface here is a screen the
 * organizer is *on* rather than a place they can link to or navigate back from — ADR-0016 is
 * explicit that a session has no back button — and a URL for the wizard's second step would be a
 * promise the app cannot keep.
 *
 * ADR-0019's reasoning survives the router ADR-0026 brought: none of the screens below gained a
 * URL. The wizard's second step is still not a place, a session still has no back button, and the
 * one address this app has is the spectator's — a different surface, held by somebody else, and
 * the whole reason there is a router at all.
 *
 * The restore runs through `PendingTasks` so the app is genuinely unstable until it settles.
 * Without that, "stable" would mean "the first paint happened", and every test would be racing a
 * promise it could not see. Since step 3 the restore signs in before it reads (ADR-0025 §4), so
 * what the app is unstable until is now the first *auth* as well as the first read — and the one
 * device that cannot get there gets a screen of its own rather than a fourth kind of nothing.
 */
import { ChangeDetectionStrategy, Component, inject, PendingTasks, signal } from '@angular/core';
import { ConnectionNeeded } from '../startup/connection-needed';
import { CreateWizard } from '../wizard/create-wizard';
import { Landing } from '../landing/landing';
import { SessionShell } from '../session/session-shell';
import { SessionStore } from '../session/session-store';

type Screen = 'landing' | 'wizard' | 'session';

@Component({
  selector: 'app-organizer',
  imports: [ConnectionNeeded, CreateWizard, Landing, SessionShell],
  templateUrl: './organizer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Organizer {
  private readonly store = inject(SessionStore);
  private readonly screen = signal<Screen>('landing');

  protected readonly ready = this.store.ready;
  /** The one thing that can stand between a settled restore and a screen (ADR-0025 §4). */
  protected readonly needsConnection = this.store.needsConnection;
  protected readonly current = this.screen.asReadonly();

  constructor() {
    inject(PendingTasks).run(() => this.store.restore());
  }

  protected show(screen: Screen): void {
    this.screen.set(screen);
  }

  /**
   * Put one session on screen: the evening in progress, or one read out of history.
   *
   * One entry point for both, because the session screen is the same screen either way — what
   * differs is the session's status, and the tabs read that for themselves (ADR-0013).
   */
  protected open(sessionId: string): void {
    this.store.open(sessionId);
    this.show('session');
  }

  /** Leave a finished session. Nothing else leaves the session screen (ADR-0016). */
  protected leave(): void {
    this.store.leave();
    this.show('landing');
  }
}
