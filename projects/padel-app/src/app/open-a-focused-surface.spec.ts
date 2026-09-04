/*
 * Where a focused surface opens, and why that is a question about the width (ADR-0022 §4).
 *
 * ADR-0014 §1 put the score sheet at the bottom because "the tap that matters has to land under
 * the thumb that asked for it", which is an argument about a phone and only about a phone. At the
 * desk there is no thumb, so the sheet becomes a centered dialog — and the whole point of
 * `sheet/sheets.ts` is that the score sheet, the confirmations, the partner sheet and the roster
 * preview all change together, without any of them mentioning it.
 *
 * So there are two kinds of test here. One pair says which shape a sheet takes at which tier. The
 * rest say what must not change: the same words, the same fields, the same result in the
 * repository, whichever tier the evening is being run at. Position is the only difference there is
 * allowed to be, which is exactly why `sheetPosition()` is the only way to read it — a sheet that
 * announced where it was would be a sheet the organizer could tell apart, and none of them may be.
 */
import {
  createSession,
  createTeamAmericanoSession,
  openSheet,
  score,
  scoreOf,
} from './testing/session-driver';
import { AppHarness } from './testing/app-harness';
import type { Tier } from './layout/layout';
import type { SheetPosition } from './sheet/sheets';
import type { InMemorySessionRepository } from './session/in-memory-session-repository';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];
const SIX = ['Ana', 'Ben', 'Cara', 'Dov', 'Elin', 'Finn'];
const THREE_TEAMS: readonly (readonly [string, string])[] = [
  ['Ana', 'Ben'],
  ['Cara', 'Dov'],
  ['Elin', 'Finn'],
];

describe('opening a focused surface', () => {
  describe('the score sheet', () => {
    it('rises from the bottom below the desk tier', async () => {
      const app = await createSession(FOUR);
      await openSheet(app);

      expect(app.sheetPosition()).toBe('bottom');
    });

    it('still rises from the bottom on the widened middle tier', async () => {
      const app = await createSession(FOUR, 1, 24, 'wide');
      await openSheet(app);

      expect(app.sheetPosition()).toBe('bottom');
    });

    it('opens in the middle of the screen at the desk tier', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      await openSheet(app);

      expect(app.sheetPosition()).toBe('centered');
    });
  });

  describe('the surfaces that never asked', () => {
    it('confirms an ending at the bottom on a phone and in the middle at a desk', async () => {
      expect(await positionOfEndingConfirmation('phone')).toBe('bottom');
      expect(await positionOfEndingConfirmation('desk')).toBe('centered');
    });

    it('previews a roster change where the tier says, not where the Players tab says', async () => {
      const app = await createSession(SIX, 1, 24, 'desk');
      await app.tap('Players');
      await app.tap('Options for Ana');
      await app.tap('Went home');

      expect(app.shows('The rest of the evening')).toBe(true);
      expect(app.sheetPosition()).toBe('centered');
    });

    it('asks for a partner in the same place', async () => {
      // The team keeps its name when half of it goes home, which is what makes the button
      // addressable here without asking the document who is short a player.
      const app = await createTeamAmericanoSession(THREE_TEAMS, 1, 24, 'desk');
      await app.tap('Players');
      await app.tap('Options for Ana');
      await app.tap('Went home');
      await app.tap('Ana went home');
      await app.tap('Assign partner to Ana & Ben');

      expect(app.shows('Assign a partner')).toBe(true);
      expect(app.sheetPosition()).toBe('centered');
    });

    it('is one sheet at a time, wherever it is', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      await openSheet(app);
      await app.tap('Cancel');

      expect(() => app.sheetPosition()).toThrow('No sheet is on screen.');
    });
  });

  describe('what a score sheet does at the desk', () => {
    it('says word for word what it says on a phone', async () => {
      // One evening, opened twice. Two sessions would be two draws, and the sheet's field labels
      // are whoever the engine happened to put together.
      const { repository } = await createSession(FOUR);

      expect(await wordsOnAnOpenScoreSheet(repository, 'desk')).toBe(
        await wordsOnAnOpenScoreSheet(repository, 'phone'),
      );
    });

    it('takes a number, derives the other side and records the result', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      const sides = await openSheet(app);

      await app.setNumber(sides.a, 17);
      expect(app.numberIn(sides.b)).toBe(7);

      await app.tap('Save');

      expect(app.shows('17 – 7')).toBe(true);
      expect(scoreOf(app)).toEqual({ sideA: 17, sideB: 7 });
      app.expectStoredSessionValid();
    });

    it('refuses a number above the target with the same correction', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      const sides = await openSheet(app);

      await app.setNumber(sides.a, 27);

      expect(app.shows('A score cannot be more than 24.')).toBe(true);
      expect(app.canTap('Save')).toBe(false);
      expect(app.textIn(sides.b)).toBe('');
    });

    it('reopens a scored court at its current value', async () => {
      const app = await createSession(FOUR, 1, 24, 'desk');
      const sides = await score(app, 17);

      await app.tap('Enter score for Court 1');

      expect(app.numberIn(sides.a)).toBe(17);
      expect(app.numberIn(sides.b)).toBe(7);
      expect(app.sheetPosition()).toBe('centered');
    });
  });
});

/** Where the end-of-evening confirmation lands at one tier. */
async function positionOfEndingConfirmation(tier: Tier): Promise<SheetPosition> {
  const app = await createSession(FOUR, 1, 24, tier);
  await app.tap('Standings');
  await app.tap('End session');

  const position = app.sheetPosition();
  await app.tap('Cancel');

  return position;
}

/** Everything readable with the score sheet of a stored evening open at one tier. */
async function wordsOnAnOpenScoreSheet(
  repository: InMemorySessionRepository,
  tier: Tier,
): Promise<string> {
  const app = await AppHarness.launch({ repository, tier });
  await app.tap('Resume');
  await openSheet(app);

  return app.text();
}
