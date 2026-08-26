/*
 * The active session, and the only thing in the app that calls the engine (decision #17).
 *
 * Screens read signals off this store and call methods on it; none of them calls an engine
 * operation of its own. That is what keeps the engine's surface reviewable — every rule the app
 * exercises passes through this one file — and what makes a screen testable by rendering it.
 * Reading the engine's *types* is not a call, and happens wherever a session is rendered.
 *
 * The store also owns the fact that reading a session is asynchronous. `restore()` runs once at
 * startup; until it settles, `ready()` is false and the app renders nothing rather than flashing
 * a landing page at an organizer who has an evening in progress.
 */
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  computeStandings,
  createSession,
  generateRemaining,
  recordScore,
  type RosterEntry,
  type ScoreEntry,
  type Session,
  type SessionMode,
  type Standing,
} from 'padel-engine';
import type { SessionRecord } from './session-record';
import { SESSION_REPOSITORY } from './session-repository';

/** Everything the wizard has collected by the time the organizer taps Create. */
export interface SessionDraft {
  readonly mode: SessionMode;
  /** The roster in the order it was typed. Ids are the store's business, not the wizard's. */
  readonly playerNames: readonly string[];
  readonly courtCount: number;
  readonly targetScore: number;
  readonly roundCount: number;
}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly repository = inject(SESSION_REPOSITORY);
  private readonly record = signal<SessionRecord | null>(null);
  private readonly restored = signal(false);

  /** False until the repository has been read once. */
  readonly ready = this.restored.asReadonly();

  readonly activeSession = computed<Session | null>(() => this.record()?.session ?? null);

  /**
   * The round the evening is on: the lowest-numbered generated round still holding an unscored
   * match (ADR-0016). Derived from the scores on every read and never stored, so correcting a
   * typo can move it backwards.
   */
  readonly currentRoundNumber = computed(() => {
    const session = this.activeSession();
    if (session === null) {
      return null;
    }

    const unfinished = session.rounds.find(
      (round) => round.matches.length > 0 && round.matches.some((match) => !match.score),
    );

    return (unfinished ?? session.rounds[session.rounds.length - 1]).number;
  });

  /**
   * The table, recomputed on every read and stored nowhere (decision #17).
   *
   * There is no invalidation here and nothing to keep in step: a corrected score changes the
   * session, the session is a signal, and the table is whatever the engine says about it now.
   */
  readonly standings = computed<readonly Standing[]>(() => {
    const session = this.activeSession();

    return session === null ? [] : computeStandings(session);
  });

  async restore(): Promise<void> {
    this.record.set(await this.repository.loadActive());
    this.restored.set(true);
  }

  /**
   * Build the evening the wizard describes, generate its schedule and make it the active session.
   *
   * The schedule is generated here rather than round by round during play because decision #6
   * needs a whole rotation to be fair at every prefix — a schedule built one round at a time
   * cannot see the rounds it has not planned yet.
   */
  async create(draft: SessionDraft): Promise<void> {
    const id = newSessionId();
    const session = generateRemaining(
      createSession({
        id,
        mode: draft.mode,
        players: draft.playerNames.map((name, index) => rosterEntry(id, index, name)),
        courtCount: draft.courtCount,
        targetScore: draft.targetScore,
        roundCount: draft.roundCount,
      }),
    );

    const record: SessionRecord = { session, createdAt: new Date().toISOString() };
    await this.repository.saveActive(record);
    this.record.set(record);
  }

  /**
   * Record one side's points for one match, replacing whatever was there.
   *
   * One number crosses this line and the engine derives the other (decision #3, ADR-0014), which
   * is why there is nothing to validate here: a scoreline that does not sum to the target is not
   * something this method could be asked for.
   */
  async score(entry: ScoreEntry): Promise<void> {
    const current = this.record();
    if (current === null) {
      throw new Error('There is no active session to score.');
    }

    const updated: SessionRecord = { ...current, session: recordScore(current.session, entry) };
    await this.repository.saveActive(updated);
    this.record.set(updated);
  }
}

/**
 * Roster ids derived from the session id and the order the names were typed.
 *
 * Derived rather than random because the engine seeds its tie-breaking from session data
 * (decision #6): ids that read the same way every time are what make a schedule reproducible from
 * the document alone when somebody disputes it. They are still stable ids and never indices —
 * decision #9's rule is that a roster change may not reassign anyone's results, and appending or
 * removing a name never renumbers the ids already handed out.
 */
function rosterEntry(sessionId: string, index: number, name: string): RosterEntry {
  return { id: `${sessionId}:p${index + 1}`, name };
}

function newSessionId(): string {
  return crypto.randomUUID();
}
