/*
 * Ending an evening, and the front door that ending it makes necessary.
 *
 * The two halves are one slice on purpose. A session that can end is a session that leaves the
 * active slot, and the moment it does the landing page has to answer three questions it never had
 * to before: is there an evening in progress, how do I get out of one that fell apart, and where
 * did last Tuesday go (ADR-0013).
 *
 * The same rule as every other spec here: rendered text and tapped labels only, never a component
 * or a signal. Two things are read off the repository — the stored status, and the referee — and
 * both are for the same reason `expectStoredSessionValid` exists: a screen that looked right while
 * writing a session the engine would refuse is a bug in the screen.
 *
 * The date in a history row is the one string in these tests that cannot be written down in
 * advance. It is formatted here rather than imported from the dictionary, so that a test asserts
 * the row the organizer reads rather than agreeing with whatever the app happened to produce.
 */
import { AppHarness } from './testing/app-harness';
import { createSession, endSession, score, storedSession } from './testing/session-driver';
import type { Sides } from './testing/session-driver';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];
const EIGHT = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn', 'Gita', 'Hugo'];

const today = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
}).format(new Date());

const ROW = `${today} · Americano · 4 players`;

describe('ending the session', () => {
  describe('the ending itself', () => {
    it('is in the Standings footer, behind a confirmation naming what freezes', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);
      await app.tap('Standings');

      expect(app.isOnScreen('End session')).toBe(true);

      await app.tap('End session');
      expect(app.shows('no more scores, no more rounds, no roster changes')).toBe(true);

      await app.tap('Cancel');

      expect(storedSession(app).status).toBe('in-progress');
      expect(app.isOnScreen('End session')).toBe(true);
    });

    it('freezes the evening and puts the podium above the table it made final', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);

      await endSession(app);

      expect(app.shows('Podium')).toBe(true);
      // The same tab, not a screen of its own: the top three are the standings.
      expect(app.shows('Standings')).toBe(true);
      expect(app.isOnScreen('End session')).toBe(false);
      expect(app.repository.historyRecords()[0].session.status).toBe('finished');
      app.expectEndedSessionValid();
    });

    it('leaves the rounds readable and nothing about them tappable', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);
      await endSession(app);

      await app.tap('Round');

      expect(app.shows('Round 1 of 3')).toBe(true);
      expect(app.shows('17 – 7')).toBe(true);
      expect(app.isOnScreen('Enter score for Court 1')).toBe(false);

      await app.tap('Next round');
      await app.tap('Next round');

      expect(app.shows('Round 3 of 3')).toBe(true);
      // The Add round card is one page past the last round, and a finished session has no such
      // page: there is no round to add to a document the engine takes no operations on.
      expect(app.canTap('Next round')).toBe(false);
      expect(app.isOnScreen('Add round')).toBe(false);
    });

    it('repeats a joint first on the podium rather than picking a winner', async () => {
      const app = await createSession(EIGHT, 2);
      const drawn = await score(app, 12, 1);
      const decided = await score(app, 24, 2);

      await endSession(app);

      expect(app.shows('Podium')).toBe(true);
      for (const name of decided.a.split(' & ')) {
        // Both of them are first, and both are on the podium: twice on screen, once in each.
        expect(app.shows(`1 ${name} 24.0`)).toBe(true);
        expect(timesShown(app, name)).toBe(2);
      }
      for (const name of drawn.a.split(' & ')) {
        expect(app.shows(`3 ${name} 12.0`)).toBe(true);
      }
      for (const name of decided.b.split(' & ')) {
        expect(timesShown(app, name)).toBe(1);
      }
    });
  });

  describe('the landing page', () => {
    it('offers one button and nothing else before an evening has ever been played', async () => {
      const app = await AppHarness.launch();

      expect(app.isOnScreen('New session')).toBe(true);
      expect(app.isOnScreen('Resume')).toBe(false);
      expect(app.shows('Session history')).toBe(false);
    });

    it('names the evening in progress, resumes it in one tap, and hides New session', async () => {
      const created = await createSession(EIGHT, 2);
      const app = await created.reload();

      expect(app.shows('Americano · 8 players · round 1')).toBe(true);
      // Absent rather than disabled: the app cannot honour a second evening, and a greyed button
      // would invite the tap anyway.
      expect(app.isOnScreen('New session')).toBe(false);

      await app.tap('Resume');

      expect(app.shows('Round 1 of 7')).toBe(true);
    });

    it('offers New session again the moment the evening is ended, with the row in history', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);
      await endSession(app);

      await app.tap('Done');

      expect(app.isOnScreen('New session')).toBe(true);
      expect(app.isOnScreen('Resume')).toBe(false);
      expect(app.shows('Session history')).toBe(true);
      expect(app.shows(ROW)).toBe(true);
      expect(app.shows(winnersOf(sides))).toBe(true);
      expect(app.repository.activeRecord()).toBeNull();
    });
  });

  describe('discarding an evening that fell apart', () => {
    it('lives in the Resume card overflow and nowhere inside the session', async () => {
      const created = await createSession(FOUR);
      const app = await created.reload();

      expect(app.isOnScreen('Discard')).toBe(false);

      await app.tap('Session options');
      expect(app.isOnScreen('Discard')).toBe(true);

      await app.tap('Resume');

      expect(app.isOnScreen('Discard')).toBe(false);
      expect(app.isOnScreen('Session options')).toBe(false);
    });

    it('removes the evening for good and returns the page to New session', async () => {
      const created = await createSession(FOUR);
      await score(created, 17);
      const app = await created.reload();

      await app.tap('Session options');
      await app.tap('Discard');
      expect(app.shows('It is not kept in history.')).toBe(true);

      await app.tap('Discard session');

      expect(app.isOnScreen('New session')).toBe(true);
      expect(app.isOnScreen('Resume')).toBe(false);
      // Discarded is not ended: nothing about it reaches history.
      expect(app.shows('Session history')).toBe(false);
      expect(app.repository.activeRecord()).toBeNull();
      expect(app.repository.historyRecords()).toEqual([]);
    });
  });

  describe('session history', () => {
    it('names a row by its day, its format, its size and who won', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);
      await endSession(app);
      await app.tap('Done');

      expect(app.shows(ROW)).toBe(true);
      // Both players on the winning side are first, so both of them won it.
      expect(app.shows(winnersOf(sides))).toBe(true);
    });

    it('asks for no name at creation, because a row names itself', async () => {
      const app = await AppHarness.launch();
      await app.tap('New session');
      await app.tap('Americano');
      for (const name of FOUR) {
        await app.type('Name', name);
        await app.tap('Add');
      }
      await app.tap('Next');

      expect(app.shows('Review & create')).toBe(true);
      expect(app.hasField('Session name')).toBe(false);
    });

    it('opens a row on the evening it kept, with nothing on it to change', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);
      await endSession(app);
      await app.tap('Done');

      await app.tap(`${ROW} ${winnersOf(sides)}`);

      // A record opens at round one: every round it played, from the start.
      expect(app.shows('Round 1 of 3')).toBe(true);
      expect(app.shows('17 – 7')).toBe(true);
      expect(app.isOnScreen('Enter score for Court 1')).toBe(false);
      expect(app.isOnScreen('Back to current round')).toBe(false);

      await app.tap('Next round');
      expect(app.shows('Round 2 of 3')).toBe(true);

      await app.tap('Standings');
      expect(app.shows('Podium')).toBe(true);
      expect(app.isOnScreen('End session')).toBe(false);

      await app.tap('Done');
      expect(app.isOnScreen('New session')).toBe(true);
    });

    it('deletes a row behind a confirmation, and the deletion outlives the app', async () => {
      const ended = await createSession(FOUR);
      await score(ended, 17);
      await endSession(ended);
      await ended.tap('Done');

      await ended.tap(`Delete ${ROW}`);
      expect(ended.shows('Nothing here can be recovered.')).toBe(true);

      await ended.tap('Cancel');
      expect(ended.shows(ROW)).toBe(true);

      await ended.tap(`Delete ${ROW}`);
      await ended.tap('Delete session');

      expect(ended.shows('Session history')).toBe(false);
      expect(ended.repository.historyRecords()).toEqual([]);

      const app = await ended.reload();
      expect(app.shows('Session history')).toBe(false);
      expect(app.isOnScreen('New session')).toBe(true);
    });

    it('keeps every ended evening, most recently ended first', async () => {
      const first = await createSession(FOUR);
      await score(first, 17);
      await endSession(first);
      await first.tap('Done');

      await first.tap('New session');
      await first.tap('Americano');
      for (const name of EIGHT) {
        await first.type('Name', name);
        await first.tap('Add');
      }
      await first.tap('Next');
      await first.tap('Create session');
      await endSession(first);
      await first.tap('Done');

      const rows = first.repository.historyRecords();
      expect(rows.length).toBe(2);
      expect(rows[0].session.roster.length).toBe(8);
      expect(rows[1].session.roster.length).toBe(4);
      expect(first.shows(`${today} · Americano · 8 players`)).toBe(true);
      expect(first.shows(ROW)).toBe(true);
    });
  });
});

/**
 * The winner line a history row shows for the side that took the points.
 *
 * Both players on a winning side are joint first, and the row lists them in the order the table
 * does — roster order, which is the order the names were typed — rather than in the order the
 * engine happened to write the side. The two are not the same, and the row follows the table.
 */
function winnersOf(sides: Sides): string {
  return `${FOUR.filter((name) => sides.a.includes(name)).join(' & ')} won`;
}

/** How many times a fragment appears in what is on screen right now. */
function timesShown(app: AppHarness, fragment: string): number {
  return app.text().split(fragment).length - 1;
}
