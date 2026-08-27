import { createSession, generateRemaining } from 'padel-engine';
import {
  HISTORY_KEY,
  LocalStorageSessionRepository,
  STORAGE_KEY,
} from './local-storage-session-repository';
import type { SessionRecord } from './session-record';

describe('the localStorage session repository', () => {
  beforeEach(() => localStorage.clear());

  it('reads back the record it stored', async () => {
    const repository = new LocalStorageSessionRepository();
    await repository.saveActive(record());

    expect(await repository.loadActive()).toEqual(record());
  });

  it('has no active session before anything is stored, and none after it is cleared', async () => {
    const repository = new LocalStorageSessionRepository();
    expect(await repository.loadActive()).toBeNull();

    await repository.saveActive(record());
    await repository.clearActive();

    expect(await repository.loadActive()).toBeNull();
  });

  it('treats an unreadable document as no session rather than as a crash', async () => {
    // An organizer who opens the app to a thrown error has no way out; one who opens it to the
    // landing page can start the evening again. The bad document has lost that evening either way.
    const repository = new LocalStorageSessionRepository();

    localStorage.setItem(STORAGE_KEY, 'not json at all');
    expect(await repository.loadActive()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, record: record() }));
    expect(await repository.loadActive()).toBeNull();
  });

  it('keeps ended sessions under a key of their own, most recently ended first', async () => {
    const repository = new LocalStorageSessionRepository();
    expect(await repository.loadHistory()).toEqual([]);

    await repository.addToHistory(record('session-1'));
    await repository.addToHistory(record('session-2'));

    expect(await repository.loadHistory()).toEqual([record('session-2'), record('session-1')]);
    // The history and the evening in progress are written at completely different rates, so they
    // are separate documents rather than one that has to be rewritten on every score.
    expect(await repository.loadActive()).toBeNull();
  });

  it('deletes one ended session and leaves the rest', async () => {
    const repository = new LocalStorageSessionRepository();
    await repository.addToHistory(record('session-1'));
    await repository.addToHistory(record('session-2'));

    await repository.deleteFromHistory('session-1');

    expect(await repository.loadHistory()).toEqual([record('session-2')]);
  });

  it('treats unreadable history as empty history rather than as a crash', async () => {
    const repository = new LocalStorageSessionRepository();

    localStorage.setItem(HISTORY_KEY, 'not json at all');
    expect(await repository.loadHistory()).toEqual([]);

    localStorage.setItem(HISTORY_KEY, JSON.stringify({ version: 99, records: [record()] }));
    expect(await repository.loadHistory()).toEqual([]);
  });
});

function record(id = 'session-1'): SessionRecord {
  const session = generateRemaining(
    createSession({
      id,
      mode: 'americano',
      players: [
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Ben' },
        { id: 'p3', name: 'Cara' },
        { id: 'p4', name: 'Dov' },
      ],
      courtCount: 1,
      targetScore: 24,
      roundCount: 3,
    }),
  );

  return { session, createdAt: '2026-08-26T18:00:00.000Z', courtNames: ['Court 7'] };
}
