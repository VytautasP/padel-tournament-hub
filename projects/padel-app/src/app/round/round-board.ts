/*
 * One round of an evening, paged: where the evening is, and how the rest of it is reached
 * (ADR-0016).
 *
 * It is a component with inputs and no store, because two screens show this same board about two
 * different sessions. The Round tab hands it the evening the organizer is running and takes back
 * the two things only an organizer does — a court tapped for a score, and one more round asked
 * for. The spectator's route hands it an evening somebody else is running and takes nothing back
 * at all: `organizing` is false, so the courts are not buttons and there is no Add round card
 * anywhere in the DOM. That is what ADR-0026 §2 means by read-only being structural rather than a
 * disabled control — nothing on the spectator's screen is a control that was turned off, because
 * the branch that renders one is never taken and the route it is rendered on has no way to write.
 *
 * It opens on the current round — the lowest-numbered round still holding an unscored match,
 * derived from the scores and never stored — and then stays there. Scoring the last court of a
 * round does not move the screen: the moment right after a score lands is exactly when a typo
 * gets spotted (ADR-0016 §3), so the round the organizer was looking at is the round they are
 * still looking at. What a played-out round offers instead is a `Round 4 →` card: a destination
 * to tap, not a screen that has already gone.
 *
 * The round on screen is therefore a signal the reader moves and nothing else does. Prev and
 * next walk every generated round, and `Back to current round` is the way back from wherever
 * paging left them — which is what lets one round at a time still answer "who am I with in round
 * six?" (ADR-0016 §2). All of that is paging rather than editing, so a spectator gets every bit
 * of it.
 *
 * One page past the last round is the Add round card. It is not a round, which is why the paging
 * range runs one beyond the round count rather than stopping at it: the place the evening visibly
 * runs out is the place the question gets asked (ADR-0016 §4), and it keeps a schedule-lengthening
 * button off the screen in use all night.
 *
 * Tapping a court opens the score sheet for that one match, scored or not. Courts finish minutes
 * apart and corrections are ordinary (ADR-0007), so there is one gesture rather than two.
 *
 * **A finished session is the same board with nothing to tap.** Every round it played is still
 * paged through, because that is what a record of an evening is for; the courts stop being
 * buttons, and the range stops one page earlier, because there is no round to add to a session the
 * engine will take no operations on (ADR-0009). Nothing here is disabled — a control that cannot
 * be used is still a control, and ADR-0013 asks for no editable control anywhere on a session read
 * out of history.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Session } from 'padel-engine';
import { copy } from '../copy/copy';
import { CourtCard } from './court-card';
import { currentRoundNumber } from '../session/current-round';
import { roundView } from './round-view';
import type { CourtView } from './round-view';

/** Rounds are numbered from one, which is where the paging range starts. */
const FIRST_ROUND = 1;

@Component({
  selector: 'app-round-board',
  imports: [CourtCard, NgTemplateOutlet],
  templateUrl: './round-board.html',
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundBoard {
  readonly session = input.required<Session>();
  /** What the organizer calls each court, or empty where they named none (ADR-0017 §6). */
  readonly courtNames = input<readonly string[]>([]);
  /**
   * Whether the reader is the one running this evening.
   *
   * False by default, which is the safe way round: a screen that forgot to say gets the board a
   * spectator gets, not a board offering to change somebody else's night.
   */
  readonly organizing = input(false);

  /** A court the organizer tapped, to be scored. Nothing emits this on a read-only board. */
  readonly scored = output<CourtView>();
  /** One more round, asked for from the card past the last one. */
  readonly roundWanted = output<void>();

  /**
   * Which evening this board is showing, as the one value that says "a different one".
   *
   * A `computed` rather than the expression inline in `requested`'s source, and that is
   * load-bearing: a source function reading `session()` makes the *session* the dependency, so
   * every score would look like a new evening and reset the page. Memoised into a string, the
   * dependency is the id, and a score changes nothing about it.
   */
  private readonly watching = computed(() => this.session().id);

  /**
   * The page the reader is on: where the board opened, until they page away from it.
   *
   * An evening in progress opens where it is — the lowest-numbered round still holding an unscored
   * match. A finished one opens at round one, because it has no "where it is" left: the lowest
   * unscored round of a session that has ended is a round nobody played, and opening a record
   * there would show an empty court instead of the evening.
   *
   * A `linkedSignal` is what makes both halves true at once. Everything the opening page is
   * computed from is read `untracked`, so a score landing does not move the screen (ADR-0016 §3);
   * and the source is `watching`, the session's id, so a board handed a *different* evening — which
   * is what `/s/A` becoming `/s/B` does to the one the router keeps — opens on that evening's own
   * round rather than staying on page four of somebody else's night.
   */
  private readonly requested = linkedSignal<string, number>({
    source: this.watching,
    computation: () =>
      untracked(() => (this.ended() ? FIRST_ROUND : currentRoundNumber(this.session()))),
  });

  protected readonly copy = copy;

  /** Whether this session is a record being read rather than an evening being run. */
  protected readonly ended = computed(() => this.session().status === 'finished');

  /**
   * Whether anything on this board can be tapped for anything but paging.
   *
   * Two conditions, one answer: the reader has to be the organizer, and the engine has to still
   * take operations on the evening (ADR-0009). A spectator and a record read out of history are
   * the same board for the same reason — there is nothing here either of them can change.
   */
  protected readonly interactive = computed(() => this.organizing() && !this.ended());

  protected readonly roundCount = computed(() => this.session().rounds.length);

  protected readonly round = computed(() =>
    roundView(this.session(), this.showing(), this.courtNames()),
  );

  /**
   * The last page there is something to show on: the Add round card while an organizer is running
   * the evening, and the last round otherwise.
   *
   * One expression rather than two, because it is the far end of the paging range as well as the
   * card's address — a range that stopped at the last round would put the card somewhere nobody
   * can page to, and a range that ran past it with no card there would page to a blank screen
   * offering nothing.
   */
  private readonly lastPage = computed(() =>
    this.interactive() ? this.roundCount() + 1 : this.roundCount(),
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
    () => !this.ended() && this.showing() !== currentRoundNumber(this.session()),
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
    this.show(currentRoundNumber(this.session()));
  }

  /**
   * Append one round and stay where the reader is standing.
   *
   * `showing` does not move: it was one past the last round, and the round just added is that
   * number, so the card the organizer tapped becomes the round they asked for.
   */
  protected addRound(): void {
    this.roundWanted.emit();
  }

  /** Open the sheet for one court, which is the caller's business rather than this board's. */
  protected score(court: CourtView): void {
    this.scored.emit(court);
  }
}
