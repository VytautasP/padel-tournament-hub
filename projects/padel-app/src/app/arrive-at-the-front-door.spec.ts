/*
 * The front door with both halves of ADR-0013 standing on it at once, and what the desk does to it.
 *
 * `end-the-session.spec.ts` owns every way the landing page *changes* — an evening starting, one
 * being discarded, one ending into history, a row being deleted — and it asks each of those
 * questions of a page carrying one thing. This file asks the one question left over: what the page
 * looks like when it carries both, because the Resume card and session history have never been on
 * screen together, and the desk tier's arrangement is a claim about exactly that pair.
 *
 * The desk tests are the whole of what proves the split is CSS. There is no stylesheet in a unit
 * test — jsdom does no layout and loads none — so what the two columns look like is not a thing
 * that can be asserted here and is not what these are for. What can be asserted is everything a
 * `LAYOUT`-driven split would break: that the words are the same words, that no label is rendered
 * twice, and that every control is still the one control it was. A page that read the tier and
 * built a second arrangement would fail all three the moment the two overlapped, which is the
 * failure ADR-0022 §5 says to design against rather than to remember.
 *
 * The date in a history row cannot be written down in advance, so it is formatted here rather than
 * imported from the dictionary — the same reasoning, and the same line, as the spec next door.
 */
import { AppHarness } from './testing/app-harness';
import { createSession, endSession, score } from './testing/session-driver';
import type { Tier } from './layout/layout';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];

const today = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
}).format(new Date());

const ROW = `${today} · Americano · 4 players`;

describe('arriving at the front door', () => {
  it('carries the evening in progress and the evenings already played at once', async () => {
    const app = await aFrontDoorCarryingBoth();

    expect(app.shows('Session in progress')).toBe(true);
    expect(app.shows('Americano · 4 players · round 1')).toBe(true);
    expect(app.shows('Session history')).toBe(true);
    expect(app.shows(ROW)).toBe(true);
    // Still absent rather than disabled, with an evening standing and history under it.
    expect(app.isOnScreen('New session')).toBe(false);
  });

  describe('at the desk', () => {
    it('says the same words in the same order, with the overflow open', async () => {
      const phone = await aFrontDoorCarryingBoth();
      await phone.tap('Session options');
      const words = phone.text();

      const desk = await AppHarness.launch({ repository: phone.repository, tier: 'desk' });
      await desk.tap('Session options');

      expect(desk.text()).toBe(words);
    });

    it('still offers one of every control, and each of them still does what it did', async () => {
      const app = await aFrontDoorCarryingBoth('desk');

      // Every tap below goes through the seam's "exactly one control called this", so a second
      // arrangement rendered beside the first would throw here rather than quietly pass.
      await app.tap('Session options');
      expect(app.isOnScreen('Discard')).toBe(true);

      await app.tap(`Delete ${ROW}`);
      expect(app.shows('Nothing here can be recovered.')).toBe(true);
      await app.tap('Cancel');

      await app.tap('Resume');
      expect(app.shows('Round 1 of 3')).toBe(true);
    });
  });
});

/**
 * A front door with an evening in progress *and* an evening in history.
 *
 * Both halves have to be real, so the evening in history is played and ended through the app
 * rather than written into storage. The second evening is walked through the wizard by hand
 * because the drivers each open an app of their own, and the whole point here is one app that has
 * done both things; the reload at the end is only how an organizer gets back to the front door
 * from a session that has not ended.
 */
async function aFrontDoorCarryingBoth(tier?: Tier): Promise<AppHarness> {
  const app = await createSession(FOUR, 1, 24, tier);
  await score(app, 17);
  await endSession(app);
  await app.tap('Done');

  await app.tap('New session');
  await app.tap('Americano');
  for (const name of FOUR) {
    await app.type('Name', name);
    await app.tap('Add');
  }
  await app.tap('Next');
  await app.tap('Create session');

  return await app.reload();
}
