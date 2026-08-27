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
import type { Gender, SessionMode } from 'padel-engine';
import { copy } from '../copy/copy';
import {
  completeRotationRoundCount,
  completeTeamRotationRoundCount,
  DEFAULT_COURT_COUNT,
  DEFAULT_TARGET_SCORE,
  MINIMUM_PLAYERS,
  MINIMUM_SESSION_NUMBER,
  PLAYERS_PER_TEAM,
} from '../session/round-defaults';
import { newPlayer } from '../session/session-store';
import type { DraftPairing, SessionDraft } from '../session/session-store';

/** A name on the list, with an id so that editing or removing it never depends on its position. */
export interface DraftPlayer {
  readonly id: string;
  readonly name: string;
  /**
   * Answered on the row, and only in Mixicano. Undefined is **not asked yet** rather than a third
   * answer: the toggle has no default (ADR-0010), so this is what an untouched row holds and what
   * blocks the step.
   */
  readonly gender?: Gender;
}

/**
 * What can be wrong with a roster on its way to Review.
 *
 * Two codes rather than one sentence, because the two are different questions with different
 * answers: `too-few` is about how many names there are, `gender-missing` about a question the
 * organizer has not answered on one of them.
 */
export type PlayersProblem = 'too-few' | 'gender-missing' | 'odd-roster';

/** A pair the organizer has made on the pairing step, by draft player id. */
export type DraftPair = readonly [string, string];

/** A team as the pairing step renders it: who is on it, and what it is called. */
export interface DraftTeam {
  /** Addressed by its first member, which is stable while the pair exists and unique across it. */
  readonly key: string;
  readonly playerIds: DraftPair;
  readonly names: readonly string[];
}

export class WizardDraft {
  readonly mode = signal<SessionMode>('americano');
  readonly targetScore = signal(DEFAULT_TARGET_SCORE);
  readonly courtCount = signal(DEFAULT_COURT_COUNT);

  private readonly entries = signal<readonly DraftPlayer[]>([]);
  private readonly pairs = signal<readonly DraftPair[]>([]);
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
    // A complete rotation is over whatever this mode rotates: partnerships in the modes that make
    // new ones every round, and the fixture list where the pairs are fixed (ADR-0011).
    this.asksPairing()
      ? completeTeamRotationRoundCount(
          Math.floor(this.entries().length / PLAYERS_PER_TEAM),
          this.courtCount(),
        )
      : completeRotationRoundCount(this.entries().length, this.courtCount()),
  );

  private readonly chosenRoundCount = signal<number | null>(null);

  readonly roundCount = computed(() => this.chosenRoundCount() ?? this.suggestedRoundCount());

  /**
   * Whether this evening pairs across gender — the whole of whether the roster is asked at all.
   *
   * Asked once here rather than at each of the three places that care, because Back is
   * non-destructive: a draft can be carried into Mixicano, answered, carried back out again, and
   * every one of those places has to agree about which mode it is now in.
   */
  private readonly asksGender = computed(() => this.mode() === 'mixicano');

  /**
   * Whether this evening is played by fixed pairs — the whole of whether the pairing step exists.
   *
   * Asked here for the same reason the gender question is: Back is non-destructive, so a draft
   * can be carried into Team Americano, paired, carried back out again, and the wizard, the
   * roster step and the pairing step all have to agree about which mode it is now in.
   */
  readonly asksPairing = computed(() => this.mode() === 'team-americano');

  /**
   * Whether every name on the list carries the gender its mode needs (ADR-0010).
   *
   * True for every mode that does not pair across gender, because there is nothing to ask. In
   * Mixicano it is the create screen enforcing what the engine refuses: there is no
   * "unspecified" it would schedule around, so a roster with a gap cannot become a session.
   */
  private readonly everyGenderAnswered = computed(
    () => !this.asksGender() || this.entries().every((player) => player.gender !== undefined),
  );

  /**
   * Whether the roster divides into pairs — asked of every mode, and true of the ones that do not
   * pair at all (decision #2a).
   *
   * An odd roster is held at the Players step rather than at the pairing step, because a pairing
   * step reached with somebody left over has nothing it can show: there is no pair to make out of
   * the ninth of nine, and the honest place to say so is the screen the ninth name is on.
   */
  private readonly rosterDividesIntoPairs = computed(
    () => !this.asksPairing() || this.entries().length % PLAYERS_PER_TEAM === 0,
  );

  /** Whether the roster is one the engine could schedule (decision #4, ADR-0010). */
  readonly canLeavePlayers = computed(
    () =>
      this.entries().length >= MINIMUM_PLAYERS &&
      this.everyGenderAnswered() &&
      this.rosterDividesIntoPairs(),
  );

  /**
   * The pairs the organizer has made, in the order they made them.
   *
   * Pruned to the roster on every read rather than edited when a name is removed. Back is
   * non-destructive, so the roster can move underneath a pairing that was already made — and a
   * pair naming somebody who is no longer on the list is not a team, it is a stale index into a
   * list that has changed.
   */
  private readonly livePairs = computed<readonly DraftPair[]>(() => {
    const present = new Set(this.entries().map((player) => player.id));

    return this.pairs().filter(([first, second]) => present.has(first) && present.has(second));
  });

  /** The teams as the pairing step shows them: the pair, and the two names on it. */
  readonly teams = computed<readonly DraftTeam[]>(() => {
    const names = new Map(this.entries().map((player) => [player.id, player.name]));

    return this.livePairs().map((playerIds) => ({
      key: playerIds[0],
      playerIds,
      names: playerIds.map((id) => names.get(id) ?? id),
    }));
  });

  /** Whoever is still standing on their own, in roster order. */
  readonly unpaired = computed<readonly DraftPlayer[]>(() => {
    const taken = new Set(this.livePairs().flat());

    return this.entries().filter((player) => !taken.has(player.id));
  });

  /** Whether every player has a partner, which is the whole of what the pairing step asks. */
  readonly canLeavePairing = computed(() => this.unpaired().length === 0);

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
  readonly playersProblem = computed<PlayersProblem | null>(() => {
    if (this.entries().length === 0) {
      return null;
    }
    if (this.entries().length < MINIMUM_PLAYERS) {
      return 'too-few';
    }

    // Reported only once there are enough names to go on with, so a roster halfway through being
    // typed is told one thing at a time. The untouched toggles are visible on the rows either way.
    if (!this.everyGenderAnswered()) {
      return 'gender-missing';
    }

    return this.rosterDividesIntoPairs() ? null : 'odd-roster';
  });

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

  /**
   * Answer the gender question for one player.
   *
   * There is no un-answering it, because the toggle is two states and not three: the way back
   * from a mis-tap is the other half of the toggle, and a roster entry that could return to
   * "not asked" would be a gap the organizer had to notice a second time.
   */
  setGender(id: string, gender: Gender): void {
    this.entries.update((players) =>
      players.map((player) => (player.id === id ? { ...player, gender } : player)),
    );
  }

  /**
   * Put two players on a team together.
   *
   * Either one already being on a team is ignored rather than rearranged: the step only offers
   * unpaired names, so this is the draft defending its own state — a pairing that took somebody
   * off one team and put them on another would leave their old partner standing alone without
   * anybody having said so.
   */
  pair(first: string, second: string): void {
    const taken = new Set(this.livePairs().flat());
    if (first === second || taken.has(first) || taken.has(second)) {
      return;
    }

    this.pairs.update((made) => [...made, [first, second]]);
  }

  /** Break up the team this player is on, returning both names to the unpaired list. */
  unpair(playerId: string): void {
    this.pairs.update((made) => made.filter((pair) => !pair.includes(playerId)));
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

  /**
   * The pairing as the store takes it: positions in the roster it is about to be handed.
   *
   * Positions rather than the draft's own ids, because roster ids are the store's business — they
   * are derived from the session id and the order the names arrived in, and a wizard that supplied
   * them could break the reproducibility that derivation exists for (`session-store.ts`).
   */
  private draftTeams(): readonly DraftPairing[] {
    const position = new Map(this.entries().map((player, index) => [player.id, index]));

    return this.livePairs().flatMap(([first, second]) => {
      const one = position.get(first);
      const other = position.get(second);

      // A pair naming somebody the roster no longer holds is dropped rather than defaulted. Both
      // halves are on the list by construction — `livePairs` is pruned to it — and a miss that
      // quietly became "the first name typed" would pair two people who never agreed to it.
      return one === undefined || other === undefined ? [] : [[one, other] as const];
    });
  }

  toSessionDraft(): SessionDraft {
    return {
      mode: this.mode(),
      // The answers are dropped where the mode stopped asking. Someone who described a Mixicano,
      // stepped back and chose Americano has described an Americano, and a gender riding along on
      // its roster would be an answer to a question this evening never put.
      players: this.entries().map((player) =>
        newPlayer(player.name, this.asksGender() ? player.gender : undefined),
      ),
      // Dropped where the mode stopped asking, like the genders above: a draft paired as a Team
      // Americano and then carried back out is an Americano, and teams on it would be a pairing
      // this evening never made. The engine refuses them there anyway (`session-shape.ts`).
      ...(this.asksPairing() ? { teams: this.draftTeams() } : {}),
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
