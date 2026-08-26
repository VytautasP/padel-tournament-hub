/*
 * Naming the courts, from the field on Review to the card on the Round tab (ADR-0017 §6).
 *
 * A club's booking is for courts 7 and 8, and a screen saying "Court 1" sends four people to the
 * wrong end of the building. Everything here is driven the way an organizer drives it — typed
 * fields and rendered text — because a name is a display concern and the only way to know it
 * reached the display is to read the display.
 *
 * The three rules the ADR is emphatic about are each their own test: a blank falls back rather
 * than being rejected, a duplicate is the club's problem and not the app's, and a name survives
 * the phone being closed.
 */
import { AppHarness } from './testing/app-harness';

const ROSTER = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn', 'Gita', 'Hugo'];

describe('naming the courts', () => {
  describe('the fields on Review', () => {
    it('offers one per court, pre-filled with the number nobody has to change', async () => {
      const app = await atReview();

      expect(app.textIn('Court 1 name')).toBe('Court 1');
      expect(app.hasField('Court 2 name')).toBe(false);

      await app.setNumber('Courts', 2);

      expect(app.textIn('Court 1 name')).toBe('Court 1');
      expect(app.textIn('Court 2 name')).toBe('Court 2');
    });

    it('takes a field away with the court it belonged to', async () => {
      const app = await atReview();
      await app.setNumber('Courts', 3);

      expect(app.hasField('Court 3 name')).toBe(true);

      await app.setNumber('Courts', 2);

      expect(app.hasField('Court 3 name')).toBe(false);
    });

    it('keeps the names already typed for the courts that remain', async () => {
      const app = await atReview();
      await app.setNumber('Courts', 3);
      await app.typeInto('Court 1 name', 'Centre');
      await app.typeInto('Court 2 name', 'Far end');

      await app.setNumber('Courts', 2);

      expect(app.textIn('Court 1 name')).toBe('Centre');
      expect(app.textIn('Court 2 name')).toBe('Far end');
    });

    it('is still holding what was typed after a trip back to the roster', async () => {
      const app = await atReview();
      await app.typeInto('Court 1 name', 'Court 7');

      await app.tap('Back');
      await app.tap('Next');

      expect(app.textIn('Court 1 name')).toBe('Court 7');
    });
  });

  describe('the name on the Round tab', () => {
    it('calls a court what the club calls it', async () => {
      const app = await atReview();
      await app.setNumber('Courts', 2);
      await app.typeInto('Court 1 name', 'Court 7');
      await app.typeInto('Court 2 name', 'Court 8');
      await app.tap('Create session');

      expect(app.shows('Court 7')).toBe(true);
      expect(app.shows('Court 8')).toBe(true);
      expect(app.shows('Court 1')).toBe(false);
      app.expectStoredSessionValid();
    });

    it('carries the name onto the score sheet the court opens into', async () => {
      const app = await atReview();
      await app.typeInto('Court 1 name', 'Centre');
      await app.tap('Create session');

      await app.tap('Enter score for Centre');

      expect(app.shows('Centre')).toBe(true);
    });

    it('falls back to the number when the field was left blank', async () => {
      // An empty field is somebody skipping the question, not making a mistake.
      const app = await atReview();
      await app.typeInto('Court 1 name', '');
      await app.tap('Create session');

      expect(app.shows('Court 1')).toBe(true);
      expect(app.repository.activeRecord()?.courtNames).toEqual(['']);
      app.expectStoredSessionValid();
    });

    it('lets two courts share a name rather than blocking the evening', async () => {
      // If a club really has two courts people call "Centre", that is the club's problem.
      const app = await atReview();
      await app.setNumber('Courts', 2);
      await app.typeInto('Court 1 name', 'Centre');
      await app.typeInto('Court 2 name', 'Centre');

      expect(app.canTap('Create session')).toBe(true);

      await app.tap('Create session');

      expect(app.shows('Round 1 of 7')).toBe(true);
      expect(app.repository.activeRecord()?.courtNames).toEqual(['Centre', 'Centre']);
      app.expectStoredSessionValid();
    });
  });

  describe('once the evening is under way', () => {
    it('still says Court 7 after the phone has been closed and opened', async () => {
      const created = await atReview();
      await created.typeInto('Court 1 name', 'Court 7');
      await created.tap('Create session');

      const app = await created.reload();
      await app.tap('Resume');

      expect(app.shows('Court 7')).toBe(true);
      app.expectStoredSessionValid();
    });

    it('offers no way to rename a court mid-session', async () => {
      // You name courts when you book them (ADR-0017 §6).
      const app = await atReview();
      await app.tap('Create session');

      expect(app.hasField('Court 1 name')).toBe(false);
      expect(app.shows('Court names')).toBe(false);
    });
  });
});

/** The Review step of an eight-player Americano, one court, everything else left alone. */
async function atReview(): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap('Americano');

  for (const name of ROSTER) {
    await app.type('Name', name);
    await app.tap('Add');
  }

  await app.tap('Next');

  return app;
}
