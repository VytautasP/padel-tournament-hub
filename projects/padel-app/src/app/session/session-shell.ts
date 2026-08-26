/*
 * The running session: three tabs, and no way back out of them (ADR-0016).
 *
 * Round is the default because that is the posture the app is used in — standing at the side of a
 * court, being asked things. Standings are a tab rather than a screen pushed on top of the round
 * because they are consulted constantly and mid-round, and a tab is what makes consulting them
 * free.
 *
 * Both panels stay in the DOM and the inactive one is hidden, rather than being switched out and
 * rebuilt. That is what "state and scroll position survive switching" costs: an expanded standings
 * row and a scrolled round are still there when the organizer comes back, because nothing was
 * destroyed while they were away.
 *
 * The Players tab is on screen and cannot be opened. It belongs to a later slice, and showing
 * where it will be is honest about a shell that is three tabs wide; a tab that appeared later
 * would move the other two under a thumb that had learned where they are.
 */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { copy } from '../copy/copy';
import { RoundTab } from '../round/round-tab';
import { StandingsTab } from '../standings/standings-tab';

type Tab = 'round' | 'standings';

@Component({
  selector: 'app-session-shell',
  imports: [RoundTab, StandingsTab],
  templateUrl: './session-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionShell {
  private readonly tab = signal<Tab>('round');

  protected readonly copy = copy;
  protected readonly current = this.tab.asReadonly();

  protected show(tab: Tab): void {
    this.tab.set(tab);
  }
}
