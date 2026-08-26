/*
 * Scoring a court, and reading the table it feeds.
 *
 * The same rule as every other spec here: rendered text and tapped labels only, never a component
 * or a signal. The score sheet is a CDK overlay, so it lives outside the app's own element — the
 * harness looks in both places, because an organizer looking at their phone does not know or care
 * which element a bottom sheet was attached to.
 *
 * Side names double as the sheet's field labels, so the tests read the roster off the stored
 * session to find out who the engine put together. That is the one thing about a generated
 * schedule a test cannot spell out in advance.
 */
import { AppHarness } from './testing/app-harness';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];
const EIGHT = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn', 'Gita', 'Hugo'];

describe('scoring a court', () => {
  describe('the session shell', () => {
    it('opens on the Round tab, with the standings one tap away', async () => {
      const app = await createSession(FOUR);

      expect(app.shows('Round 1 of 3')).toBe(true);
      expect(app.shows('Standings')).toBe(true);

      await app.tap('Standings');

      expect(app.shows('Round 1 of 3')).toBe(false);
      for (const name of FOUR) {
        expect(app.shows(name)).toBe(true);
      }
    });

    it('shows the Players tab without letting it be opened yet', async () => {
      const app = await createSession(FOUR);

      expect(app.isOnScreen('Players')).toBe(true);
      expect(app.canTap('Players')).toBe(false);
    });

    it('leaves the round exactly as it was when the tabs are switched away and back', async () => {
      const app = await createSession(FOUR);
      const round = app.text();

      await app.tap('Standings');
      await app.tap('Round');

      expect(app.text()).toBe(round);
    });
  });

  describe('the score sheet', () => {
    it('opens for the court that was tapped, and says what the match is played to', async () => {
      const app = await createSession(FOUR);
      const sides = await openSheet(app);

      expect(app.shows('Court 1')).toBe(true);
      expect(app.shows('of 24')).toBe(true);
      expect(app.textIn(sides.a)).toBe('');
      expect(app.textIn(sides.b)).toBe('');
    });

    it('derives the other side from the target, whichever side is typed into', async () => {
      const app = await createSession(FOUR);
      const sides = await openSheet(app);

      await app.setNumber(sides.a, 17);
      expect(app.numberIn(sides.b)).toBe(7);

      await app.setNumber(sides.b, 10);
      expect(app.numberIn(sides.a)).toBe(14);
    });

    it('takes digits and nothing else', async () => {
      const app = await createSession(FOUR);
      const sides = await openSheet(app);

      await app.typeInto(sides.a, '1a7-');

      expect(app.textIn(sides.a)).toBe('17');
    });

    it('refuses a number above the target, and leaves it standing rather than clamping it', async () => {
      const app = await createSession(FOUR);
      const sides = await openSheet(app);

      await app.setNumber(sides.a, 27);

      expect(app.shows('A score cannot be more than 24.')).toBe(true);
      expect(app.canTap('Save')).toBe(false);
      expect(app.numberIn(sides.a)).toBe(27);
    });

    it('reads the bound off the session, so an evening played to 32 accepts 30', async () => {
      const app = await createSession(FOUR, 1, 32);
      const sides = await openSheet(app);

      await app.setNumber(sides.a, 30);

      expect(app.shows('A score cannot be more than 32.')).toBe(false);
      expect(app.numberIn(sides.b)).toBe(2);
      expect(app.canTap('Save')).toBe(true);
    });

    it('records one number and shows the result on the court', async () => {
      const app = await createSession(FOUR);
      const sides = await openSheet(app);

      await app.setNumber(sides.a, 17);
      await app.tap('Save');

      expect(app.shows('17 – 7')).toBe(true);
      expect(app.shows('No score yet')).toBe(false);
      expect(scoreOf(app)).toEqual({ sideA: 17, sideB: 7 });
      app.expectStoredSessionValid();
    });

    it('stays on the round it was scoring when the last court of that round finishes', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);

      expect(app.shows('Round 1 of 3')).toBe(true);
    });

    it('reopens a scored court at its current value, and replaces the score', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);

      await app.tap('Enter score for court 1');
      expect(app.numberIn(sides.a)).toBe(17);
      expect(app.numberIn(sides.b)).toBe(7);

      await app.setNumber(sides.a, 20);
      await app.tap('Save');

      expect(app.shows('20 – 4')).toBe(true);
      expect(app.shows('17 – 7')).toBe(false);
      expect(scoreOf(app)).toEqual({ sideA: 20, sideB: 4 });
      app.expectStoredSessionValid();
    });

    it('leaves the court unscored when the sheet is cancelled', async () => {
      const app = await createSession(FOUR);
      const sides = await openSheet(app);

      await app.setNumber(sides.a, 17);
      await app.tap('Cancel');

      expect(app.shows('No score yet')).toBe(true);
      expect(scoreOf(app)).toBeUndefined();
    });
  });

  describe('the standings', () => {
    it('shows the roster at a dash before anybody has played', async () => {
      const app = await createSession(FOUR);
      await app.tap('Standings');

      for (const name of FOUR) {
        expect(app.isOnScreen(`1 ${name} –`)).toBe(true);
      }
      expect(app.shows('0.0')).toBe(false);
    });

    it('ranks by points per match, and expands a row for the detail behind it', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);
      await app.tap('Standings');

      const [winner] = sides.a.split(' & ');
      const [loser] = sides.b.split(' & ');
      expect(app.isOnScreen(`1 ${winner} 17.0`)).toBe(true);
      expect(app.isOnScreen(`3 ${loser} 7.0`)).toBe(true);

      await app.tap(`1 ${winner} 17.0`);

      expect(app.shows('Matches played 1')).toBe(true);
      expect(app.shows('Total points 17')).toBe(true);
    });

    it('repeats a joint position and skips the place it uses up', async () => {
      const app = await createSession(EIGHT, 2);
      const drawn = await score(app, 12, 1);
      const decided = await score(app, 24, 2);
      await app.tap('Standings');

      for (const name of decided.a.split(' & ')) {
        expect(app.isOnScreen(`1 ${name} 24.0`)).toBe(true);
      }
      // Two players share first, so second is used up and the next four are joint third.
      for (const name of [...drawn.a.split(' & '), ...drawn.b.split(' & ')]) {
        expect(app.isOnScreen(`3 ${name} 12.0`)).toBe(true);
      }
      for (const name of decided.b.split(' & ')) {
        expect(app.isOnScreen(`7 ${name} 0.0`)).toBe(true);
      }
    });

    it('recomputes the table the moment a score is corrected', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);
      const [winner] = sides.a.split(' & ');

      await app.tap('Standings');
      expect(app.isOnScreen(`1 ${winner} 17.0`)).toBe(true);

      await app.tap('Round');
      await app.tap('Enter score for court 1');
      await app.setNumber(sides.a, 20);
      await app.tap('Save');
      await app.tap('Standings');

      expect(app.isOnScreen(`1 ${winner} 20.0`)).toBe(true);
      expect(app.isOnScreen(`1 ${winner} 17.0`)).toBe(false);
      app.expectStoredSessionValid();
    });
  });

  describe('closing the app and opening it again', () => {
    it('brings the score back with the round it was entered on', async () => {
      const created = await createSession(EIGHT, 2);
      await score(created, 17);

      const app = await created.reload();
      await app.tap('Resume');

      expect(app.shows('Round 1 of 7')).toBe(true);
      expect(app.shows('17 – 7')).toBe(true);
      app.expectStoredSessionValid();
    });

    it('opens on the round after the one that has been played out', async () => {
      // Nothing stores which round that is: it is the lowest-numbered one still holding an
      // unscored match, worked out again from the scores every time it is asked for.
      const created = await createSession(FOUR);
      await score(created, 17);

      const app = await created.reload();
      await app.tap('Resume');

      expect(app.shows('Round 2 of 3')).toBe(true);
    });
  });
});

interface Sides {
  readonly a: string;
  readonly b: string;
}

/** Who the engine put on each side of a court, as the screen spells them. */
function sidesOn(app: AppHarness, courtNumber: number): Sides {
  const session = app.repository.activeRecord()?.session;
  if (session === undefined || session === null) {
    throw new Error('No session has been created.');
  }

  const match = session.rounds[0].matches.find(
    (candidate) => candidate.courtNumber === courtNumber,
  );
  if (match === undefined) {
    throw new Error(`Round 1 has no court ${courtNumber}.`);
  }

  const nameOf = (id: string): string =>
    session.roster.find((entry) => entry.id === id)?.name ?? id;

  return {
    a: match.sideA.map(nameOf).join(' & '),
    b: match.sideB.map(nameOf).join(' & '),
  };
}

function scoreOf(app: AppHarness, courtNumber = 1): unknown {
  const session = app.repository.activeRecord()?.session;

  return session?.rounds[0].matches.find((match) => match.courtNumber === courtNumber)?.score;
}

async function openSheet(app: AppHarness, courtNumber = 1): Promise<Sides> {
  await app.tap(`Enter score for court ${courtNumber}`);

  return sidesOn(app, courtNumber);
}

async function score(app: AppHarness, points: number, courtNumber = 1): Promise<Sides> {
  const sides = await openSheet(app, courtNumber);
  await app.setNumber(sides.a, points);
  await app.tap('Save');

  return sides;
}

async function createSession(
  names: readonly string[],
  courtCount = 1,
  targetScore = 24,
): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap('Americano');

  for (const name of names) {
    await app.type('Name', name);
    await app.tap('Add');
  }

  await app.tap('Next');
  if (courtCount !== 1) {
    await app.setNumber('Courts', courtCount);
  }
  if (targetScore !== 24) {
    await app.setNumber('Target score', targetScore);
  }
  await app.tap('Create session');

  return app;
}
