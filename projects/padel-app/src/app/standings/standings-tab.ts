/*
 * The Standings tab: the table, live (decision #17, ADR-0008).
 *
 * Nothing is computed here. The store asks the engine on every read and the engine derives the
 * table from the recorded scores, so a correction typed into the Round tab is already in this
 * table before it is looked at — there is no refresh, no invalidation and nothing to keep in step.
 *
 * A row shows the three things asked at the side of a court — where am I, who am I, how am I
 * scoring — and hides the two things asked afterwards behind a tap. Matches played and total
 * points explain a position rather than establish one, and a table that shows everything at once
 * is a table nobody can read across a court in the dark.
 *
 * Positions come from the engine and are rendered exactly as given: a joint second is `2` twice
 * and the next player is `4`. The app never invents a separator and never renumbers, because the
 * places a joint position occupies are used up (decision #8).
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { PlayerId } from 'padel-engine';
import { copy } from '../copy/copy';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-standings-tab',
  templateUrl: './standings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandingsTab {
  private readonly store = inject(SessionStore);
  private readonly expanded = signal<readonly PlayerId[]>([]);

  protected readonly copy = copy;
  protected readonly standings = this.store.standings;

  protected isExpanded(playerId: PlayerId): boolean {
    return this.expanded().includes(playerId);
  }

  protected toggle(playerId: PlayerId): void {
    this.expanded.update((open) =>
      open.includes(playerId) ? open.filter((id) => id !== playerId) : [...open, playerId],
    );
  }
}
