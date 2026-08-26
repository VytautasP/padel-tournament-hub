import { createSession, generateRemaining } from 'padel-engine';
import { LocalStorageSessionRepository } from './local-storage-session-repository';
import type { SessionRecord } from './session-record';

const STORAGE_KEY = 'padel-tournament-hub:active-session';

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
});

function record(): SessionRecord {
  const session = generateRemaining(
    createSession({
      id: 'session-1',
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

  return { session, createdAt: '2026-08-26T18:00:00.000Z' };
}
