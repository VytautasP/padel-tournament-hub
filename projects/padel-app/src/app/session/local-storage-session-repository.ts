/*
 * The repository the app runs on: one session document in `localStorage` (decision #23, step 2).
 *
 * This is the only file in the app that names a storage API. That is the entire point of
 * decision #19 — when Firestore arrives in step 3 it arrives as a sibling of this file and
 * nothing above it changes.
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
import type { SessionRecord } from './session-record';
import type { SessionRepository } from './session-repository';

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
  }

  async clearActive(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
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

  private async writeHistory(records: readonly SessionRecord[]): Promise<void> {
    const history: StoredHistory = { version: FORMAT_VERSION, records };
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
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
