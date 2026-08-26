/*
 * The evening being described, while it is still only being described (ADR-0017).
 *
 * Nothing in here reaches a repository. The wizard holds one of these from the moment it opens
 * until the organizer taps Create, and abandoning the wizard drops it — which is the whole of
 * "abandoning the wizard leaves no trace". Back is non-destructive for the same reason: the steps
 * render this object rather than owning anything, so stepping away from one and returning to it
 * cannot lose what was typed.
 *
 * It is a plain class rather than a service because its lifetime is the wizard's, not the app's.
 * Two of these would be two half-described evenings, and there is only ever one.
 */
import { computed, signal } from '@angular/core';
import type { SessionMode } from 'padel-engine';
import {
  completeRotationRoundCount,
  DEFAULT_COURT_COUNT,
  DEFAULT_TARGET_SCORE,
  MINIMUM_PLAYERS,
  MINIMUM_SESSION_NUMBER,
} from '../session/round-defaults';
import type { SessionDraft } from '../session/session-store';

/** A name on the list, with an id so that editing or removing it never depends on its position. */
export interface DraftPlayer {
  readonly id: string;
  readonly name: string;
}

/** The one thing that can be wrong with a roster in this slice (decision #4). */
export type PlayersProblem = 'too-few';

export class WizardDraft {
  readonly mode = signal<SessionMode>('americano');
  readonly targetScore = signal(DEFAULT_TARGET_SCORE);
  readonly courtCount = signal(DEFAULT_COURT_COUNT);

  private readonly entries = signal<readonly DraftPlayer[]>([]);
  private nextId = 1;

  readonly players = this.entries.asReadonly();

  /**
   * The round count Review pre-fills: a complete rotation for this roster on these courts.
   *
   * It tracks the roster and the court count until the organizer types a number of their own, and
   * stops the moment they do. Someone who has said "eight rounds" means eight rounds, and having
   * that quietly rewritten by going back to add a late arrival is the kind of thing that is only
   * noticed after the evening has run the wrong length.
   */
  readonly suggestedRoundCount = computed(() =>
    completeRotationRoundCount(this.entries().length, this.courtCount()),
  );

  private readonly chosenRoundCount = signal<number | null>(null);

  readonly roundCount = computed(() => this.chosenRoundCount() ?? this.suggestedRoundCount());

  /** Whether the roster is one the engine could schedule (decision #4). */
  readonly canLeavePlayers = computed(() => this.entries().length >= MINIMUM_PLAYERS);

  /**
   * Why the roster cannot go on to Review, as a code rather than a sentence — and only once
   * there is a roster to have a problem with.
   *
   * An empty list is not a mistake anybody has made yet. Telling someone who has opened the
   * screen and typed nothing that they need four players is nagging, and it means the sentence is
   * already on screen when the moment it exists for — a third name, and no fourth — arrives.
   *
   * The draft names the problem; the step looks the wording up in the copy dictionary
   * (decision #20). Returning the sentence itself would put English in here, which is the one
   * place outside a template where it would be just as hard to find later.
   */
  readonly playersProblem = computed<PlayersProblem | null>(() =>
    this.entries().length > 0 && !this.canLeavePlayers() ? 'too-few' : null,
  );

  addPlayer(name: string): void {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }

    this.entries.update((players) => [...players, { id: `d${this.nextId++}`, name: trimmed }]);
  }

  /**
   * Correct a name that is already on the list.
   *
   * A blank correction leaves the player alone rather than removing them. Deleting somebody by
   * clearing a field would be a destructive gesture with no visible affordance and no way back —
   * and removing is already one tap on the row itself.
   */
  renamePlayer(id: string, name: string): void {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }

    this.entries.update((players) =>
      players.map((player) => (player.id === id ? { ...player, name: trimmed } : player)),
    );
  }

  removePlayer(id: string): void {
    this.entries.update((players) => players.filter((player) => player.id !== id));
  }

  setTargetScore(value: number): void {
    this.targetScore.set(wholeNumber(value, this.targetScore()));
  }

  setCourtCount(value: number): void {
    this.courtCount.set(wholeNumber(value, this.courtCount()));
  }

  setRoundCount(value: number): void {
    this.chosenRoundCount.set(wholeNumber(value, this.roundCount()));
  }

  toSessionDraft(): SessionDraft {
    return {
      mode: this.mode(),
      playerNames: this.entries().map((player) => player.name),
      courtCount: this.courtCount(),
      targetScore: this.targetScore(),
      roundCount: this.roundCount(),
    };
  }
}

/**
 * What a number field is worth after a keystroke.
 *
 * `NumberField` has already refused anything below the minimum, so this is the draft defending
 * its own state rather than a second opinion about the same keystroke: a value that never came
 * from a field — a stored draft, a future caller — cannot put the evening into a shape the engine
 * would refuse. A field the organizer has emptied on the way to typing something else holds no
 * number at all, and the draft keeps what it had.
 */
function wholeNumber(value: number, current: number): number {
  if (!Number.isFinite(value)) {
    return current;
  }

  return Math.max(MINIMUM_SESSION_NUMBER, Math.floor(value));
}
