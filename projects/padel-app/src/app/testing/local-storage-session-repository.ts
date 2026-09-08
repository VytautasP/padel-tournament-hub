/*
 * A second test double: one session document in `localStorage` (ADR-0025 §1).
 *
 * This was the repository the app ran on for the whole of build-order step 2, and the swap that
 * step 3 made is the reason it is in `testing/` now rather than in `session/`. Firestore is the
 * only source of truth (ADR-0025 §1) — mirroring writes here as well would buy immunity to an
 * outage and cost the one thing this project has been careful about everywhere else, a single
 * place where a fact lives.
 *
 * It survives beside the in-memory fake because it is the only implementation that stores bytes
 * which outlive the process, and the two defensive choices below are worth keeping a test for.
 * Nothing in the running app provides it, and the sessions it holds on any device that ran step 2
 * are abandoned: history starts empty in production (ADR-0025 §5).
 *
 * Two defensive choices, both about the fact that the stored bytes outlive the code that wrote
 * them:
 *
 *   - The document is versioned. A record written by a future format is not guessed at.
 *   - Anything unreadable — absent, malformed, wrong version — reads back as "no active session"
 *     rather than throwing. An organizer opening the app to a crash has no way out; one opening
 *     it to the landing page can start again. The evening that produced the bad document is
 *     already lost either way.
 */
import { Injectable } from '@angular/core';
import type { SessionRecord } from '../session/session-record';
import type { SessionRepository } from '../session/session-repository';

/** Where the active session lives. Exported so a test can put a bad document there on purpose. */
export const STORAGE_KEY = 'padel-tournament-hub:active-session';
/**
 * Where every ended session lives, under a key of its own.
 *
 * Separate from the active session rather than one document holding both, because the two are
 * written at completely different rates: the active session is rewritten on every score, and
 * rewriting a year of history alongside each of those is work nobody asked for. Ending an evening
 * is the one moment both keys move, and it moves them one after the other.
 */
export const HISTORY_KEY = 'padel-tournament-hub:session-history';
/**
 * 2 since courts could be named (ADR-0017 §6).
 *
 * A version-1 document has no `courtNames`, so reading one back would hand the app a record that
 * does not have the shape its own type promises. Refusing it is what the version is for: the
 * alternative is a required field that is quietly absent at runtime, and a type nobody can trust
 * is worse than an evening that has to be started again.
 */
const FORMAT_VERSION = 2;

interface StoredDocument {
  readonly version: number;
  readonly record: SessionRecord;
}

interface StoredHistory {
  readonly version: number;
  readonly records: readonly SessionRecord[];
}

@Injectable()
export class LocalStorageSessionRepository implements SessionRepository {
  private watchers = new Set<(record: SessionRecord | null) => void>();
  /** The spectator's listeners, by the code each is watching. */
  private readonly codeWatchers = new Map<string, Set<(record: SessionRecord | null) => void>>();

  async loadActive(): Promise<SessionRecord | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }

    return readDocument(raw);
  }

  async saveActive(record: SessionRecord): Promise<void> {
    const document: StoredDocument = { version: FORMAT_VERSION, record };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
    await this.announce();
  }

  async clearActive(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    await this.announce();
  }

  async loadHistory(): Promise<readonly SessionRecord[]> {
    const raw = localStorage.getItem(HISTORY_KEY);

    return raw === null ? [] : readHistory(raw);
  }

  async addToHistory(record: SessionRecord): Promise<void> {
    await this.writeHistory([record, ...(await this.loadHistory())]);
  }

  async deleteFromHistory(sessionId: string): Promise<void> {
    const kept = (await this.loadHistory()).filter((held) => held.session.id !== sessionId);
    await this.writeHistory(kept);
  }

  /**
   * The live listener, over a store that has no way to notice a write of its own.
   *
   * `localStorage` fires `storage` events at *other* tabs and never at the one that wrote, so
   * this announces its own writes and nothing else. That is enough for what it is: a double whose
   * job is to prove the bytes survive a reload, not to prove two views of an evening converge.
   */
  watchActive(onChange: (record: SessionRecord | null) => void): () => void {
    this.watchers.add(onChange);

    return () => this.watchers.delete(onChange);
  }

  /**
   * The spectator's listener over this store, which knows both places a session can be.
   *
   * A code names one evening for the whole of its life (ADR-0024 §1), and ending one moves it
   * from the active document into the history document without changing what it is called. So
   * this looks in both rather than in the one the evening happened to be in when the listener
   * opened, exactly as the real repository's `get` finds one document either way.
   */
  watch(sessionId: string, onChange: (record: SessionRecord | null) => void): () => void {
    const watching = this.codeWatchers.get(sessionId) ?? new Set();
    watching.add(onChange);
    this.codeWatchers.set(sessionId, watching);
    void this.find(sessionId).then(onChange);

    return () => watching.delete(onChange);
  }

  private async announce(): Promise<void> {
    const record = await this.loadActive();
    for (const watcher of this.watchers) {
      watcher(record);
    }

    await this.announceToSpectators();
  }

  /** The other half of a write, told to whoever is watching a code. */
  private async announceToSpectators(): Promise<void> {
    for (const [sessionId, watching] of this.codeWatchers) {
      const held = await this.find(sessionId);
      for (const watcher of watching) {
        watcher(held);
      }
    }
  }

  /** The session at this code, wherever it is being kept, or `null` if it is kept nowhere. */
  private async find(sessionId: string): Promise<SessionRecord | null> {
    const active = await this.loadActive();
    if (active !== null && active.session.id === sessionId) {
      return active;
    }

    return (await this.loadHistory()).find((held) => held.session.id === sessionId) ?? null;
  }

  private async writeHistory(records: readonly SessionRecord[]): Promise<void> {
    const history: StoredHistory = { version: FORMAT_VERSION, records };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    await this.announceToSpectators();
  }
}

/**
 * The history, or an empty one where what is stored cannot be read.
 *
 * Same reasoning as `readDocument`, one level up: an unreadable history is a landing page with no
 * history on it, not a crash on launch. It is the more painful of the two failures — a year of
 * evenings rather than tonight's — which is an argument for the version being checked, not for
 * throwing at an organizer who cannot do anything about it either way.
 */
function readHistory(raw: string): readonly SessionRecord[] {
  const parsed = parseObject(raw) as Partial<StoredHistory> | null;

  return parsed?.version === FORMAT_VERSION && Array.isArray(parsed.records) ? parsed.records : [];
}

function readDocument(raw: string): SessionRecord | null {
  const document = parseObject(raw) as Partial<StoredDocument> | null;

  return document?.version === FORMAT_VERSION && document.record ? document.record : null;
}

/** What `raw` parses to if it parses to an object at all, and `null` for everything else. */
function parseObject(raw: string): object | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return typeof parsed === 'object' && parsed !== null ? parsed : null;
}
