/*
 * The roster moving while the evening is running (decision #5, ADR-0015).
 *
 * Someone's friend turns up in round 3; someone else has to leave at nine. Every test here is
 * about the two-step that makes that safe: a preview of the whole regenerated remainder, and a
 * change that has not happened until it is confirmed. The dismissal is tested as hard as the
 * confirmation, because "the candidate is never written unless confirmed" is the promise the
 * preview is worth anything for.
 *
 * They drive the app the way the harness insists on — labels and rendered text — with the one
 * exception the drivers already make: the repository is read to find out what the engine actually
 * stored, because "round 1 is byte-identical afterwards" is not a sentence any screen says.
 */
import type { Session } from 'padel-engine';
import type { AppHarness } from './testing/app-harness';
import { createSession, endSession, score, storedSession } from './testing/session-driver';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];
const SIX = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn'];

describe('changing the roster mid-session', () => {
  describe('the Players tab', () => {
    it('lists the roster', async () => {
      const app = await createSession(SIX);

      await app.tap('Players');

      for (const name of SIX) {
        expect(app.shows(name)).toBe(true);
      }
    });

    it('badges whoever is sitting out the current round, and nobody else', async () => {
      const app = await createSession(SIX);
      const benched = offTheCourtsIn(app, 1);

      await app.tap('Players');

      for (const name of SIX) {
        expect(app.shows(`${name} Sitting out`)).toBe(benched.includes(name));
      }
    });

    it('badges the round the evening is on, not the round it opened on', async () => {
      const app = await createSession(SIX);
      await score(app, 17);

      await app.tap('Players');

      expect(badgedNames(app)).toEqual(offTheCourtsIn(app, 2));
    });

    it('agrees with the bench strip after a roster change', async () => {
      const app = await createSession(SIX);
      await score(app, 17);
      await addPlayer(app, 'Gita');

      await app.tap('Round');
      await app.tap('Round 2 →');
      const strip = benchStripNames(app);

      await app.tap('Players');

      expect(strip.length).toBeGreaterThan(0);
      expect(badgedNames(app)).toEqual(strip);
    });
  });

  describe('adding a player', () => {
    it('previews the whole regenerated remainder before anything is stored', async () => {
      const app = await createSession(SIX);
      await score(app, 17);
      const before = JSON.stringify(storedSession(app));

      await app.tap('Players');
      await app.type('Name', 'Gita');
      await app.tap('Add');

      expect(app.shows('Round 2 of 8')).toBe(true);
      expect(app.shows('Round 8 of 8')).toBe(true);
      expect(app.shows('Round 1 of 8')).toBe(false);
      expect(app.shows('Gita')).toBe(true);
      expect(JSON.stringify(storedSession(app))).toBe(before);
    });

    it('offers no way to generate a different one', async () => {
      const app = await createSession(SIX);

      await app.tap('Players');
      await app.type('Name', 'Gita');
      await app.tap('Add');

      expect(app.shows('Reroll')).toBe(false);
      expect(app.shows('Regenerate')).toBe(false);
      expect(app.shows('Try again')).toBe(false);
    });

    it('changes nothing at all when the organizer backs out', async () => {
      const app = await createSession(SIX);
      await score(app, 17);
      const before = JSON.stringify(storedSession(app));

      await app.tap('Players');
      await app.type('Name', 'Gita');
      await app.tap('Add');
      await app.tap("Don't change the roster");

      expect(JSON.stringify(storedSession(app))).toBe(before);
      expect(app.shows('Gita')).toBe(false);
      app.expectStoredSessionValid();
    });

    it('takes the player on when it is confirmed, and moves no round already played', async () => {
      const app = await createSession(SIX);
      await score(app, 17);
      const playedBefore = JSON.stringify(storedSession(app).rounds.slice(0, 1));

      await addPlayer(app, 'Gita');

      const session = storedSession(app);
      expect(session.roster.map((entry) => entry.name)).toContain('Gita');
      expect(JSON.stringify(session.rounds.slice(0, 1))).toBe(playedBefore);
      expect(app.shows('Gita')).toBe(true);
      app.expectStoredSessionValid();
    });

    it('schedules them from the first unplayed round and into none behind it', async () => {
      const app = await createSession(SIX);
      await score(app, 17);

      await addPlayer(app, 'Gita');

      const session = storedSession(app);
      const gita = idOf(app, 'Gita');
      expect(playersIn(session, 1)).not.toContain(gita);
      expect(
        session.rounds.slice(1).some((round) => playersIn(session, round.number).includes(gita)),
      ).toBe(true);
    });

    it('asks nothing of a blank name', async () => {
      const app = await createSession(SIX);

      await app.tap('Players');
      await app.tap('Add');

      expect(app.isOnScreen("Don't change the roster")).toBe(false);
      expect(storedSession(app).roster.length).toBe(SIX.length);
    });
  });

  describe('going home', () => {
    it('is on the row overflow rather than on the row', async () => {
      const app = await createSession(SIX);

      await app.tap('Players');
      expect(app.isOnScreen('Went home')).toBe(false);

      await app.tap('Options for Finn');

      expect(app.canTap('Went home')).toBe(true);
    });

    it('previews the remainder, and leaves everything alone when it is dismissed', async () => {
      const app = await createSession(SIX);
      await score(app, 17);
      const before = JSON.stringify(storedSession(app));

      await sendHome(app, 'Finn', { confirm: false });

      expect(JSON.stringify(storedSession(app))).toBe(before);
      app.expectStoredSessionValid();
    });

    it('keeps the matches they played and puts them in no later round', async () => {
      const app = await createSession(SIX);
      const roundOne = await score(app, 17);
      const leaver = roundOne.a.split(' & ')[0];
      const playedBefore = JSON.stringify(storedSession(app).rounds.slice(0, 1));

      await sendHome(app, leaver);

      const session = storedSession(app);
      const id = idOf(app, leaver);
      expect(JSON.stringify(session.rounds.slice(0, 1))).toBe(playedBefore);
      expect(playersIn(session, 1)).toContain(id);
      for (const round of session.rounds.slice(1)) {
        expect(playersIn(session, round.number)).not.toContain(id);
      }
      app.expectStoredSessionValid();
    });

    it('keeps their line in the standings', async () => {
      const app = await createSession(SIX);
      const roundOne = await score(app, 17);
      const leaver = roundOne.a.split(' & ')[0];

      await sendHome(app, leaver);
      await app.tap('Standings');

      expect(app.shows(leaver)).toBe(true);
    });

    it('says so on their row, and does not offer to send them home twice', async () => {
      const app = await createSession(SIX);
      await score(app, 17);

      await sendHome(app, 'Finn');

      expect(app.shows('Finn Went home')).toBe(true);
      expect(app.isOnScreen('Options for Finn')).toBe(false);
    });

    it('is not offered at all where the evening would be left with too few players', async () => {
      const app = await createSession(FOUR);

      await app.tap('Players');

      expect(app.isOnScreen('Options for Ana')).toBe(false);
      expect(app.shows('A session needs at least 4 players')).toBe(true);
    });
  });

  describe('a session that has ended', () => {
    it('lists the roster and offers no change to it', async () => {
      const app = await createSession(SIX);
      await score(app, 17);
      await endSession(app);

      await app.tap('Players');

      expect(app.shows('Ana')).toBe(true);
      expect(app.isOnScreen('Add')).toBe(false);
      expect(app.isOnScreen('Options for Ana')).toBe(false);
    });
  });
});

/** Add a player through the Players tab, and confirm the preview it opens. */
async function addPlayer(app: AppHarness, name: string): Promise<void> {
  await app.tap('Players');
  await app.type('Name', name);
  await app.tap('Add');
  await app.tap(`Add ${name}`);
}

/** Send a player home through the row overflow, confirming the preview unless told not to. */
async function sendHome(
  app: AppHarness,
  name: string,
  { confirm = true }: { confirm?: boolean } = {},
): Promise<void> {
  await app.tap('Players');
  await app.tap(`Options for ${name}`);
  await app.tap('Went home');
  await app.tap(confirm ? `${name} went home` : "Don't change the roster");
}

/**
 * Who the stored session puts on no court in this round, in roster order.
 *
 * Deliberately not the availability rule the screen uses, for the reason the paging spec gives:
 * a helper that reimplemented it would agree with a broken screen exactly where the screen was
 * broken. Every session it is asked about here is one nobody has left yet.
 */
function offTheCourtsIn(app: AppHarness, roundNumber: number): readonly string[] {
  const session = storedSession(app);
  const playing = playersIn(session, roundNumber);

  return session.roster.filter((entry) => !playing.includes(entry.id)).map((entry) => entry.name);
}

function playersIn(session: Session, roundNumber: number): readonly string[] {
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);

  return (round?.matches ?? []).flatMap((match) => [...match.sideA, ...match.sideB]);
}

/** The names the bench strip on the Round tab is naming right now, in the order it names them. */
function benchStripNames(app: AppHarness): readonly string[] {
  const strip = /Sitting out: (.*?) Round /.exec(app.text());

  return strip === null ? [] : strip[1].split(', ');
}

/** The names the Players tab has badged as sitting out, in the order the list holds them. */
function badgedNames(app: AppHarness): readonly string[] {
  return storedSession(app)
    .roster.map((entry) => entry.name)
    .filter((name) => app.shows(`${name} Sitting out`));
}

function idOf(app: AppHarness, name: string): string {
  const entry = storedSession(app).roster.find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(`Nobody called ${name} is on the roster.`);
  }

  return entry.id;
}
