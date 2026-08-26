/*
 * Reaching the whole evening from the Round tab: paging, the bench, and one more round.
 *
 * The Round tab shows one round at a time (ADR-0016 §2), so everything the organizer is asked
 * between rounds — "who am I with in round 6?", "who is sitting out?", "have we got time for
 * another?" — has to be reachable by paging rather than by scrolling a whole schedule. These
 * tests page the way a thumb pages and read the way an eye reads: labels and rendered text,
 * never a component or a signal.
 *
 * Two of them are about the screen refusing to move. A score landing must not advance the round
 * (ADR-0016 §3), and paging away and back must not disturb what has been entered. Both are the
 * kind of thing that holds until somebody makes the shown round a computed of the current round,
 * which is exactly why they are written down.
 */
import { removePlayer } from 'padel-engine';
import type { Match, Round, Session } from 'padel-engine';
import { AppHarness } from './testing/app-harness';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];
const SIX = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn'];

describe('paging the rounds', () => {
  describe('prev and next', () => {
    it('reaches every generated round, and says which one of how many', async () => {
      const app = await createSession(FOUR);

      expect(app.shows('Round 1 of 3')).toBe(true);
      expect(app.canTap('Previous round')).toBe(false);

      await app.tap('Next round');
      expect(app.shows('Round 2 of 3')).toBe(true);

      await app.tap('Next round');
      expect(app.shows('Round 3 of 3')).toBe(true);

      await app.tap('Previous round');
      expect(app.shows('Round 2 of 3')).toBe(true);
    });

    it('shows a later round as that round was scheduled, not as the current one is', async () => {
      const app = await createSession(SIX);
      const roundOne = courtText(app);

      await app.tap('Next round');
      await app.tap('Next round');

      expect(app.shows('Round 3 of 8')).toBe(true);
      expect(courtText(app)).not.toBe(roundOne);
    });
  });

  describe('the way back to the current round', () => {
    it('is offered from a round that is not the current one, and returns in one tap', async () => {
      const app = await createSession(FOUR);

      expect(app.isOnScreen('Back to current round')).toBe(false);

      await app.tap('Next round');
      await app.tap('Next round');
      expect(app.shows('Round 3 of 3')).toBe(true);

      await app.tap('Back to current round');

      expect(app.shows('Round 1 of 3')).toBe(true);
      expect(app.isOnScreen('Back to current round')).toBe(false);
    });

    it('returns to where the evening is now, not to where the tab opened', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);
      await app.tap('Next round');
      await app.tap('Next round');

      await app.tap('Back to current round');

      expect(app.shows('Round 2 of 3')).toBe(true);
    });

    it('leaves what has been scored exactly as it was', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);
      const scored = app.text();

      await app.tap('Next round');
      await app.tap('Next round');
      await app.tap('Back to current round');
      await app.tap('Previous round');

      expect(app.text()).toBe(scored);
      expect(app.shows('17 – 7')).toBe(true);
      app.expectStoredSessionValid();
    });
  });

  describe('the bench strip', () => {
    it('names everyone the round leaves off a court', async () => {
      const app = await createSession(SIX);

      expect(app.shows(`Sitting out: ${benchedIn(app, 1).join(', ')}`)).toBe(true);
      expect(benchedIn(app, 1).length).toBe(2);
    });

    it('is absent entirely where the roster fits the courts exactly', async () => {
      const app = await createSession(FOUR);

      expect(app.shows('Sitting out')).toBe(false);
    });

    it('reflects who was available in that round, not who is available now', async () => {
      // Somebody who went home after round 1 is not sitting out round 2; they are at home, and
      // naming them on the strip would send one of the other five looking for them (decision #5).
      const played = await createSession(SIX);
      await score(played, 17);
      await sendHome(played, 'Finn');

      const app = await played.reload();
      await app.tap('Resume');

      expect(app.shows('Round 2 of 8')).toBe(true);
      expect(app.shows('Finn')).toBe(false);
      expect(app.shows(`Sitting out: ${benchedIn(app, 2).join(', ')}`)).toBe(true);

      await app.tap('Previous round');

      expect(app.shows('Round 1 of 8')).toBe(true);
      expect(app.shows(`Sitting out: ${benchedIn(app, 1).join(', ')}`)).toBe(true);
    });
  });

  describe('a round that has been played out', () => {
    it('does not move the screen when the last court is scored', async () => {
      const app = await createSession(FOUR);

      await score(app, 17);

      expect(app.shows('Round 1 of 3')).toBe(true);
      expect(app.shows('17 – 7')).toBe(true);
    });

    it('offers the next round, and advances in one tap', async () => {
      const app = await createSession(FOUR);
      expect(app.isOnScreen('Round 2 →')).toBe(false);

      await score(app, 17);
      expect(app.isOnScreen('Round 2 →')).toBe(true);

      await app.tap('Round 2 →');

      expect(app.shows('Round 2 of 3')).toBe(true);
      expect(app.isOnScreen('Round 2 →')).toBe(false);
    });

    it('offers nothing to advance to when it is the last round generated', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);
      await app.tap('Round 2 →');
      await score(app, 17);
      await app.tap('Round 3 →');
      await score(app, 17);

      expect(app.shows('Round 3 of 3')).toBe(true);
      expect(app.isOnScreen('Round 4 →')).toBe(false);
    });
  });

  describe('adding a round', () => {
    it('offers the card past the last round and nowhere else', async () => {
      const app = await createSession(FOUR);

      expect(app.isOnScreen('Add round')).toBe(false);
      await app.tap('Next round');
      expect(app.isOnScreen('Add round')).toBe(false);
      await app.tap('Next round');
      expect(app.isOnScreen('Add round')).toBe(false);

      await app.tap('Next round');

      expect(app.canTap('Add round')).toBe(true);
      expect(app.canTap('Next round')).toBe(false);
    });

    it('appends exactly one round and leaves the rounds behind it untouched', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);
      const before = roundsOf(app);

      await pageToTheEnd(app);
      await app.tap('Add round');

      const after = roundsOf(app);
      expect(after.length).toBe(before.length + 1);
      expect(JSON.stringify(after.slice(0, before.length))).toBe(JSON.stringify(before));
      app.expectStoredSessionValid();
    });

    it('lands on the round it just added, with the courts filled in', async () => {
      const app = await createSession(FOUR);
      await pageToTheEnd(app);

      await app.tap('Add round');

      expect(app.shows('Round 4 of 4')).toBe(true);
      expect(app.isOnScreen('Enter score for Court 1')).toBe(true);
      expect(app.isOnScreen('Add round')).toBe(false);
    });

    it('survives the phone being closed and opened', async () => {
      const created = await createSession(FOUR);
      await pageToTheEnd(created);
      await created.tap('Add round');

      const app = await created.reload();
      await app.tap('Resume');

      expect(app.shows('Round 1 of 4')).toBe(true);
      app.expectStoredSessionValid();
    });
  });
});

/** Page next until the control runs out — the Add round card is what is past the last round. */
async function pageToTheEnd(app: AppHarness): Promise<void> {
  while (app.canTap('Next round')) {
    await app.tap('Next round');
  }
}

/** Every round of the stored session, in the order the document holds them. */
function roundsOf(app: AppHarness): readonly Round[] {
  return storedSession(app).rounds;
}

/** Who this round leaves off a court, in roster order — what the strip should be saying. */
function benchedIn(app: AppHarness, roundNumber: number): readonly string[] {
  const session = storedSession(app);
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);
  const playing = new Set(
    (round?.matches ?? []).flatMap((match) => [...match.sideA, ...match.sideB]),
  );

  return session.roster
    .filter(
      (entry) =>
        !playing.has(entry.id) &&
        (entry.joinedAtRound ?? 1) <= roundNumber &&
        roundNumber <= (entry.leftAfterRound ?? Infinity),
    )
    .map((entry) => entry.name);
}

/**
 * Send a player home in the stored session.
 *
 * The Players tab belongs to a later slice, so no screen does this yet — but the round screen has
 * to read a roster that has moved under it from the day it ships, and storage is where a session
 * that has moved comes back from.
 */
async function sendHome(app: AppHarness, name: string): Promise<void> {
  const record = app.repository.activeRecord();
  if (record === null) {
    throw new Error('The repository holds no session.');
  }

  const leaving = record.session.roster.find((entry) => entry.name === name);
  if (leaving === undefined) {
    throw new Error(`Nobody called ${name} is on the roster.`);
  }

  await app.repository.saveActive({
    ...record,
    session: removePlayer(record.session, leaving.id),
  });
}

/** What is on screen with the header taken out, so two rounds can be compared as slates. */
function courtText(app: AppHarness): string {
  return app.text().replace(/Round \d+ of \d+/, '');
}

/** Score one court of the round on screen, entering `points` for the side the engine put first. */
async function score(app: AppHarness, points: number, courtNumber = 1): Promise<void> {
  const sides = sidesOn(app, courtNumber);

  await app.tap(`Enter score for Court ${courtNumber}`);
  await app.setNumber(sides.a, points);
  await app.tap('Save');
}

/** Who is on each side of a court of the round on screen, as the sheet's labels spell them. */
function sidesOn(app: AppHarness, courtNumber: number): { readonly a: string } {
  const session = storedSession(app);
  const roundNumber = Number(/Round (\d+) of/.exec(app.text())?.[1] ?? 1);
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);
  const match: Match | undefined = round?.matches.find(
    (candidate) => candidate.courtNumber === courtNumber,
  );
  if (match === undefined) {
    throw new Error(`Round ${roundNumber} has no court ${courtNumber}.`);
  }

  const nameOf = (id: string): string =>
    session.roster.find((entry) => entry.id === id)?.name ?? id;

  return { a: match.sideA.map(nameOf).join(' & ') };
}

function storedSession(app: AppHarness): Session {
  const record = app.repository.activeRecord();
  if (record === null) {
    throw new Error('No session has been created.');
  }

  return record.session;
}

async function createSession(names: readonly string[]): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap('Americano');

  for (const name of names) {
    await app.type('Name', name);
    await app.tap('Add');
  }

  await app.tap('Next');
  await app.tap('Create session');

  return app;
}
