/*
 * The repository the tests run on, and the identity they run as (decision #19).
 *
 * It answers the spectator's listener as well, out of the same pile: `watch` is the one operation
 * here that is not scoped to whoever is signed in, because a share code is not (ADR-0029 §1).
 *
 * It stores the record the way the real one does — as JSON — rather than holding the object it
 * was handed. A fake that kept the live object would let a session carrying something
 * unserialisable pass every test and fail the first time an organizer closed the app, which is
 * exactly the class of bug this seam exists to catch.
 *
 * It answers for `Identity` as well, for the same reason `FirestoreSessionRepository` does: a
 * stored session carries the uid that wrote it (ADR-0024 §2), so a fake that had no uid would
 * hold records of a shape the real store never produces. `signIn` resolves immediately, because
 * a test is not a first launch in a basement — the app's behaviour when it *cannot* sign in is
 * asked of a repository that refuses to.
 *
 * **Sessions are kept apart by uid, and Google accounts are kept apart from the browser.** Both
 * halves are what ADR-0028 is about and neither is decoration. A fake that stored one pile of
 * sessions for one organizer could not tell a link that keeps the uid from a sign-in that changes
 * it — the two look identical until somebody asks whose evenings are on screen. And a fake whose
 * account list died with the browser could not describe the case the whole feature exists for:
 * `clearSiteData` throws the uid away exactly as clearing site data does, while the accounts map
 * survives, because that half lives on Firebase's servers.
 */
import { Injectable } from '@angular/core';
import type { Durability, Identity, LinkOutcome } from './identity';
import type { SessionRecord } from './session-record';
import type { SessionRepository } from './session-repository';

/** The uid every fake writes as, until a test opens the app in a browser that has never run it. */
export const FAKE_UID = 'test-organizer';

/**
 * The Google account every fake links. One, because a test has one organizer — what varies is
 * which uid it belongs to, and that is the whole of what ADR-0028 §2 is about.
 */
export const FAKE_ACCOUNT = 'organizer@example.com';

/** One organizer's sessions: the evening in progress, and every evening they have ended. */
interface Owned {
  active: string | null;
  history: string;
}

@Injectable()
export class InMemorySessionRepository implements SessionRepository, Identity {
  private readonly owners = new Map<string, Owned>();
  /** Which uid each Google account belongs to. Firebase's side of the line, so it outlives a uid. */
  private readonly accounts = new Map<string, string>();
  private readonly watchers = new Set<(record: SessionRecord | null) => void>();
  /** The spectator's listeners, by the code each is watching (ADR-0029 §1). */
  private readonly codeWatchers = new Map<string, Set<(record: SessionRecord | null) => void>>();
  private uid = FAKE_UID;
  private browsers = 0;

  async signIn(): Promise<string> {
    return this.uid;
  }

  durability(): Durability {
    return this.accounts.get(FAKE_ACCOUNT) === this.uid
      ? { kind: 'linked', account: FAKE_ACCOUNT }
      : { kind: 'browser' };
  }

  async linkGoogle(): Promise<LinkOutcome> {
    const held = this.accounts.get(FAKE_ACCOUNT);
    if (held !== undefined && held !== this.uid) {
      return {
        kind: 'taken',
        account: FAKE_ACCOUNT,
        adopt: async () => {
          this.uid = held;

          return held;
        },
      };
    }

    this.accounts.set(FAKE_ACCOUNT, this.uid);

    return { kind: 'linked', account: FAKE_ACCOUNT };
  }

  /**
   * What clearing site data does: the browser forgets its uid and Firebase mints a fresh anonymous
   * one, while every session already written stays where it is, owned by a uid nobody holds.
   *
   * The loss decision #14 exists to undo, in one line a spec can cause on purpose.
   */
  clearSiteData(): void {
    this.browsers += 1;
    this.uid = `${FAKE_UID}-${this.browsers}`;
  }

  async loadActive(): Promise<SessionRecord | null> {
    return this.activeRecord();
  }

  async saveActive(record: SessionRecord): Promise<void> {
    this.owned().active = JSON.stringify({ ...record, ownerUid: this.uid });
    this.announce();
  }

  async clearActive(): Promise<void> {
    this.owned().active = null;
    this.announce();
  }

  async loadHistory(): Promise<readonly SessionRecord[]> {
    return this.historyRecords();
  }

  async addToHistory(record: SessionRecord): Promise<void> {
    this.owned().history = JSON.stringify([
      { ...record, ownerUid: this.uid },
      ...this.historyRecords(),
    ]);
    this.announceToSpectators();
  }

  async deleteFromHistory(sessionId: string): Promise<void> {
    this.owned().history = JSON.stringify(
      this.historyRecords().filter((held) => held.session.id !== sessionId),
    );
    this.announceToSpectators();
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
   * The spectator's listener, which is the one operation here that is not about whose sessions
   * these are.
   *
   * Every other method on this fake reads and writes the pile belonging to the uid it is signed in
   * as, because that is what ADR-0028 is about. This one looks through all of them: a spectator is
   * not the organizer, holds no uid of theirs, and finds the evening by the code alone — which is
   * exactly what `allow get: if true` means in `firestore.rules`. A fake scoped to the caller's
   * own sessions could not tell a spectator watching somebody else's evening from an organizer
   * reading their own, which is the whole of what this route is.
   *
   * It reports at once, as a document listener does: the first snapshot is the state now.
   */
  watch(sessionId: string, onChange: (record: SessionRecord | null) => void): () => void {
    const watching = this.codeWatchers.get(sessionId) ?? new Set();
    watching.add(onChange);
    this.codeWatchers.set(sessionId, watching);
    onChange(this.find(sessionId));

    return () => watching.delete(onChange);
  }

  /**
   * What the repository is holding for whoever is signed in, read the way a test reads it rather
   * than the way the app does — synchronously, so an assertion does not have to be `await`ed.
   */
  activeRecord(): SessionRecord | null {
    const stored = this.owned().active;

    return stored === null ? null : (JSON.parse(stored) as SessionRecord);
  }

  /** Every ended session it is holding for them, read the same way, most recently ended first. */
  historyRecords(): readonly SessionRecord[] {
    return JSON.parse(this.owned().history) as readonly SessionRecord[];
  }

  private owned(): Owned {
    const held = this.owners.get(this.uid) ?? { active: null, history: JSON.stringify([]) };
    this.owners.set(this.uid, held);

    return held;
  }

  private announce(): void {
    const record = this.activeRecord();
    for (const watcher of this.watchers) {
      watcher(record);
    }

    this.announceToSpectators();
  }

  /**
   * The other half of a write, told to whoever is watching a code.
   *
   * Separate from the active listeners because the two are told by different writes. Ending an
   * evening writes the history and then empties the active slot, and a spectator is watching the
   * same session through both — while the organizer's listener has nothing to hear from the first
   * of them, and hearing an echo of the evening it has just let go of would be a screen reopening
   * a session that had ended.
   */
  private announceToSpectators(): void {
    for (const [sessionId, watching] of this.codeWatchers) {
      const held = this.find(sessionId);
      for (const watcher of watching) {
        watcher(held);
      }
    }
  }

  /**
   * The session at this code, in whosever pile it is being kept, or `null` if it is kept nowhere.
   *
   * Both places an evening can be, because a code names one evening for the whole of its life
   * (ADR-0024 §1): ending moves the record from the active slot into the history without changing
   * what it is called, and a spectator watching at that moment is watching the same evening.
   */
  private find(sessionId: string): SessionRecord | null {
    for (const owned of this.owners.values()) {
      const held = [
        ...(owned.active === null ? [] : [JSON.parse(owned.active) as SessionRecord]),
        ...(JSON.parse(owned.history) as readonly SessionRecord[]),
      ];
      const found = held.find((record) => record.session.id === sessionId);
      if (found !== undefined) {
        return found;
      }
    }

    return null;
  }
}
