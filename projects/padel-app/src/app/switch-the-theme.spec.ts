/*
 * The first preference this app has ever stored, from the gear on the front door (ADR-0031).
 *
 * Three answers rather than two, and the whole of why is the first test: `system` is a preference
 * and not the absence of one, so an organizer who never opens this sheet keeps the behaviour the
 * app has always had, and one who opens it and picks `system` again keeps it too. A two-state
 * toggle would have destroyed that on the first tap and never given it back.
 *
 * What cannot be tested here is the thing the feature is actually for: a cold start that paints
 * dark on the first frame. That is the inline script in `index.html`, which runs before Angular
 * exists and therefore before any of this does (ADR-0031 §5, consequences). What *is* tested is
 * everything downstream of it — that the preference is read, that it beats the OS in both
 * directions, that `system` follows the OS live, that it survives being closed and reopened, and
 * that a browser refusing to store it is an app that works rather than an app that throws.
 *
 * The theme is read off `<html data-theme>` rather than off a colour, because there is no
 * stylesheet in a unit test and a colour is not a thing this suite can see. That attribute is the
 * whole of what `styles.css` keys the dark palette on, so it is the honest seam: an app that
 * stamped it wrongly would be an app drawn wrongly.
 */
import { AppHarness } from './testing/app-harness';
import { THEME_KEY } from './preference/theme';
import { RecordingPreferenceStorage } from './testing/recording-preference-storage';

describe('switching the theme', () => {
  describe('with nothing stored', () => {
    it('follows a light OS', async () => {
      const app = await AppHarness.launch({ systemTheme: 'light' });

      expect(app.theme()).toBe('light');
    });

    it('follows a dark OS', async () => {
      const app = await AppHarness.launch({ systemTheme: 'dark' });

      expect(app.theme()).toBe('dark');
    });

    it('tells the browser both are in play, so its own controls follow the OS too', async () => {
      const app = await AppHarness.launch({ systemTheme: 'dark' });

      expect(app.colorScheme()).toBe('light dark');
    });

    it('opens the sheet holding System', async () => {
      const app = await AppHarness.launch();
      await openSettings(app);

      expect(app.isPressed('System')).toBe(true);
      expect(app.isPressed('Light')).toBe(false);
      expect(app.isPressed('Dark')).toBe(false);
    });
  });

  describe('an override', () => {
    it('is dark on a light-OS device, immediately and with the sheet still up', async () => {
      const app = await AppHarness.launch({ systemTheme: 'light' });
      await openSettings(app);
      await app.tap('Dark');

      expect(app.theme()).toBe('dark');
      expect(app.isPressed('Dark')).toBe(true);
      expect(app.shows('Theme')).toBe(true);
    });

    it('is light on a dark-OS device', async () => {
      const app = await AppHarness.launch({ systemTheme: 'dark' });
      await openSettings(app);
      await app.tap('Light');

      expect(app.theme()).toBe('light');
    });

    it('pins the browser to the one theme, so its scrollbars stop following the OS', async () => {
      const app = await AppHarness.launch({ systemTheme: 'dark' });
      await openSettings(app);
      await app.tap('Light');

      expect(app.colorScheme()).toBe('light');
    });

    /*
     * The bar behind the notch, and the one thing about it a unit test can see.
     *
     * `index.html` ships two `theme-color` metas selected by `prefers-color-scheme`, and the
     * browser consults the first whose media matches. Colouring either of them in place would put
     * the organizer's answer behind the OS's selection — a dark override on a light phone would
     * either paint the bar the app is not, or paint a meta the phone never reads. So there has to
     * be exactly one left standing, and it has to carry no media at all.
     *
     * This is asserted of an app the pre-paint script never ran for, because that is the browser
     * the harness renders and it is also a real one: a content policy strict enough to refuse an
     * inline script is the same browser `styles.css`'s guarded media query is written for.
     */
    it('leaves one notch bar standing, following nothing but the app', async () => {
      const app = await AppHarness.launch({ systemTheme: 'light' });
      expect(app.themeColorMedia()).toEqual([null]);

      await openSettings(app);
      await app.tap('Dark');

      expect(app.themeColorMedia()).toEqual([null]);
    });

    it('is given back by choosing System again', async () => {
      const app = await AppHarness.launch({ systemTheme: 'dark' });
      await openSettings(app);
      await app.tap('Light');
      await app.tap('System');

      expect(app.theme()).toBe('dark');
      expect(app.colorScheme()).toBe('light dark');
    });
  });

  describe('the OS changing underneath', () => {
    it('changes a system app without a reload', async () => {
      const app = await AppHarness.launch({ systemTheme: 'light' });
      await app.flipSystemTheme('dark');

      expect(app.theme()).toBe('dark');
    });

    it('leaves an overridden app alone', async () => {
      const app = await AppHarness.launch({ systemTheme: 'light' });
      await openSettings(app);
      await app.tap('Light');
      await app.flipSystemTheme('dark');

      expect(app.theme()).toBe('light');
    });
  });

  describe('closing the app and opening it again', () => {
    it('comes back to the chosen theme', async () => {
      const chosen = await AppHarness.launch({ systemTheme: 'light' });
      await openSettings(chosen);
      await chosen.tap('Dark');

      const app = await chosen.reload();

      expect(app.theme()).toBe('dark');
      await openSettings(app);
      expect(app.isPressed('Dark')).toBe(true);
    });

    it('reads back nothing it did not write', async () => {
      const storage = RecordingPreferenceStorage.remembering();
      storage.put(THEME_KEY, 'midnight');

      const app = await AppHarness.launch({ storage, systemTheme: 'light' });

      expect(app.theme()).toBe('light');
      await openSettings(app);
      expect(app.isPressed('System')).toBe(true);
    });
  });

  describe('a browser that refuses to store anything', () => {
    it('opens in the system theme with no error', async () => {
      const app = await AppHarness.launch({
        storage: RecordingPreferenceStorage.refusing(),
        systemTheme: 'dark',
      });

      expect(app.theme()).toBe('dark');
    });

    it('applies the choice, and simply does not keep it', async () => {
      const chosen = await AppHarness.launch({
        storage: RecordingPreferenceStorage.refusing(),
        systemTheme: 'light',
      });
      await openSettings(chosen);
      await chosen.tap('Dark');
      expect(chosen.theme()).toBe('dark');

      const app = await chosen.reload();

      expect(app.theme()).toBe('light');
    });
  });

  describe('the sheet itself', () => {
    it('rises from the bottom on a phone', async () => {
      const app = await AppHarness.launch();
      await openSettings(app);

      expect(app.sheetPosition()).toBe('bottom');
    });

    it('opens in the middle at the desk tier', async () => {
      const app = await AppHarness.launch({ tier: 'desk' });
      await openSettings(app);

      expect(app.sheetPosition()).toBe('centered');
    });

    it('closes on Done, leaving the choice behind', async () => {
      const app = await AppHarness.launch({ systemTheme: 'light' });
      await openSettings(app);
      await app.tap('Dark');
      await app.tap('Done');

      expect(() => app.sheetPosition()).toThrow('No sheet is on screen.');
      expect(app.theme()).toBe('dark');
    });
  });
});

/** The gear on the landing header, and what it opens. */
async function openSettings(app: AppHarness): Promise<void> {
  await app.tap('Settings');
}
