/*
 * The Round tab: where the evening actually is, and how the rest of it is reached (ADR-0016).
 *
 * It opens on the current round — the lowest-numbered round still holding an unscored match,
 * derived from the scores and never stored — and then stays there. Scoring the last court of a
 * round does not move the screen: the moment right after a score lands is exactly when a typo
 * gets spotted (ADR-0016 §3), so the round the organizer was looking at is the round they are
 * still looking at. What a played-out round offers instead is a `Round 4 →` card: a destination
 * to tap, not a screen that has already gone.
 *
 * The round on screen is therefore a signal the organizer moves and nothing else does. Prev and
 * next walk every generated round, and `Back to current round` is the way back from wherever
 * paging left them — which is what lets one round at a time still answer "who am I with in round
 * six?" (ADR-0016 §2).
 *
 * One page past the last round is the Add round card. It is not a round, which is why the paging
 * range runs one beyond the round count rather than stopping at it: the place the evening visibly
 * runs out is the place the question gets asked (ADR-0016 §4), and it keeps a schedule-lengthening
 * button off the screen in use all night.
 *
 * Tapping a court opens the score sheet for that one match, scored or not. Courts finish minutes
 * apart and corrections are ordinary (ADR-0007), so there is one gesture rather than two.
 *
 * **A finished session is the same tab with nothing to tap.** Every round it played is still paged
 * through, because that is what a record of an evening is for; the courts stop being buttons, and
 * the range stops one page earlier, because there is no round to add to a session the engine will
 * take no operations on (ADR-0009). Nothing here is disabled — a control that cannot be used is
 * still a control, and ADR-0013 asks for no editable control anywhere on a session read out of
 * history.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { copy } from '../copy/copy';
import { roundView } from './round-view';
import type { CourtView } from './round-view';
import { openScoreSheet } from '../score/score-sheet';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-round-tab',
  imports: [NgTemplateOutlet],
  templateUrl: './round-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundTab {
  private readonly store = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  /**
   * The page the organizer has asked for. Set when the tab opens, moved only by them, and never by
   * a score landing.
   *
   * An evening in progress opens where it is. A finished one opens at round one, because it has
   * no "where it is" left — the lowest unscored round of a session that has ended is a round
   * nobody played, and opening a record there would show an empty court instead of the evening.
   */
  private readonly requested = signal(
    this.store.ended() ? FIRST_ROUND : (this.store.currentRoundNumber() ?? FIRST_ROUND),
  );

  protected readonly copy = copy;

  /** Whether this session is a record being read rather than an evening being run. */
  protected readonly ended = this.store.ended;

  protected readonly roundCount = computed(() => this.store.openSession()?.rounds.length ?? 0);

  protected readonly round = computed(() => {
    const session = this.store.openSession();

    return session === null ? null : roundView(session, this.showing(), this.store.courtNames());
  });

  /**
   * The last page there is something to show on: the Add round card while the evening is running,
   * and the last round once it has ended.
   *
   * One expression rather than two, because it is the far end of the paging range as well as the
   * card's address — a range that stopped at the last round would put the card somewhere the
   * organizer cannot page to, and a range that ran past it on a finished session would page to a
   * blank screen offering nothing.
   */
  private readonly lastPage = computed(() =>
    this.ended() ? this.roundCount() : this.roundCount() + 1,
  );

  /**
   * The page actually on screen: what was asked for, held inside the range there is something to
   * show.
   *
   * Derived rather than clamped on the way in, because the range moves underneath it. Ending the
   * evening takes the Add round card away, and an organizer standing on that card when they end
   * the session would otherwise be left on a page that no longer exists — looking at a button that
   * asks the engine for a round it has already refused to give.
   */
  protected readonly showing = computed(() =>
    Math.min(Math.max(this.requested(), FIRST_ROUND), this.lastPage()),
  );

  /** Whether the page on screen is the Add round card rather than a round. */
  protected readonly pastTheLastRound = computed(() => this.showing() > this.roundCount());

  protected readonly canPage = computed(() => ({
    back: this.showing() > FIRST_ROUND,
    forward: this.showing() < this.lastPage(),
  }));

  /**
   * Whether the way back to the current round is worth offering.
   *
   * Not on the round the evening is already on, and not on a finished session at all: an evening
   * that has ended has no round it is on, so a link back to one would be pointing at whichever
   * round happened to be unscored when the lights went off.
   */
  protected readonly canReturnToCurrentRound = computed(
    () => !this.ended() && this.showing() !== this.store.currentRoundNumber(),
  );

  /**
   * The round to offer once every court on screen has a score, or `null` while one is still
   * playing or when this is the last round generated.
   *
   * There is deliberately no offer past the last round: what is there is the Add round card, and
   * a `Round 4 →` that led to it would be selling one more round as the natural next step rather
   * than as the decision it is.
   */
  protected readonly advanceTo = computed(() => {
    const view = this.round();
    const finished = view !== null && view.courts.every((court) => court.score !== undefined);

    return finished && this.showing() < this.roundCount() ? this.showing() + 1 : null;
  });

  protected previous(): void {
    this.show(this.showing() - 1);
  }

  protected next(): void {
    this.show(this.showing() + 1);
  }

  /** Ask for one page. What is shown is `showing`, which holds it inside the range. */
  protected show(page: number): void {
    this.requested.set(page);
  }

  protected backToCurrentRound(): void {
    this.show(this.store.currentRoundNumber() ?? FIRST_ROUND);
  }

  /**
   * Append one round and stay where the organizer is standing.
   *
   * `showing` does not move: it was one past the last round, and the round just added is that
   * number, so the card the organizer tapped becomes the round they asked for.
   */
  protected async addRound(): Promise<void> {
    await this.store.addRound();
  }

  /** Open the sheet for one court, and record whatever comes back out of it. */
  protected async score(court: CourtView): Promise<void> {
    const session = this.store.openSession();
    if (session === null) {
      return;
    }

    const entry = await openScoreSheet(this.dialog, this.overlay, {
      court,
      targetScore: session.targetScore,
    });

    if (entry !== undefined) {
      await this.store.score(entry);
    }
  }
}

/** Rounds are numbered from one, which is where the paging range starts. */
const FIRST_ROUND = 1;
