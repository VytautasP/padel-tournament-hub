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
 * One page past the last round is the Add round card. It is not a round, which is why `showing`
 * ranges one beyond the round count rather than being clamped to it: the place the evening
 * visibly runs out is the place the question gets asked (ADR-0016 §4), and it keeps a
 * schedule-lengthening button off the screen in use all night.
 *
 * Tapping a court opens the score sheet for that one match, scored or not. Courts finish minutes
 * apart and corrections are ordinary (ADR-0007), so there is one gesture rather than two.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { copy } from '../copy/copy';
import { roundView } from './round-view';
import type { CourtView } from './round-view';
import { openScoreSheet } from '../score/score-sheet';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-round-tab',
  templateUrl: './round-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundTab {
  private readonly store = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  /**
   * The page the tab is showing: a round number, or one past the last round for the Add round
   * card. Set when the tab opens, moved only by the organizer, and never by a score landing.
   */
  private readonly showing = signal(this.store.currentRoundNumber() ?? FIRST_ROUND);

  protected readonly copy = copy;

  protected readonly roundCount = computed(() => this.store.activeSession()?.rounds.length ?? 0);

  protected readonly round = computed(() => {
    const session = this.store.activeSession();

    return session === null ? null : roundView(session, this.showing(), this.store.courtNames());
  });

  /** Whether the page on screen is the Add round card rather than a round. */
  protected readonly pastTheLastRound = computed(() => this.showing() > this.roundCount());

  protected readonly canPage = computed(() => ({
    back: this.showing() > FIRST_ROUND,
    forward: this.showing() <= this.roundCount(),
  }));

  /** Whether the round on screen is the one the evening is on, which is when there is no way back. */
  protected readonly atCurrentRound = computed(
    () => this.showing() === this.store.currentRoundNumber(),
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

  protected page(by: number): void {
    this.showing.update((page) => page + by);
  }

  protected show(roundNumber: number): void {
    this.showing.set(roundNumber);
  }

  protected backToCurrentRound(): void {
    this.showing.set(this.store.currentRoundNumber() ?? FIRST_ROUND);
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
    const session = this.store.activeSession();
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

/** Rounds are numbered from one, so a session with nothing derivable yet shows the first. */
const FIRST_ROUND = 1;
