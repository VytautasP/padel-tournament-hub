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
}

function readDocument(raw: string): SessionRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const document = parsed as Partial<StoredDocument>;

  return document.version === FORMAT_VERSION && document.record ? document.record : null;
}
