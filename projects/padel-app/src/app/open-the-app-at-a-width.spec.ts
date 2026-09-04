/*
 * Which of the three shapes the app is in, and what a test can say about it (ADR-0022).
 *
 * This is the seam rather than anything an organizer can see: no screen looks different at any
 * tier yet, and the last test here asserts that as hard as the others assert the tier itself. The
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
 * 768 and 1280 are the two numbers in this whole arrangement that a fake cannot vouch for — and
 * so is the resize, because an organizer who drags a laptop window across 1280 is the only reason
 * the tier is an observable rather than a number read once.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { BreakpointLayout } from './layout/breakpoint-layout';
import { LAYOUT } from './layout/layout';
import type { Tier } from './layout/layout';
import type { InMemorySessionRepository } from './session/in-memory-session-repository';
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

describe('opening the app at a width', () => {
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    stubbedQueries.length = 0;
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

    it('follows a window that is dragged across both breakpoints', async () => {
      const probe = openProbeAtWidth(390);
      expect(tierIn(probe)).toBe('phone');

      expect(await tierAfterResizingTo(probe, 1280)).toBe('desk');
      expect(await tierAfterResizingTo(probe, 900)).toBe('wide');
      expect(await tierAfterResizingTo(probe, 500)).toBe('phone');
    });
  });

  describe('what the organizer sees', () => {
    it('is the same at every tier, word for word', async () => {
      const created = await createSession(FOUR);
      const phone = await screensAt('phone', created.repository);

      expect(await screensAt('wide', created.repository)).toEqual(phone);
      expect(await screensAt('desk', created.repository)).toEqual(phone);
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
  return tierIn(TestBed.createComponent(TierProbe));
}

function tierIn(probe: ComponentFixture<TierProbe>): string {
  probe.detectChanges();

  return (probe.nativeElement as HTMLElement).textContent?.trim() ?? '';
}

/** The tier the production implementation picks at one window width. */
function tierAtWidth(width: number): string {
  return tierIn(openProbeAtWidth(width));
}

/** A probe wired to the production implementation, watching a window of exactly this width. */
function openProbeAtWidth(width: number): ComponentFixture<TierProbe> {
  TestBed.resetTestingModule();
  stubWindowAt(width);
  TestBed.configureTestingModule({ providers: [{ provide: LAYOUT, useClass: BreakpointLayout }] });

  return TestBed.createComponent(TierProbe);
}

/**
 * Drag the window to a new width and let the answer arrive.
 *
 * CDK debounces every match after the first one by a tick, so a resize is only visible on the
 * other side of the task queue — which is exactly why the read has to wait rather than assert
 * straight away.
 */
async function tierAfterResizingTo(
  probe: ComponentFixture<TierProbe>,
  width: number,
): Promise<string> {
  resizeTo(width);
  await new Promise((settled) => setTimeout(settled, 0));

  return tierIn(probe);
}

/** What one media query the app is watching currently answers, and who is listening to it. */
interface StubbedQuery {
  readonly from: number;
  readonly list: { matches: boolean };
  readonly listeners: ((event: { matches: boolean }) => void)[];
}

const stubbedQueries: StubbedQuery[] = [];

/**
 * A window of exactly this width, as far as a media query can tell.
 *
 * jsdom answers every media query with `false` — it does no layout — so the one thing these tests
 * are about would silently be untestable without this. Only `min-width` is understood, because
 * only `min-width` is asked.
 */
function stubWindowAt(width: number): void {
  stubbedQueries.length = 0;
  window.matchMedia = ((query: string) => {
    const from = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? Number.NaN);
    const listeners: StubbedQuery['listeners'] = [];
    const list = {
      matches: width >= from,
      media: query,
      onchange: null,
      addListener: (listener: StubbedQuery['listeners'][number]) => listeners.push(listener),
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    };
    stubbedQueries.push({ from, list, listeners });

    return list as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/** Answer every query the app is watching as a window of this width would, and say so. */
function resizeTo(width: number): void {
  for (const query of stubbedQueries) {
    query.list.matches = width >= query.from;
    for (const listener of query.listeners) {
      listener({ matches: query.list.matches });
    }
  }
}

/** Every word of one stored session, screen by screen, at one tier. */
async function screensAt(tier: Tier, repository: InMemorySessionRepository) {
  const app = await AppHarness.launch({ repository, tier });
  const landing = app.text();

  await app.tap('Resume');
  const round = app.text();

  await app.tap('Standings');
  const standings = app.text();

  await app.tap('Players');
  const players = app.text();

  return { landing, round, standings, players };
}
