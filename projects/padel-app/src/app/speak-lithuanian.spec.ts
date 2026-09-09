/*
 * The second language, proven end to end on the one screen it lands on (ADR-0032, #69).
 *
 * What this ticket built is the machinery rather than the translation: the front door and the
 * settings sheet are Lithuanian and everything else is still English on purpose, so the specs
 * below say what the *switch* does and leave what the words are to `copy.lt.ts` and to the native
 * speaker who has yet to read it (spec §8).
 *
 * Two things are asserted through the dictionary rather than as literals, and one thing is not.
 * `copy.…` is a live binding here exactly as it is in a component — after the app has been
 * reopened in Lithuanian it reads Lithuanian — so a spec that says `copy.landing.tagline` is
 * saying "the front door is in the language the app chose", which is the claim. What is written
 * out in full is the English, on the launches that must stay English: an assertion that read the
 * dictionary on both sides of that question could not fail.
 *
 * The reload is the harness's `reload()` rather than the real one, and the spec performs it itself
 * after asking whether the app requested it. That is a truer model than a fake that re-rendered in
 * place: ADR-0032 §3 chose a reload precisely so that one app writes the preference and the *next*
 * one reads it, and these specs are two apps.
 */
import { copy } from './copy/copy';
import { LANGUAGE_KEY } from './preference/language';
import { THEME_KEY } from './preference/theme';
import { spectatorPath } from './share/share-link';
import { AppHarness } from './testing/app-harness';
import type { LaunchOptions } from './testing/app-harness';
import { RecordingPreferenceStorage } from './testing/recording-preference-storage';
import { createSession, endSession, storedSession } from './testing/session-driver';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];

/** The two words the sheet offers, which are the same two words in either language. */
const ENGLISH = 'English';
const LITHUANIAN = 'Lietuvių';

/** The front door in English, written out rather than read: see the file comment. */
const ENGLISH_TAGLINE = 'One padel evening, run from your phone.';

/** The spectator's table in English, written out for the same reason the tagline is. */
const ENGLISH_STANDINGS = 'Standings';

describe('speaking Lithuanian', () => {
  describe('a browser that has never been asked', () => {
    it('opens in English', async () => {
      const app = await AppHarness.launch();

      expect(app.shows(ENGLISH_TAGLINE)).toBe(true);
      expect(app.documentLanguage()).toBe('en');
    });

    /*
     * ADR-0032 §2, and the one acceptance criterion that is about something absent. A phone whose
     * owner reads Lithuanian opens this app in English until they say otherwise, because a browser
     * silently changing the language of a product an organizer has already learned is worse than a
     * switch one tap from the front door.
     */
    it('opens in English on a Lithuanian device, because nothing sniffs', async () => {
      const held = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');
      Object.defineProperty(navigator, 'language', { value: 'lt-LT', configurable: true });
      try {
        const app = await AppHarness.launch();

        expect(app.shows(ENGLISH_TAGLINE)).toBe(true);
        expect(app.documentLanguage()).toBe('en');
      } finally {
        Object.defineProperty(navigator, 'language', held ?? { value: 'en-GB' });
      }
    });

    it('reads back nothing it did not write', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      storage.put(LANGUAGE_KEY, 'esperanto');

      const app = await AppHarness.launch({ storage });

      expect(app.documentLanguage()).toBe('en');
      expect(app.shows(ENGLISH_TAGLINE)).toBe(true);
    });
  });

  describe('the control on the sheet', () => {
    it('offers each language named in that language, holding the one on screen', async () => {
      const app = await AppHarness.launch();
      await openSettings(app);

      expect(app.isOnScreen(ENGLISH)).toBe(true);
      expect(app.isOnScreen(LITHUANIAN)).toBe(true);
      expect(app.isPressed(ENGLISH)).toBe(true);
      expect(app.isPressed(LITHUANIAN)).toBe(false);
    });

    it('does nothing at all when the language already held is chosen', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      const app = await AppHarness.launch({ storage });
      await openSettings(app);
      await app.tap(ENGLISH);

      expect(app.reloads.asked).toBe(0);
      expect(storage.read(LANGUAGE_KEY)).toBe(null);
      expect(app.isPressed(ENGLISH)).toBe(true);
    });

    it('writes the choice and asks the browser to start the app again', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      const app = await AppHarness.launch({ storage });
      await openSettings(app);
      await app.tap(LITHUANIAN);

      expect(storage.read(LANGUAGE_KEY)).toBe('lt');
      expect(app.reloads.asked).toBe(1);
    });
  });

  describe('the app that comes back', () => {
    it('has a Lithuanian front door, and says so in the document', async () => {
      const app = await chooseLithuanian();

      expect(app.documentLanguage()).toBe('lt');
      expect(app.shows(copy.landing.tagline)).toBe(true);
      expect(app.canTap(copy.landing.newSession)).toBe(true);
      expect(app.shows(ENGLISH_TAGLINE)).toBe(false);
    });

    it('has a Lithuanian settings sheet, holding Lietuvių', async () => {
      const app = await chooseLithuanian();
      await openSettings(app);

      expect(app.shows(copy.settings.heading)).toBe(true);
      expect(app.shows(copy.settings.theme.heading)).toBe(true);
      expect(app.shows(copy.settings.language.heading)).toBe(true);
      expect(app.isPressed(LITHUANIAN)).toBe(true);
    });

    /*
     * The theme's three answers are Lithuanian, and they are the reason `themeLabel` reads the
     * dictionary rather than the stored word: `system` is what is kept and *Sistemos* is what is
     * offered, and only one of those two changes with the language.
     */
    it('offers the theme in Lithuanian, and still applies it', async () => {
      const app = await chooseLithuanian();
      await openSettings(app);
      await app.tap(copy.settings.theme.answers.dark);

      expect(app.theme()).toBe('dark');
      expect(app.isPressed(copy.settings.theme.answers.dark)).toBe(true);
    });

    it('goes back to English from the same control', async () => {
      const lithuanian = await chooseLithuanian();
      await openSettings(lithuanian);
      await lithuanian.tap(ENGLISH);
      // Two, because the reload survives a reopening exactly as the storage does: this is the
      // same browser, and it has now been asked to start the app again twice.
      expect(lithuanian.reloads.asked).toBe(2);

      const app = await lithuanian.reload();

      expect(app.documentLanguage()).toBe('en');
      expect(app.shows(ENGLISH_TAGLINE)).toBe(true);
    });
  });

  /*
   * The reload is only affordable because ADR-0025 put every byte of an evening in Firestore. A
   * switch mid-session is the moment that claim is actually cashed, so it is asserted rather than
   * assumed — and it is chosen from inside the evening, which is what the second gear exists for
   * (ADR-0031 §2).
   */
  describe('switching mid-evening', () => {
    it('loses nothing, and comes back to the evening still in progress', async () => {
      const session = await createSession(FOUR);
      await openSettings(session);
      await session.tap(LITHUANIAN);

      const app = await session.reload();

      expect(app.documentLanguage()).toBe('lt');
      expect(app.canTap(copy.landing.resume)).toBe(true);
      app.expectStoredSessionValid();
    });
  });

  /*
   * The dates down a Lithuanian organizer's own history, which is the most visible possible tell
   * that a translation is a veneer over an English app (ADR-0032 §5).
   *
   * The expected day is formatted from the evening's own `createdAt` rather than written out,
   * because the spec runs on whatever day it runs on. The English rendering is asserted first, and
   * asserted to be a different string, so this cannot pass by both sides agreeing on nothing.
   */
  describe('the day an evening was played', () => {
    it('is in Lithuanian down a Lithuanian history', async () => {
      const session = await createSession(FOUR);
      await endSession(session);
      await session.tap(copy.session.done);

      const [record] = session.repository.historyRecords();
      const english = dayIn('en-GB', record.createdAt);
      const lithuanian = dayIn('lt-LT', record.createdAt);
      expect(english).not.toBe(lithuanian);
      expect(session.shows(english)).toBe(true);

      await openSettings(session);
      await session.tap(LITHUANIAN);
      const app = await session.reload();

      expect(app.shows(copy.history.heading)).toBe(true);
      expect(app.shows(lithuanian)).toBe(true);
    });
  });

  /*
   * A browser with site data blocked, which ADR-0031 §4 says has to be an app that works. The
   * language is the harder half of that promise: a theme applies for the visit and simply does not
   * come back, while a language cannot apply at all — the app that would speak it is the one that
   * could not read the preference. So the switch is honestly a no-op, and the part worth pinning is
   * that it is a no-op rather than a blank screen.
   */
  describe('a browser that refuses to store anything', () => {
    it('comes back in English, with nothing broken', async () => {
      const chosen = await AppHarness.launch({ storage: RecordingPreferenceStorage.refusing() });
      await openSettings(chosen);
      await chosen.tap(LITHUANIAN);

      const app = await chosen.reload();

      expect(app.documentLanguage()).toBe('en');
      expect(app.shows(ENGLISH_TAGLINE)).toBe(true);
    });
  });

  /*
   * The largest audience this product has, and the one with nowhere to change anything
   * (ADR-0032 §6).
   *
   * A spectator arrives once, by scanning a square at the side of a court, and has never opened
   * the app — so §2 gives them English and ADR-0029 gives them no chrome to change it from. The
   * toggle is the whole of what stands between them and a table they cannot read, which is why
   * two words in a corner are worth the one exception to a page with nothing to tap.
   *
   * The evening is created by an organizer's app first, exactly as `watch-a-session-as-a-
   * spectator.spec.ts` does it: what has to be true is that the code the organizer read off their
   * phone opens this page, and a session written straight into the repository would be a
   * rendering. That file asks what is *not* in this corner; this one asks what the corner does.
   */
  describe('the spectator', () => {
    it('offers both languages, holding the one the table is in', async () => {
      const { spectator } = await watchingSomebodysEvening();

      expect(spectator.isOnScreen(ENGLISH)).toBe(true);
      expect(spectator.isOnScreen(LITHUANIAN)).toBe(true);
      expect(spectator.isPressed(ENGLISH)).toBe(true);
      expect(spectator.isPressed(LITHUANIAN)).toBe(false);
    });

    /* The desk wears the rail and the aside rather than the header, and the corner is in both. */
    it('offers the same two words at the desk', async () => {
      const { spectator } = await watchingSomebodysEvening({ tier: 'desk' });

      expect(spectator.isOnScreen(ENGLISH)).toBe(true);
      expect(spectator.isPressed(LITHUANIAN)).toBe(false);
    });

    /*
     * The end of a share code is a single sentence, which makes it the screen most likely to be
     * unreadable to the person holding it. There is still no retry — the toggle is not an action
     * about the evening, and the evening is what is gone.
     */
    it('offers them on the gone screen too, where the whole page is one sentence', async () => {
      const organizer = await createSession(FOUR);

      const spectator = await AppHarness.launch({
        repository: organizer.repository,
        at: spectatorPath('NOSUCHCODE'),
      });

      expect(spectator.shows(copy.spectator.gone.heading)).toBe(true);
      expect(spectator.isOnScreen(LITHUANIAN)).toBe(true);
    });

    it('writes the same key the sheet does, and asks the browser to start the app again', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      const { spectator } = await watchingSomebodysEvening({ storage });

      await spectator.tap(LITHUANIAN);

      expect(storage.read(LANGUAGE_KEY)).toBe('lt');
      expect(spectator.reloads.asked).toBe(1);
    });

    it('does nothing at all when the language already held is chosen', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      const { spectator } = await watchingSomebodysEvening({ storage });

      await spectator.tap(ENGLISH);

      expect(storage.read(LANGUAGE_KEY)).toBe(null);
      expect(spectator.reloads.asked).toBe(0);
    });

    /*
     * The app that comes back is at the same address, because nothing about the language went into
     * it (ADR-0024): the harness reopens where this app is, and where it is is the share code.
     */
    it('comes back at the same code, watching the same evening in Lithuanian', async () => {
      const { spectator } = await watchingSomebodysEvening();
      await spectator.tap(LITHUANIAN);

      const app = await spectator.reload();

      expect(app.documentLanguage()).toBe('lt');
      expect(app.shows(copy.session.standings)).toBe(true);
      expect(app.shows(ENGLISH_STANDINGS)).toBe(false);
      expect(app.isPressed(LITHUANIAN)).toBe(true);

      await app.tap(copy.session.standings);
      expect(app.shows(FOUR[0])).toBe(true);
    });

    /* The other half of writing the shared key: a browser that already chose, arriving cold. */
    it('is already Lithuanian on a browser that chose it in the app', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      storage.put(LANGUAGE_KEY, 'lt');

      const { spectator } = await watchingSomebodysEvening({ storage });

      expect(spectator.documentLanguage()).toBe('lt');
      expect(spectator.shows(copy.session.standings)).toBe(true);
      expect(spectator.isPressed(LITHUANIAN)).toBe(true);
      expect(spectator.reloads.asked).toBe(0);
    });

    it('carries no gear, no settings sheet and no theme control', async () => {
      const { spectator } = await watchingSomebodysEvening();

      expect(spectator.isOnScreen(copy.settings.open)).toBe(false);
      expect(spectator.shows(copy.settings.heading)).toBe(false);
      expect(spectator.shows(copy.settings.theme.heading)).toBe(false);
      for (const answer of Object.values(copy.settings.theme.answers)) {
        expect(spectator.isOnScreen(answer)).toBe(false);
      }
    });

    /*
     * The theme arrives here without a control, which is the whole of what "carries it" means: the
     * preference belongs to the browser (ADR-0031 §4), and a spectator's browser either holds one
     * or does not.
     */
    it('wears the theme the browser holds, and the phone where it holds none', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      storage.put(THEME_KEY, 'dark');

      const held = await watchingSomebodysEvening({ storage, systemTheme: 'light' });
      expect(held.spectator.theme()).toBe('dark');

      const followed = await watchingSomebodysEvening({ systemTheme: 'dark' });
      expect(followed.spectator.theme()).toBe('dark');
    });

    /* It adds no identity and no state on the session: what it writes is one key in one browser. */
    it('changes nothing about the evening it is watching', async () => {
      const { organizer, spectator } = await watchingSomebodysEvening();
      const before = JSON.stringify(organizer.repository.activeRecord());

      await spectator.tap(LITHUANIAN);

      expect(JSON.stringify(organizer.repository.activeRecord())).toBe(before);
    });
  });
});

/** Choose Lithuanian and be the browser that acts on it: the whole switch, in one call. */
async function chooseLithuanian(): Promise<AppHarness> {
  const app = await AppHarness.launch();
  await openSettings(app);
  await app.tap(LITHUANIAN);

  return await app.reload();
}

/**
 * An evening somebody else is running, and the phone of somebody watching it by its code.
 *
 * Two apps rather than one, and only the second is alive: the harness resets the testing module on
 * every launch, so what survives the organizer is the repository they are both looking at — which
 * is the arrangement in the field, on two phones.
 */
async function watchingSomebodysEvening(
  options: LaunchOptions = {},
): Promise<{ organizer: AppHarness; spectator: AppHarness }> {
  const organizer = await createSession(FOUR);
  const spectator = await AppHarness.launch({
    repository: organizer.repository,
    at: spectatorPath(storedSession(organizer).id),
    ...options,
  });

  return { organizer, spectator };
}

/** The gear, wherever it is being tapped from — the two headers open one component. */
async function openSettings(app: AppHarness): Promise<void> {
  await app.tap(copy.settings.open);
}

function dayIn(locale: string, instant: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(instant));
}
