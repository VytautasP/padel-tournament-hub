/*
 * Which of the three shapes the app is in, and what a test can say about it (ADR-0022).
 *
 * This is the seam rather than anything an organizer can see: no screen looks different at any
 * tier yet, and every test below asserts that as hard as it asserts the tier itself. The
 * navigation and the score sheet are what will read the tier, in the slices after this one.
 *
 * Reading the tier back is deliberately awkward, and the awkwardness is the point. A spec is not
 * allowed to inject `LAYOUT` and read the signal — that would be a test of the token, and the
 * token is not the thing that has to be right. So the tier is read the way every other fact in
 * this project is read: something is rendered and the words are looked at. `TierProbe` is that
 * something, and it exists only here, only while nothing real renders differently. Once the rail
 * exists, the rail is the assertion.
 *
 * The widths are proved against the production implementation with the window stubbed, because
 * 768 and 1280 are the two numbers in this whole arrangement that a fake cannot vouch for.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BreakpointLayout } from './layout/breakpoint-layout';
import { LAYOUT } from './layout/layout';
import { AppHarness } from './testing/app-harness';
import { createSession } from './testing/session-driver';

const FOUR = ['Ana', 'Ben', 'Cara', 'Dov'];

/** The one thing in the app that renders the tier, so that a test can read one off a screen. */
@Component({
  selector: 'app-tier-probe',
  template: '{{ tier() }}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TierProbe {
  protected readonly tier = inject(LAYOUT).tier;
}

const realMatchMedia = window.matchMedia;

describe('the layout seam', () => {
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  describe('the tier the app is launched in', () => {
    it('is the phone when nothing says otherwise', async () => {
      await AppHarness.launch();

      expect(tierOnScreen()).toBe('phone');
    });

    it('is the widened middle tier when the launch asks for it', async () => {
      await AppHarness.launch({ tier: 'wide' });

      expect(tierOnScreen()).toBe('wide');
    });

    it('is the desk when the launch asks for it', async () => {
      await AppHarness.launch({ tier: 'desk' });

      expect(tierOnScreen()).toBe('desk');
    });

    it('is carried by the drivers that walk the wizard', async () => {
      await createSession(FOUR, 1, 24, 'desk');

      expect(tierOnScreen()).toBe('desk');
    });

    it('is still there after the app is closed and opened again', async () => {
      const created = await createSession(FOUR, 1, 24, 'desk');
      await created.reload();

      expect(tierOnScreen()).toBe('desk');
    });
  });

  describe('the widths the tiers change at', () => {
    it('is the phone below 768', () => {
      expect(tierAtWidth(390)).toBe('phone');
      expect(tierAtWidth(767)).toBe('phone');
    });

    it('is the widened middle tier from 768 to 1279', () => {
      expect(tierAtWidth(768)).toBe('wide');
      expect(tierAtWidth(1024)).toBe('wide');
      expect(tierAtWidth(1279)).toBe('wide');
    });

    it('is the desk from 1280', () => {
      expect(tierAtWidth(1280)).toBe('desk');
      expect(tierAtWidth(1440)).toBe('desk');
    });
  });

  describe('what the organizer sees', () => {
    it('is the same round at every tier', async () => {
      const phone = await createSession(FOUR);
      const before = phone.text();

      expect(await roundAt('wide', phone)).toBe(before);
      expect(await roundAt('desk', phone)).toBe(before);
    });
  });
});

/**
 * The tier, read off a rendered screen rather than out of the token.
 *
 * The probe is created in whatever injector the harness has just configured, which is what makes
 * this an answer about the app that was launched rather than about a signal a test made.
 */
function tierOnScreen(): string {
  const probe = TestBed.createComponent(TierProbe);
  probe.detectChanges();

  return (probe.nativeElement as HTMLElement).textContent?.trim() ?? '';
}

/** The tier the production implementation picks at one window width. */
function tierAtWidth(width: number): string {
  TestBed.resetTestingModule();
  stubWindowAt(width);
  TestBed.configureTestingModule({ providers: [{ provide: LAYOUT, useClass: BreakpointLayout }] });

  return tierOnScreen();
}

/**
 * A window of exactly this width, as far as a media query can tell.
 *
 * jsdom answers every media query with `false` — it does no layout — so the one thing these tests
 * are about would silently be untestable without this. Only `min-width` is understood, because
 * only `min-width` is asked.
 */
function stubWindowAt(width: number): void {
  window.matchMedia = ((query: string) => {
    const minimum = /min-width:\s*(\d+)px/.exec(query);

    return {
      matches: minimum !== null && width >= Number(minimum[1]),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/**
 * The round the organizer left, reopened at another tier.
 *
 * Reopening rather than resizing, because the session has to be the same session for the two
 * screens to be comparable at all — a second walk through the wizard would generate a schedule
 * from different ids and the two texts would differ for a reason that has nothing to do with
 * width.
 */
async function roundAt(tier: 'wide' | 'desk', opened: AppHarness): Promise<string> {
  const app = await AppHarness.launch({ repository: opened.repository, tier });
  await app.tap('Resume');

  return app.text();
}
