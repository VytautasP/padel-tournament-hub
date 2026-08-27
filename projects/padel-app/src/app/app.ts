/*
 * The app shell: read the repository once, then show one of three screens.
 *
 * There is no router. Every surface in this slice is a screen the organizer is *on* rather than a
 * place they can link to or navigate back from — ADR-0016 is explicit that a session has no back
 * button — and a URL for the wizard's second step would be a promise the app cannot keep.
 *
 * The restore runs through `PendingTasks` so the app is genuinely unstable until it settles.
 * Without that, "stable" would mean "the first paint happened", and every test would be racing a
 * promise it could not see.
 */
import { ChangeDetectionStrategy, Component, inject, PendingTasks, signal } from '@angular/core';
import { CreateWizard } from './wizard/create-wizard';
import { Landing } from './landing/landing';
import { SessionShell } from './session/session-shell';
import { SessionStore } from './session/session-store';

type Screen = 'landing' | 'wizard' | 'session';

@Component({
  selector: 'app-root',
  imports: [CreateWizard, Landing, SessionShell],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly store = inject(SessionStore);
  private readonly screen = signal<Screen>('landing');

  protected readonly ready = this.store.ready;
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
    this.store.close();
    this.show('landing');
  }
}
