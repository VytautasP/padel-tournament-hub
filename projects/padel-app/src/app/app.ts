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
import { RoundTab } from './round/round-tab';
import { SessionStore } from './session/session-store';

type Screen = 'landing' | 'wizard' | 'session';

@Component({
  selector: 'app-root',
  imports: [CreateWizard, Landing, RoundTab],
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
}
