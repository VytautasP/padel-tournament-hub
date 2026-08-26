/*
 * The first screen: one button, or the evening already in progress.
 *
 * With a session in progress, New session is *absent* rather than disabled. There is only ever
 * one active session (ADR-0013), so the app cannot honour a second one, and an offered-but-greyed
 * button is a worse answer than no button — it invites a tap and explains nothing.
 */
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { copy } from '../copy/copy';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  private readonly store = inject(SessionStore);

  readonly started = output<void>();
  readonly resumed = output<void>();

  protected readonly copy = copy;
  protected readonly session = this.store.activeSession;
  protected readonly roundNumber = computed(() => this.store.currentRoundNumber() ?? 1);
}
