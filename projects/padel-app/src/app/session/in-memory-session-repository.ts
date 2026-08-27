/*
 * The repository the tests run on (decision #19).
 *
 * It stores the record the way the real one does — as JSON — rather than holding the object it
 * was handed. A fake that keeps the live object would let a session carrying something
 * unserialisable pass every test and fail the first time an organizer closed the app, which is
 * exactly the class of bug this seam exists to catch.
 */
import { Injectable } from '@angular/core';
import type { SessionRecord } from './session-record';
import type { SessionRepository } from './session-repository';

@Injectable()
export class InMemorySessionRepository implements SessionRepository {
  private stored: string | null = null;
  private history: string = JSON.stringify([]);

  async loadActive(): Promise<SessionRecord | null> {
    return this.activeRecord();
  }

  async saveActive(record: SessionRecord): Promise<void> {
    this.stored = JSON.stringify(record);
  }

  async clearActive(): Promise<void> {
    this.stored = null;
  }

  async loadHistory(): Promise<readonly SessionRecord[]> {
    return this.historyRecords();
  }

  async addToHistory(record: SessionRecord): Promise<void> {
    this.history = JSON.stringify([record, ...this.historyRecords()]);
  }

  async deleteFromHistory(sessionId: string): Promise<void> {
    this.history = JSON.stringify(
      this.historyRecords().filter((held) => held.session.id !== sessionId),
    );
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
}
