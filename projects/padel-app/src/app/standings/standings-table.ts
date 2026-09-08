/*
 * The table itself: the podium, the rows, and what a tapped row shows underneath it (ADR-0008).
 *
 * It is a component with one input and no store, because two screens render this same table about
 * two different sessions. The Standings tab hands it the evening the organizer is running and adds
 * the one control there is — End session — underneath. The spectator's route hands it the evening
 * somebody else is running and adds nothing at all, which is what ADR-0026 §2 means by read-only
 * being structural: there is no control on this screen to hide, because the controls were never in
 * here to begin with.
 *
 * Nothing is computed here either. The rows arrive already ranked — the store asks the engine on
 * every read (decision #17) — so a correction typed into the Round tab is already in this table
 * before it is looked at, and there is no refresh and nothing to keep in step.
 *
 * A row shows the three things asked at the side of a court — where am I, who am I, how many
 * points have I got — and hides what is asked afterwards behind a tap. The record, the matches
 * played and the rounds benched explain a total rather than establish one, and a table that shows
 * everything at once is a table nobody can read across a court in the dark.
 *
 * A row is a competitor rather than a player: the same table ranks teams in Team Americano, and
 * the only thing that changes is the name in the middle column (ADR-0011). Nothing on this screen
 * asks what mode it is.
 *
 * The figure beside a name is the competitor's total, bench credits and all (ADR-0023). The app
 * neither computes it nor explains it: the expansion shows the terms and the reader does the
 * arithmetic if they want to.
 *
 * Positions come from the engine and are rendered exactly as given: a joint second is `2` twice
 * and the next player is `4`. The app never invents a separator and never renumbers, because the
 * places a joint position occupies are used up (decision #8).
 */
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { PlayerId, TeamId } from 'padel-engine';
import { copy } from '../copy/copy';
import { podiumOf } from './podium';
import type { Metal } from './podium';
import type { StandingRow } from './standing-row';

/**
 * The token each metal is drawn in, named here rather than in the template.
 *
 * A three-way choice written as nested ternaries in a class binding is unreadable, and written as
 * an `@switch` it is the medal drawn three times over. This is the one fact that changes between
 * the three places, so it is the only thing that varies.
 */
const METAL_INK: Record<Metal, string> = {
  gold: 'text-podium-gold',
  silver: 'text-podium-silver',
  bronze: 'text-podium-bronze',
};

@Component({
  selector: 'app-standings-table',
  templateUrl: './standings-table.html',
  /*
   * The host box is taken out of the layout: the podium and the list are laid out by whichever
   * screen holds them, in the same column and with the same gap as everything else on it. A
   * component that boxed its own two blocks would make the table's spacing a fact about the table
   * rather than about the screen, and the two screens that render it space their columns alike.
   */
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandingsTable {
  readonly standings = input.required<readonly StandingRow[]>();

  /** Which rows are open, by competitor id — a player's, or a team's (ADR-0011). */
  private readonly expanded = signal<readonly (PlayerId | TeamId)[]>([]);

  protected readonly copy = copy;
  protected readonly podium = computed(() => podiumOf(this.standings()));
  protected readonly metalInk = METAL_INK;

  protected isExpanded(id: PlayerId | TeamId): boolean {
    return this.expanded().includes(id);
  }

  protected toggle(id: PlayerId | TeamId): void {
    this.expanded.update((open) =>
      open.includes(id) ? open.filter((held) => held !== id) : [...open, id],
    );
  }
}
