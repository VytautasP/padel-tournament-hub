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

  /**
   * Why the roster cannot go on to Review, as a code rather than a sentence.
   *
   * The draft names the problem; the step looks the wording up in the copy dictionary
   * (decision #20). Returning the sentence itself would put English in here, which is the one
   * place outside a template where it would be just as hard to find later.
   */
  readonly playersProblem = computed<PlayersProblem | null>(() =>
    this.entries().length < MINIMUM_PLAYERS ? 'too-few' : null,
  );

  readonly canLeavePlayers = computed(() => this.playersProblem() === null);

  addPlayer(name: string): void {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }

    this.entries.update((players) => [...players, { id: `d${this.nextId++}`, name: trimmed }]);
  }

  renamePlayer(id: string, name: string): void {
    const trimmed = name.trim();
    if (trimmed === '') {
      this.removePlayer(id);

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
    this.targetScore.set(atLeast(1, value, DEFAULT_TARGET_SCORE));
  }

  setCourtCount(value: number): void {
    this.courtCount.set(atLeast(1, value, DEFAULT_COURT_COUNT));
  }

  setRoundCount(value: number): void {
    this.chosenRoundCount.set(atLeast(1, value, this.suggestedRoundCount()));
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
 * A number field the organizer is halfway through retyping is empty, not zero.
 *
 * Clearing a field to type a different number would otherwise be a moment where the draft holds
 * a session that cannot exist, and the engine's shape check would refuse whatever the next
 * keystroke produced. Falling back keeps the draft always creatable.
 */
function atLeast(minimum: number, value: number, fallback: number): number {
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}
