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
import { copy } from '../copy/copy';
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
   * What has been typed into the court name fields, by court number, whether or not the court is
   * still in play.
   *
   * Kept full length rather than cut down with the court count, so that dropping a court and
   * putting it back does not lose the name it was given. Someone who typed "Far end", noticed the
   * club only booked one court and then found they had booked two after all has not changed their
   * mind about what the far end is called.
   */
  private readonly typedCourtNames = signal<readonly string[]>([]);

  /**
   * One name per court in play, pre-filled `Court 1…N`.
   *
   * The pre-fill is the dictionary's default rather than a blank field: the organizer who does
   * not care never touches these, and an empty row per court would read as a question they have
   * to answer. It is a starting value the organizer edits, which is why the English is allowed in
   * here where a sentence about the draft's own state would not be — this is the same string
   * their typing replaces.
   */
  readonly courtNames = computed<readonly string[]>(() => {
    const typed = this.typedCourtNames();

    return Array.from(
      { length: this.courtCount() },
      (_, index) => typed[index] ?? copy.round.courtName(index + 1),
    );
  });

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

  /**
   * Name one court, keeping whatever the organizer typed — including nothing at all.
   *
   * A blank is stored as a blank rather than snapped back to `Court N`. Clearing the field is a
   * deliberate gesture with a defined meaning (ADR-0017 §6), and rewriting it under the cursor
   * would make it impossible to perform. Nothing is trimmed here either — the field is bound to
   * what this holds, so trimming would delete the space a two-word name is typed through.
   */
  setCourtName(courtNumber: number, name: string): void {
    this.typedCourtNames.update((names) => {
      // Padded rather than assigned into, so naming court 3 before court 2 leaves court 2 holding
      // the default it was showing anyway rather than a hole. A sparse array reads the same
      // through `[]` but does not survive being iterated or serialised, and this one is read both
      // ways. Padding with the default is what keeps an untouched field distinct from a cleared
      // one — a cleared field holds the empty string, which is a different answer.
      const next = Array.from({ length: Math.max(names.length, courtNumber) }, (_, index) =>
        index < names.length ? names[index] : copy.round.courtName(index + 1),
      );
      next[courtNumber - 1] = name;

      return next;
    });
  }

  setRoundCount(value: number): void {
    this.chosenRoundCount.set(wholeNumber(value, this.roundCount()));
  }

  toSessionDraft(): SessionDraft {
    return {
      mode: this.mode(),
      playerNames: this.entries().map((player) => player.name),
      courtCount: this.courtCount(),
      courtNames: this.courtNames(),
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
