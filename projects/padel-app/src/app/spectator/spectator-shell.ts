/*
 * The evening as somebody who is not running it sees it: the same three tabs, and nothing to tap
 * (ADR-0026 §2).
 *
 * It is the organizer's shell with the chrome taken off rather than a different app. The rail and
 * the bar are the same components, the round board, the table and the roster list are the same
 * components, and what a spectator reads about round four is word for word what the organizer
 * reads about round four — which is the point. Two renderings of one evening that could disagree
 * would be worse than no spectator view at all: the argument at the side of the court would then
 * be about whose phone was right.
 *
 * What is gone is every control: no score sheet, no add round, no roster change, no end session,
 * no share. None of them is hidden or disabled — the boards are told they are not being organized
 * and never render one, and this route holds no store, so there is nothing here that could write
 * even if one appeared.
 *
 * The header says which evening this is, because a spectator arrived by scanning a square and has
 * no other way to know. At the desk the rail already says it, so the line is not said twice.
 *
 * There is no back button and no door. A spectator is not inside anything they can leave: the way
 * out of this page is the way into it, which is the browser.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { copy } from '../copy/copy';
import { destinationsAt, panelAt } from '../session/destinations';
import type { Panel } from '../session/destinations';
import { LAYOUT } from '../layout/layout';
import { RosterList } from '../players/roster-list';
import { RoundBoard } from '../round/round-board';
import { rosterView } from '../players/roster-view';
import { rowsOf } from '../standings/standing-row';
import { SessionRail } from '../session/session-rail';
import { StandingsTable } from '../standings/standings-table';
import { TabBar } from '../session/tab-bar';
import { currentRoundNumber } from '../session/current-round';
import { orphanedTeamsIn } from '../session/teams';
import type { SessionRecord } from '../session/session-record';

@Component({
  selector: 'app-spectator-shell',
  imports: [NgTemplateOutlet, RosterList, RoundBoard, SessionRail, StandingsTable, TabBar],
  templateUrl: './spectator-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpectatorShell {
  readonly record = input.required<SessionRecord>();

  private readonly tier = inject(LAYOUT).tier;

  /** The destination the spectator asked for. Held here; what is shown is `current`. */
  private readonly requested = signal<Panel>('round');

  protected readonly copy = copy;

  /** Whether the shell is wearing the rail and the aside rather than the bottom bar. */
  protected readonly atDesk = computed(() => this.tier() === 'desk');

  protected readonly destinations = computed(() => destinationsAt(this.atDesk()));
  protected readonly current = computed(() => panelAt(this.atDesk(), this.requested()));

  protected readonly session = computed(() => this.record().session);
  protected readonly courtNames = computed(() => this.record().courtNames);

  /** Which evening this is: the same sentence the organizer's rail says about the same night. */
  protected readonly summary = computed(() =>
    copy.spectator.summary(this.session().mode, this.session().roster.length),
  );

  /**
   * The table, derived from the session on every read, exactly as the organizer's is.
   *
   * Through `rowsOf` rather than through a store, because there is no store on this route and
   * nothing here to keep in step: the listener replaces the record, the record is a signal, and
   * the table is whatever the engine says about it now (decision #17).
   */
  protected readonly standings = computed(() => rowsOf(this.session()));

  /** The roster with this round's bench badged, which is how a spectator finds out they are out. */
  protected readonly players = computed(() =>
    rosterView(this.session(), currentRoundNumber(this.session()), orphanedTeamsIn(this.session())),
  );

  protected show(panel: Panel): void {
    this.requested.set(panel);
  }
}
