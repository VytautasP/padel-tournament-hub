/*
 * The Round tab: where the evening actually is (ADR-0016).
 *
 * It opens on the current round — the lowest-numbered round still holding an unscored match,
 * derived from the scores and never stored. Paging, scoring and the other two tabs arrive in
 * their own slices; what this renders is the courts, who is on them, and the fact that nobody has
 * a score yet.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { copy } from '../copy/copy';
import { roundView } from './round-view';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-round-tab',
  templateUrl: './round-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundTab {
  private readonly store = inject(SessionStore);

  protected readonly copy = copy;

  protected readonly roundCount = computed(() => this.store.activeSession()?.rounds.length ?? 0);

  protected readonly round = computed(() => {
    const session = this.store.activeSession();
    const roundNumber = this.store.currentRoundNumber();

    return session === null || roundNumber === null ? null : roundView(session, roundNumber);
  });
}
