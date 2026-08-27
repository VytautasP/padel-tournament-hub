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
 * schedule a test cannot spell out in advance, and it is why the drivers in `session-driver`
 * exist: creating an evening and scoring a court is setup for every spec here, and none of them
 * is about the wizard.
 */
import { createSession, openSheet, score, scoreOf } from './testing/session-driver';

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

    it('opens the Players tab from the same bar', async () => {
      const app = await createSession(FOUR);

      await app.tap('Players');

      expect(app.shows('Round 1 of 3')).toBe(false);
      for (const name of FOUR) {
        expect(app.shows(name)).toBe(true);
      }
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
      // Nothing is derived from a number the match cannot hold: `24 - 27` is not a scoreline, and
      // the last one that was is not this one. The refused number is the one still on screen.
      expect(app.textIn(sides.b)).toBe('');
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

      await app.tap('Enter score for Court 1');
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
      await app.tap('Enter score for Court 1');
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
