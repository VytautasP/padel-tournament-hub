/*
 * The running session: three tabs, and no way back out of them (ADR-0016).
 *
 * Round is the default because that is the posture the app is used in — standing at the side of a
 * court, being asked things. Standings are a tab rather than a screen pushed on top of the round
 * because they are consulted constantly and mid-round, and a tab is what makes consulting them
 * free.
 *
 * Both panels stay in the DOM and the inactive one is hidden, rather than being switched out and
 * rebuilt. That is what "state and scroll position survive switching" costs, and the scroll half
 * needs the second half of the arrangement: each panel is its own scroll container, so each keeps
 * a scroll offset of its own. One scroller shared between them would hand the standings the
 * round's offset and lose both.
 *
 * The Players tab is on screen and cannot be opened. It belongs to a later slice, and showing
 * where it will be is honest about a shell that is three tabs wide; a tab that appeared later
 * would move the other two under a thumb that had learned where they are.
 *
 * **An ended session has a door, and only an ended session.** ADR-0016's "no back button" is a rule
 * about an evening in progress: leaving one is ending it or discarding it, and both of those are
 * elsewhere on purpose. A finished session is not an evening being run — it is a record being
 * read, whether the organizer closed it a second ago or opened it out of history a week later —
 * and a record has to be closable or the landing page is unreachable.
 */
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { copy } from '../copy/copy';
import { RoundTab } from '../round/round-tab';
import { SessionStore } from './session-store';
import { StandingsTab } from '../standings/standings-tab';

type Tab = 'round' | 'standings' | 'players';

/** One tab in the bar: what it is called, and whether this slice can open it. */
interface TabView {
  readonly id: Tab;
  readonly label: string;
  readonly ready: boolean;
}

@Component({
  selector: 'app-session-shell',
  imports: [RoundTab, StandingsTab],
  templateUrl: './session-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionShell {
  private readonly store = inject(SessionStore);
  private readonly tab = signal<Tab>('round');

  /** Emitted when the organizer closes a finished session. Nothing else leaves this screen. */
  readonly left = output<void>();

  protected readonly copy = copy;
  protected readonly current = this.tab.asReadonly();

  /** Whether this session has ended, which is the only condition under which there is a way out. */
  protected readonly ended = this.store.ended;

  protected readonly tabs: readonly TabView[] = [
    { id: 'round', label: copy.session.round, ready: true },
    { id: 'standings', label: copy.session.standings, ready: true },
    { id: 'players', label: copy.session.players, ready: false },
  ];

  protected show(tab: Tab): void {
    this.tab.set(tab);
  }
}
