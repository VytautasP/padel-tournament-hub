/*
 * The wizard's chrome, and the one claim the rebuild makes about width (`Wizard.dc.html`,
 * ADR-0022 §4).
 *
 * `create-americano-session.spec.ts` owns the walk itself — the steps, the defaults, the roster
 * that is held back — and it asks all of it of a phone. This file asks the two questions left
 * over.
 *
 * The first is the chrome the board draws around every step: leaving the wizard and stepping back
 * inside it are two different things sitting in two different places, so Cancel is on screen the
 * whole way through rather than only on the screen where there is nothing behind it, and Back is
 * absent on exactly that screen because there is nothing behind it.
 *
 * The second is the width. The wizard is a single centred column at all three tiers, which is a
 * statement about a stylesheet no unit test loads — jsdom does no layout — so what cannot be
 * asserted here is what it looks like. What can be asserted is everything a tier-driven
 * arrangement would break: that every step says the same words at every width, and that every
 * control is still exactly one control. A wizard that read the tier and built a second
 * arrangement would fail both the moment the two overlapped (ADR-0022 §5).
 */
import { AppHarness } from './testing/app-harness';
import type { Tier } from './layout/layout';

const ROSTER = ['Ana', 'Ben', 'Cara', 'Dov'];

describe('walking the creation wizard', () => {
  describe('the way out and the way back', () => {
    it('offers Cancel on every step, and Back on every step but the first', async () => {
      const app = await AppHarness.launch();
      await app.tap('New session');

      expect(app.canTap('Cancel')).toBe(true);
      expect(app.isOnScreen('Back')).toBe(false);

      await app.tap('Americano');

      expect(app.canTap('Cancel')).toBe(true);
      expect(app.canTap('Back')).toBe(true);

      await enterRoster(app, ROSTER);
      await app.tap('Next');

      expect(app.shows('Review & create')).toBe(true);
      expect(app.canTap('Cancel')).toBe(true);
      expect(app.canTap('Back')).toBe(true);
    });

    it('leaves the wizard from the last step, writing nothing', async () => {
      const app = await atReview('Americano', ROSTER);

      await app.tap('Cancel');

      expect(app.canTap('New session')).toBe(true);
      expect(app.repository.activeRecord()).toBeNull();
    });

    it('steps back one screen at a time, and over the pairing step in a mode without one', async () => {
      const app = await atReview('Americano', ROSTER);

      await app.tap('Back');
      expect(app.shows('Who is playing?')).toBe(true);

      await app.tap('Back');
      expect(app.shows('Which format?')).toBe(true);
      expect(app.isOnScreen('Back')).toBe(false);
    });

    it('steps back through the pairing step in the mode that has one', async () => {
      const app = await atReview('Team Americano', ROSTER);

      await app.tap('Back');
      expect(app.shows('Who plays with whom?')).toBe(true);

      await app.tap('Back');
      expect(app.shows('Who is playing?')).toBe(true);
    });
  });

  describe('at every width', () => {
    it('says the same words on every step, from the phone to the desk', async () => {
      const phone = await stepsAt('phone');

      expect(await stepsAt('wide')).toEqual(phone);
      expect(await stepsAt('desk')).toEqual(phone);
    });

    it('renders one control per label at the desk, all the way to a created session', async () => {
      // Every tap below goes through the harness, which refuses a label two controls answer to.
      const app = await atReview('Team Americano', ROSTER, 'desk');

      await app.tap('Create session');

      expect(app.shows('Court 1')).toBe(true);
      expect(app.shows('Ana & Ben')).toBe(true);
      app.expectStoredSessionValid();
    });
  });
});

/** Every word of every step of a Team Americano evening — the walk with all four — at one tier. */
async function stepsAt(tier: Tier): Promise<Record<string, string>> {
  const app = await AppHarness.launch({ tier });
  await app.tap('New session');
  const mode = app.text();

  await app.tap('Team Americano');
  await enterRoster(app, ROSTER);
  const players = app.text();

  await app.tap('Next');
  await pairEveryone(app);
  const pairing = app.text();

  await app.tap('Next');
  const review = app.text();

  return { mode, players, pairing, review };
}

async function atReview(mode: string, names: readonly string[], tier?: Tier): Promise<AppHarness> {
  const app = await AppHarness.launch({ tier });
  await app.tap('New session');
  await app.tap(mode);
  await enterRoster(app, names);
  await app.tap('Next');

  if (app.shows('Who plays with whom?')) {
    await pairEveryone(app);
    await app.tap('Next');
  }

  return app;
}

async function enterRoster(app: AppHarness, names: readonly string[]): Promise<void> {
  for (const name of names) {
    await app.type('Name', name);
    await app.tap('Add');
  }
}

/** The roster in the order it was typed, paired off two at a time. */
async function pairEveryone(app: AppHarness): Promise<void> {
  for (const name of ROSTER) {
    await app.tap(`Pair ${name}`);
  }
}
