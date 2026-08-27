/*
 * The tracer bullet, driven the way an organizer drives it: an empty app, a wizard, a schedule
 * that survives closing the phone.
 *
 * Everything here goes through `AppHarness` — rendered text, tapped labels, typed fields — and
 * nothing reaches for a component, a signal or a store. See the note at the top of the harness
 * for why that constraint is worth the friction.
 */
import { AppHarness } from './testing/app-harness';

const NAME_FIELD = 'Name';
const ROSTER = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin'];

describe('creating an Americano session', () => {
  it('opens on one button and one line of copy', async () => {
    const app = await AppHarness.launch();

    expect(app.shows('One padel evening, run from your phone.')).toBe(true);
    expect(app.canTap('New session')).toBe(true);
    expect(app.isOnScreen('Resume')).toBe(false);
  });

  it('walks Mode, Players, then Review & create', async () => {
    const app = await AppHarness.launch();

    await app.tap('New session');
    expect(app.shows('Which format?')).toBe(true);

    await app.tap('Americano');
    expect(app.shows('Who is playing?')).toBe(true);

    await enterRoster(app, ROSTER);
    await app.tap('Next');

    expect(app.shows('Review & create')).toBe(true);
  });

  it('offers all three formats, every one of them playable', async () => {
    const app = await AppHarness.launch();
    await app.tap('New session');

    for (const mode of ['Americano', 'Mixicano', 'Team Americano']) {
      expect(app.canTap(mode)).toBe(true);
    }
  });

  describe('the Players step', () => {
    it('clears the field and keeps the keyboard up after every name', async () => {
      const app = await atPlayers();

      await app.type(NAME_FIELD, 'Ana');
      await app.tap('Add');

      expect(app.shows('Ana')).toBe(true);
      expect(app.valueIn(NAME_FIELD)).toBe('');
      expect(app.fieldHasFocus(NAME_FIELD)).toBe(true);
    });

    it('corrects a name by tapping it', async () => {
      const app = await atPlayers();
      await enterRoster(app, ['Ana', 'Ben']);

      await app.tap('Edit Ana');
      expect(app.valueIn(NAME_FIELD)).toBe('Ana');

      await app.type(NAME_FIELD, 'Anna');
      await app.tap('Save');

      expect(app.shows('Anna')).toBe(true);
      expect(app.shows('Ben')).toBe(true);
    });

    it('removes a name that should not be there', async () => {
      const app = await atPlayers();
      await enterRoster(app, ['Ana', 'Dov']);

      await app.tap('Remove Dov');

      expect(app.shows('Ana')).toBe(true);
      expect(app.shows('Dov')).toBe(false);
    });

    it('leaves a player alone when a correction is blanked', async () => {
      // Clearing the field is on the way to retyping a name, not a hidden way to delete one.
      const app = await atPlayers();
      await enterRoster(app, ['Ana', 'Ben']);

      await app.tap('Edit Ana');
      await app.type(NAME_FIELD, '');
      await app.tap('Save');

      expect(app.shows('Ana')).toBe(true);
      expect(app.shows('Ben')).toBe(true);
    });

    it('says nothing about the minimum before anybody has typed a name', async () => {
      const app = await atPlayers();

      expect(app.shows('A session needs at least 4 players.')).toBe(false);
      expect(app.canTap('Next')).toBe(false);
    });

    it('blocks a roster of three and says why, on the screen where it is fixable', async () => {
      const app = await atPlayers();
      await enterRoster(app, ['Ana', 'Ben', 'Cara']);

      expect(app.shows('A session needs at least 4 players.')).toBe(true);
      expect(app.canTap('Next')).toBe(false);

      await enterRoster(app, ['Dov']);

      expect(app.shows('A session needs at least 4 players.')).toBe(false);
      expect(app.canTap('Next')).toBe(true);
    });
  });

  describe('the Review step', () => {
    it('arrives pre-filled with the answers nobody was going to change', async () => {
      const app = await atReview(ROSTER);

      expect(app.numberIn('Target score')).toBe(24);
      expect(app.numberIn('Courts')).toBe(1);
      // Five players on one court hold ten pairs, two per round: a complete rotation.
      expect(app.numberIn('Rounds')).toBe(5);
    });

    it('lets all three be changed, and creates the session that was reviewed', async () => {
      const app = await atReview(ROSTER);

      await app.setNumber('Target score', 32);
      await app.setNumber('Rounds', 3);
      await app.tap('Create session');

      expect(app.shows('Round 1 of 3')).toBe(true);

      const stored = app.repository.activeRecord();
      expect(stored?.session.targetScore).toBe(32);
      expect(stored?.session.rounds).toHaveLength(3);
      app.expectStoredSessionValid();
    });

    it('shows the nearest number an evening can be run with rather than accepting a zero', async () => {
      const app = await atReview(ROSTER);

      await app.setNumber('Courts', 0);

      expect(app.numberIn('Courts')).toBe(1);
    });

    it('keeps everything typed when Back is used to go and check', async () => {
      const app = await atReview(ROSTER);
      await app.setNumber('Rounds', 4);

      await app.tap('Back');
      expect(app.shows('Ana')).toBe(true);
      expect(app.shows('Elin')).toBe(true);

      await app.tap('Next');
      expect(app.numberIn('Rounds')).toBe(4);
      expect(app.shows('Review & create')).toBe(true);
    });
  });

  it('writes nothing until the session is created, and nothing at all if the wizard is left', async () => {
    const app = await atReview(ROSTER);
    expect(app.repository.activeRecord()).toBeNull();

    await app.tap('Back');
    await app.tap('Back');
    await app.tap('Cancel');

    expect(app.repository.activeRecord()).toBeNull();
    expect(app.canTap('New session')).toBe(true);
  });

  describe('the Round tab', () => {
    it('renders round one: every court, both sides, and no score', async () => {
      const app = await createSession(ROSTER);

      expect(app.shows('Round 1 of 5')).toBe(true);
      expect(app.shows('Court 1')).toBe(true);
      expect(app.shows('No score yet')).toBe(true);

      // Four of the five are on the court, and the fifth is told that they are not.
      for (const name of ROSTER) {
        expect(app.shows(name)).toBe(true);
      }
      expect(app.shows('Sitting out:')).toBe(true);
      app.expectStoredSessionValid();
    });

    it('names every court a two-court evening puts in play', async () => {
      const roster = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn', 'Gita', 'Hugo'];
      const app = await createSession(roster, 2);

      expect(app.shows('Court 1')).toBe(true);
      expect(app.shows('Court 2')).toBe(true);
      // An exact-fit roster is not told every round that nobody is sitting out (ADR-0016).
      expect(app.shows('Sitting out:')).toBe(false);
      app.expectStoredSessionValid();
    });
  });

  describe('closing the app and opening it again', () => {
    it('offers Resume rather than New session', async () => {
      const created = await createSession(ROSTER);
      const app = await created.reload();

      expect(app.isOnScreen('New session')).toBe(false);
      expect(app.canTap('Resume')).toBe(true);
      expect(app.shows('Americano · 5 players · round 1')).toBe(true);
      app.expectStoredSessionValid();
    });

    it('puts the organizer back in the same round of the same session', async () => {
      const created = await createSession(ROSTER);
      const before = created.text();

      const app = await created.reload();
      await app.tap('Resume');

      expect(app.text()).toBe(before);
      app.expectStoredSessionValid();
    });
  });
});

async function atPlayers(): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await app.tap('New session');
  await app.tap('Americano');

  return app;
}

async function atReview(names: readonly string[]): Promise<AppHarness> {
  const app = await atPlayers();
  await enterRoster(app, names);
  await app.tap('Next');

  return app;
}

async function createSession(names: readonly string[], courtCount = 1): Promise<AppHarness> {
  const app = await atReview(names);
  if (courtCount !== 1) {
    await app.setNumber('Courts', courtCount);
  }
  await app.tap('Create session');

  return app;
}

async function enterRoster(app: AppHarness, names: readonly string[]): Promise<void> {
  for (const name of names) {
    await app.type(NAME_FIELD, name);
    await app.tap('Add');
  }
}
