/*
 * The session at 1280px and above: a rail instead of a bottom bar, and standings that never leave
 * the screen (ADR-0022 §2 and §3).
 *
 * Two claims are being made and neither is about pixels. The first is that **Standings stop being
 * a destination**: once the table is permanently on screen, a rail item leading to it would change
 * nothing when it was tapped. The second is that **the aside is not the Round view's**: it is on
 * screen from Players too, because deciding whether to let somebody go home is a question about
 * how the evening is going.
 *
 * Both are asserted the way everything in this project is — by label, through the DOM seam. That
 * is also what proves the third claim, the one ADR-0022 §5 calls a correctness requirement rather
 * than a preference: exactly one navigation exists at a time. A shell that kept both would put two
 * buttons labelled `Round` in the DOM, and `tap` throws on the ambiguity without being asked to.
 *
 * What is deliberately not asserted here is width. The rail's 248px, the aside's 340px and the
 * two-up court grid are CSS, and a unit test loads no stylesheet — they are eyeballed in a browser
 * at both themes, like every other drawn thing in this app (ADR-0018).
 */
import { createSession, score } from './testing/session-driver';
import type { Tier } from './layout/layout';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];
const SIX = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn'];

describe('running the evening at a desk', () => {
  describe('the rail', () => {
    it('offers Round and Players', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');

      expect(app.canTap('Round')).toBe(true);
      expect(app.canTap('Players')).toBe(true);
    });

    it('does not offer Standings, because the table is already on screen', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');

      expect(app.isOnScreen('Standings')).toBe(false);
    });

    it('names the evening the rail belongs to', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');

      expect(app.shows('Padel Tournament Hub')).toBe(true);
      expect(app.shows('Americano · 4 players')).toBe(true);
    });

    it('moves the main area to Players and back to the round', async () => {
      const app = await createSession(SIX, 1, 24, 'desk');

      await app.tap('Players');
      expect(app.canTap('Options for Ana')).toBe(true);

      await app.tap('Round');
      expect(app.canTap('Enter score for Court 1')).toBe(true);
    });
  });

  describe('the standings aside', () => {
    it('is on screen from the round', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');

      expect(app.shows('Standings')).toBe(true);
      expect(app.canTap('End session')).toBe(true);
    });

    it('is still on screen from Players', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      await app.tap('Players');

      // The word is on screen while no control carries it: the table is context, not a place.
      expect(app.shows('Standings')).toBe(true);
      expect(app.isOnScreen('Standings')).toBe(false);
      expect(app.canTap('End session')).toBe(true);
    });

    it('carries the podium once the evening has produced one', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      await score(app, 17);

      expect(app.shows('Podium')).toBe(true);

      await app.tap('Players');
      expect(app.shows('Podium')).toBe(true);
    });

    it('ends the evening from the Players destination', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      await app.tap('Players');

      await app.tap('End session');
      await app.tap('End session');

      expect(app.canTap('Done')).toBe(true);
      expect(app.isOnScreen('End session')).toBe(false);
      app.expectEndedSessionValid();
    });

    it('reads the table the round is writing, with nothing to keep in step', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      await score(app, 17);

      expect(app.shows('17.0')).toBe(true);
    });
  });

  describe('below the desk', () => {
    it('offers all three destinations in the bottom bar on a phone', async () => {
      expect(await destinationsAt('phone')).toEqual(['Round', 'Standings', 'Players']);
    });

    it('offers the same three on the widened middle tier', async () => {
      expect(await destinationsAt('wide')).toEqual(['Round', 'Standings', 'Players']);
    });

    it('keeps the table one tap away rather than permanently on screen', async () => {
      const app = await createSession(FOUR, 1, 24, 'wide');

      expect(app.isOnScreen('End session')).toBe(false);

      await app.tap('Standings');
      expect(app.canTap('End session')).toBe(true);
    });
  });

  describe('one navigation at a time', () => {
    /*
     * The assertion is the absence of a throw. `tap` refuses an ambiguous label, so a shell that
     * rendered the rail and the bottom bar together would fail here on the second `Round` rather
     * than on anything this test had to spell out.
     */
    it('renders one control per destination at the desk', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');

      await app.tap('Players');
      await app.tap('Round');

      expect(app.canTap('Enter score for Court 1')).toBe(true);
    });

    it('renders one control per destination on a phone', async () => {
      const app = await createSession(FOUR);

      await app.tap('Standings');
      await app.tap('Players');
      await app.tap('Round');

      expect(app.canTap('Enter score for Court 1')).toBe(true);
    });
  });
});

/** Which of the three destinations the navigation offers at one tier. */
async function destinationsAt(tier: Tier): Promise<string[]> {
  const app = await createSession(FOUR, 1, 24, tier);

  return ['Round', 'Standings', 'Players'].filter((label) => app.isOnScreen(label));
}
