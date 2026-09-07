/*
 * The repository the tests run on, and the identity they run as (decision #19).
 *
 * It stores the record the way the real one does — as JSON — rather than holding the object it
 * was handed. A fake that keeps the live object would let a session carrying something
 * unserialisable pass every test and fail the first time an organizer closed the app, which is
 * exactly the class of bug this seam exists to catch.
 *
 * It answers for `Identity` as well, for the same reason `FirestoreSessionRepository` does: a
 * stored session carries the uid that wrote it (ADR-0024 §2), so a fake that had no uid would
 * hold records of a shape the real store never produces. `signIn` resolves immediately, because
 * a test is not a first launch in a basement — the app's behaviour when it *cannot* sign in is
 * asked of a repository that refuses to.
 */
import { Injectable } from '@angular/core';
import type { Identity } from './identity';
import type { SessionRecord } from './session-record';
import type { SessionRepository } from './session-repository';

/** The uid every fake writes as. One organizer, because a test only ever has one device. */
export const FAKE_UID = 'test-organizer';

@Injectable()
export class InMemorySessionRepository implements SessionRepository, Identity {
  private stored: string | null = null;
  private history: string = JSON.stringify([]);
  private watchers = new Set<(record: SessionRecord | null) => void>();

  async signIn(): Promise<string> {
    return FAKE_UID;
  }

  async loadActive(): Promise<SessionRecord | null> {
    return this.activeRecord();
  }

  async saveActive(record: SessionRecord): Promise<void> {
    this.stored = JSON.stringify({ ...record, ownerUid: FAKE_UID });
    this.announce();
  }

  async clearActive(): Promise<void> {
    this.stored = null;
    this.announce();
  }

  async loadHistory(): Promise<readonly SessionRecord[]> {
    return this.historyRecords();
  }

  async addToHistory(record: SessionRecord): Promise<void> {
    this.history = JSON.stringify([{ ...record, ownerUid: FAKE_UID }, ...this.historyRecords()]);
  }

  async deleteFromHistory(sessionId: string): Promise<void> {
    this.history = JSON.stringify(
      this.historyRecords().filter((held) => held.session.id !== sessionId),
    );
  }

  /**
   * The same live listener the real repository offers, driven by this fake's own writes.
   *
   * It fires on every write rather than only on a changed value, exactly as a Firestore snapshot
   * does for the client that made the write. A store that only worked when told about genuine
   * changes would be a store that broke on its own echo.
   */
  watchActive(onChange: (record: SessionRecord | null) => void): () => void {
    this.watchers.add(onChange);

    return () => this.watchers.delete(onChange);
  }

  /**
   * What the repository is holding, read the way a test reads it rather than the way the app
   * does — synchronously, so an assertion does not have to be `await`ed.
   */
  activeRecord(): SessionRecord | null {
    return this.stored === null ? null : (JSON.parse(this.stored) as SessionRecord);
  }

  /** Every ended session it is holding, read the same way, most recently ended first. */
  historyRecords(): readonly SessionRecord[] {
    return JSON.parse(this.history) as readonly SessionRecord[];
  }

  private announce(): void {
    const record = this.activeRecord();
    for (const watcher of this.watchers) {
      watcher(record);
    }
  }
}
