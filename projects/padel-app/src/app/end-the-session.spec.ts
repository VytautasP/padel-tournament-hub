/*
 * Ending an evening, and the front door that ending it makes necessary.
 *
 * The two halves are one slice on purpose. A session that can end is a session that leaves the
 * active slot, and the moment it does the landing page has to answer three questions it never had
 * to before: is there an evening in progress, how do I get out of one that fell apart, and where
 * did last Tuesday go (ADR-0013).
 *
 * The same rule as every other spec here: rendered text and tapped labels only, never a component
 * or a signal. Three things are read off the repository — the stored status, the referee, and the
 * share code an ended evening is watched by — and the first two are for the same reason
 * `expectStoredSessionValid` exists: a screen that looked right while writing a session the engine
 * would refuse is a bug in the screen. The third is the one fact about an evening that is not on
 * screen anywhere: a spectator's address cannot be typed out in advance.
 *
 * The date in a history row is the one string in these tests that cannot be written down in
 * advance. It is formatted here rather than imported from the dictionary, so that a test asserts
 * the row the organizer reads rather than agreeing with whatever the app happened to produce.
 */
import { AppHarness } from './testing/app-harness';
import { spectatorPath } from './share/share-link';
import {
  createSession,
  endSession,
  score,
  showsScore,
  storedSession,
} from './testing/session-driver';
import type { Sides } from './testing/session-driver';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];
const EIGHT = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn', 'Gita', 'Hugo'];

const today = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
}).format(new Date());

const ROW = `${today} · Americano · 4 players`;

/** The further question's toggle, which is the one label two of these tests turn on. */
const PAY = 'Pay for the rounds nobody played';

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
      const sides = await score(app, 17);
      await endSession(app);

      await app.tap('Round');

      expect(app.shows('Round 1 of 3')).toBe(true);
      expect(showsScore(app, sides, { a: 17, b: 7 })).toBe(true);
      expect(app.isOnScreen('Enter score for Court 1')).toBe(false);

      await app.tap('Next round');
      await app.tap('Next round');

      expect(app.shows('Round 3 of 3')).toBe(true);
      // The Add round card is one page past the last round, and a finished session has no such
      // page: there is no round to add to a document the engine takes no operations on.
      expect(app.canTap('Next round')).toBe(false);
      expect(app.isOnScreen('Add round')).toBe(false);
    });

    it('takes the Add round card away, even from under an organizer standing on it', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);

      // Page past the last round, so the card the evening ends under is the one that lengthens it.
      await app.tap('Next round');
      await app.tap('Next round');
      await app.tap('Next round');
      expect(app.isOnScreen('Add round')).toBe(true);

      await endSession(app);
      await app.tap('Round');

      expect(app.isOnScreen('Add round')).toBe(false);
      expect(app.shows('The evening ends here')).toBe(false);
      expect(app.shows('Round 3 of 3')).toBe(true);
    });

    it('shows no podium for an evening that ended with nothing scored', async () => {
      const app = await createSession(FOUR);

      await endSession(app);

      // Nobody has been on a scored court, so everybody is joint first on nothing. A podium of the
      // whole roster would be reporting an artefact of the ranking as a result.
      expect(app.shows('Podium')).toBe(false);
      for (const name of FOUR) {
        expect(timesShown(app, name)).toBe(1);
      }
      app.expectEndedSessionValid();
    });

    it('repeats a joint first on the podium rather than picking a winner', async () => {
      const app = await createSession(EIGHT, 2);
      const drawn = await score(app, 12, 1);
      const decided = await score(app, 24, 2);

      await endSession(app);

      expect(app.shows('Podium')).toBe(true);
      for (const name of decided.a.split(' & ')) {
        // Both of them are first, and both are on the podium: twice on screen, once in each.
        expect(app.shows(`1 ${name} 24`)).toBe(true);
        expect(timesShown(app, name)).toBe(2);
      }
      for (const name of drawn.a.split(' & ')) {
        expect(app.shows(`3 ${name} 12`)).toBe(true);
      }
      for (const name of decided.b.split(' & ')) {
        expect(timesShown(app, name)).toBe(1);
      }
    });
  });

  /*
   * ADR-0037, from the organizer's side: an evening that ran out of time before it ran out of
   * rounds, and the one further question that makes the difference between a table that says so
   * and a table that says the missing rounds were lost.
   *
   * Every figure below is checkable by hand from the target score, which is what these tests are
   * really asserting. Four players on one court is three generated rounds, nobody benched, and a
   * target of 24 — so an abandoned round pays 12, and two of them pay 24 to everybody.
   */
  describe('the rounds that were never played', () => {
    it('asks nothing more of an evening whose every generated round was scored', async () => {
      const app = await playedOut();
      await app.tap('Standings');

      await app.tap('End session');

      expect(app.shows('no more scores, no more rounds, no roster changes')).toBe(true);
      expect(app.isOnScreen(PAY)).toBe(false);
    });

    it('asks, says the podium can move, and holds the answer at no', async () => {
      const app = await createSession(FOUR);
      await score(app, 17);
      await app.tap('Standings');

      await app.tap('End session');

      expect(app.isOnScreen(PAY)).toBe(true);
      // The standings on screen when they reached for the button are the ones they get, unless
      // they say otherwise — so the control is offering a departure rather than holding a choice.
      expect(app.isPressed(PAY)).toBe(false);
      expect(app.shows('This can change the podium.')).toBe(true);

      await app.tap('Cancel');

      expect(storedSession(app).status).toBe('in-progress');
      expect(app.isOnScreen('End session')).toBe(true);
    });

    it('leaves the table exactly as it stood when the answer is no', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);

      await endSession(app);

      const [winner] = sides.a.split(' & ');
      const [loser] = sides.b.split(' & ');
      expect(app.shows(`1 ${winner} 1–0–0 17`)).toBe(true);
      expect(app.shows(`3 ${loser} 0–0–1 7`)).toBe(true);
      app.expectEndedSessionValid();
    });

    it('pays everybody who was there for them when the answer is yes', async () => {
      const app = await createSession(FOUR);
      const sides = await score(app, 17);

      await endSessionPaying(app);

      // Two rounds nobody played, at half of a target of 24: twenty-four points each, on top of
      // what they scored on the one court that happened.
      const [winner] = sides.a.split(' & ');
      const [loser] = sides.b.split(' & ');
      expect(app.shows(`1 ${winner} 1–0–0 41`)).toBe(true);
      expect(app.shows(`3 ${loser} 0–0–1 31`)).toBe(true);

      // The record is untouched by the payment. A compensated round is not a result, so it is
      // none of the three (ADR-0023 §5) — it lands in the total and nowhere else, which is the
      // whole of what the screen says about it now that the expansion is gone (#97).
      app.expectEndedSessionValid();
    });

    it('says nothing was owed to somebody who was not there to be owed it', async () => {
      const app = await createSession(EIGHT, 2);
      await score(app, 17, 1);
      const secondCourt = await score(app, 24, 2);
      const [leaver] = secondCourt.b.split(' & ');

      // One player leaves after round one, so the six rounds the evening never played were not
      // rounds they were available for (ADR-0037 §3). Everybody still there is paid for all six.
      await app.tap('Players');
      await app.tap(`Options for ${leaver}`);
      await app.tap('Went home');
      await app.tap(`${leaver} went home`);

      await endSessionPaying(app);

      const [winner] = secondCourt.a.split(' & ');
      // Six abandoned rounds at half of twenty-four: seventy-two, on top of the twenty-four scored.
      expect(app.shows(`1 ${winner} 1–0–0 96`)).toBe(true);
      // The player who had gone home is paid for none of them, and their line says so by standing
      // still at what they scored while everybody else's moved.
      expect(app.shows(`8 ${leaver} 0–0–1 0`)).toBe(true);
      app.expectEndedSessionValid();
    });

    it('shows the spectator the table the organizer made final', async () => {
      const organizer = await createSession(FOUR);
      const sides = await score(organizer, 17);
      const code = storedSession(organizer).id;

      await endSessionPaying(organizer);

      const spectator = await AppHarness.launch({
        repository: organizer.repository,
        at: spectatorPath(code),
      });
      await spectator.tap('Standings');

      const [winner] = sides.a.split(' & ');
      expect(spectator.shows(`1 ${winner} 1–0–0 41`)).toBe(true);
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

    it('names no winner for an evening that ended with nothing scored', async () => {
      const app = await createSession(FOUR);
      await endSession(app);

      await app.tap('Done');

      expect(app.shows(ROW)).toBe(true);
      expect(app.shows('won')).toBe(false);
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
      expect(showsScore(app, sides, { a: 17, b: 7 })).toBe(true);
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
 * Four players on one court, every one of their three rounds scored: an evening that owes nobody
 * anything, because nothing about it was abandoned.
 */
async function playedOut(): Promise<AppHarness> {
  const app = await createSession(FOUR);
  await score(app, 17);
  await app.tap('Round 2 →');
  await score(app, 17);
  await app.tap('Round 3 →');
  await score(app, 17);

  return app;
}

/**
 * End the evening having said yes to the further question.
 *
 * Not an option on the `endSession` driver, because saying yes is the subject of these tests
 * rather than setup for them: the tap that answers it is one of the things being asserted, and a
 * driver that hid it would leave the spec asserting on a flag it never set from the screen.
 */
async function endSessionPaying(app: AppHarness): Promise<void> {
  await app.tap('Standings');
  await app.tap('End session');
  await app.tap(PAY);
  expect(app.isPressed(PAY)).toBe(true);
  await app.tap('End session');
}

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
