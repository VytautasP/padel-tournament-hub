/*
 * The DOM test seam: the whole app, rendered, driven by typing and tapping.
 *
 * Every test in this project goes through here, and none of them touches a component instance, a
 * signal or a store method. That is a deliberate constraint rather than a style preference — a
 * test that reaches for a component's field is a test of this week's component structure, and the
 * point of these tests is to survive the rewrite of every screen underneath them. What an
 * organizer can see and what they can tap is the contract.
 *
 * Tapping and typing are by visible label, for the same reason: a selector on a class name would
 * pin the markup, and the label is the thing a person actually looks for.
 *
 * "On screen" is taken literally in two directions. A CDK overlay — the score sheet — is attached
 * outside the app's own element, and it is plainly on screen, so the overlay container is searched
 * alongside the app. A tab panel kept in the DOM with `hidden` so it can be returned to unchanged
 * is plainly *not* on screen, so it is skipped. Neither distinction is one an organizer holding a
 * phone could make, which is why the harness has to make both.
 *
 * The repository is the in-memory one (decision #19), and `reload()` is the whole reason it is
 * addressable — closing and reopening the app is a fresh injector reading the same storage.
 *
 * The tier is the other thing an app is launched into (ADR-0022), and it defaults to the phone.
 * That default is load-bearing: it is what lets every spec written before there were tiers go on
 * saying nothing about width, while a spec about the desk says so in one word.
 */
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { assertSessionValid } from 'padel-engine';
import { App } from '../app';
import { routes } from '../app.routes';
import { FixedLayout } from '../layout/fixed-layout';
import { LAYOUT } from '../layout/layout';
import type { Tier } from '../layout/layout';
import type { Identity } from '../session/identity';
import { SCORE_EMPHASIS } from '../round/court-card';
import type { ScoreEmphasis } from '../round/court-card';
import { IDENTITY } from '../session/identity';
import { InMemorySessionRepository } from '../session/in-memory-session-repository';
import { SESSION_REPOSITORY } from '../session/session-repository';
import { CLIPBOARD } from '../share/clipboard';
import { qrEncoder, QR_ENCODER } from '../share/qr-matrix';
import type { QrEncoder } from '../share/qr-matrix';
import { RecordingClipboard } from './recording-clipboard';
import { SHEET_PANEL } from '../sheet/sheets';
import type { SheetPosition } from '../sheet/sheets';

/** What a launch can be told. Everything here has a default, and most launches take all of them. */
export interface LaunchOptions {
  /** Storage to open against — pass one to reopen the app on a session it already holds. */
  readonly repository?: InMemorySessionRepository;
  /** The shape the app is opened in. The phone unless a spec is about something else. */
  readonly tier?: Tier;
  /**
   * Who the app signs in as. The repository itself unless a spec is about not getting that far.
   *
   * The one thing a spec passes here is an identity that *refuses* — a first launch on a device
   * with no network, which is the only way the app can be running and have no owner to read
   * sessions for (ADR-0025 §4).
   */
  readonly identity?: Identity;
  /**
   * The address the app is opened at. The organizer's front door unless a spec says otherwise.
   *
   * The one thing a spec passes here is a spectator's path, because that is the one address this
   * product has (ADR-0026 §1) — built with `spectatorPath` rather than spelled out, so a spec
   * cannot be testing a URL the router no longer answers.
   */
  readonly at?: string;
  /**
   * An encoder for the share sheet's QR. The real one unless a spec is about not getting it.
   *
   * The real library is used by default rather than a stub that returns a fixed grid, because a
   * QR nobody encodes is a picture of a feature. What a spec passes here is an encoder that
   * *fails* — the phone at a court with no signal, which is the one failure this sheet has
   * (ADR-0026 §4).
   */
  readonly qrCode?: QrEncoder;
}

export class AppHarness {
  private constructor(
    private readonly fixture: ComponentFixture<App>,
    readonly repository: InMemorySessionRepository,
    /** What the share sheet copied to, and the only way to ask whether it copied at all. */
    readonly clipboard: RecordingClipboard,
    // Kept only so a reload reopens the app in the shape it was closed in. Nothing reads it as an
    // answer: a spec that wants to know the tier has to find out the way an organizer would.
    private readonly tier: Tier,
    // Kept for the same reason as the tier: reopening the app on a device that still has no
    // signal has to be the same device, or the spec would be reloading its way out of the state
    // it is about.
    private readonly identity: Identity | undefined,
    // And for the same reason again: a browser that cannot fetch the QR encoder is still that
    // browser after the app is closed and opened.
    private readonly qrCode: QrEncoder,
    // And again: reopening the app is reopening it at the address it was opened at, which for a
    // spectator is the whole of where they are.
    private readonly at: string | undefined,
  ) {}

  static async launch({
    repository = new InMemorySessionRepository(),
    tier = 'phone',
    identity,
    qrCode = qrEncoder,
    at,
  }: LaunchOptions = {}): Promise<AppHarness> {
    const clipboard = new RecordingClipboard();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        // The router the app runs on, with the location the browser would otherwise own. A spec
        // navigates rather than rendering a route's component directly, because what is being
        // tested about `/s/:code` includes that the address reaches it at all.
        provideRouter(routes, withComponentInputBinding()),
        provideLocationMocks(),
        { provide: SESSION_REPOSITORY, useValue: repository },
        // The same object behind both tokens, exactly as the running app wires it (ADR-0025 §4):
        // a fake that could store a session without being anybody would be a fake of a store this
        // app does not have.
        { provide: IDENTITY, useValue: identity ?? repository },
        { provide: LAYOUT, useValue: new FixedLayout(tier) },
        { provide: CLIPBOARD, useValue: clipboard },
        { provide: QR_ENCODER, useValue: qrCode },
      ],
    });

    const fixture = TestBed.createComponent(App);
    const harness = new AppHarness(fixture, repository, clipboard, tier, identity, qrCode, at);
    // The outlet has to exist before there is anywhere for a route to be rendered, which is why
    // this navigates after the first render rather than before it.
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl(at ?? '/');
    await harness.settle();

    return harness;
  }

  /**
   * Close the app and open it again: a new injector, the same stored session, the same tier — and
   * the same identity, so a device that could not sign in is still that device.
   */
  async reload(): Promise<AppHarness> {
    this.fixture.destroy();

    return AppHarness.launch({
      repository: this.repository,
      tier: this.tier,
      identity: this.identity,
      qrCode: this.qrCode,
      at: this.at,
    });
  }

  /**
   * Let this app catch up with something that changed outside it.
   *
   * Every other way of moving this app forward is a tap or a keystroke, which settles on the way
   * out. A spectator's app is moved by neither: what changes it is the organizer's app writing to
   * the repository they share, and the only thing a spec can do about that is wait for the
   * listener to land (ADR-0026 §2).
   */
  async catchUp(): Promise<void> {
    await this.settle();
  }

  /** Everything the organizer can read on screen right now, whitespace-normalised. */
  text(): string {
    return this.roots().map(visibleText).join(' ').replace(/\s+/g, ' ').trim();
  }

  shows(fragment: string): boolean {
    return this.text().includes(fragment);
  }

  async tap(label: string): Promise<void> {
    const control = this.control(label);
    if (control.disabled) {
      throw new Error(`"${label}" is on screen but disabled.`);
    }

    control.click();
    await this.settle();
  }

  /** Whether a control with this label is on screen and can be used. */
  canTap(label: string): boolean {
    return this.controls().some((control) => labelOf(control) === label && !control.disabled);
  }

  /**
   * Whether a two-state control is currently the chosen one — `aria-pressed`, which is exactly
   * what a screen reader announces and what the colour on the pill means to everyone else.
   *
   * A toggle with no default has to be shown holding neither answer, and there is no other way to
   * ask: an unpressed pill and a pressed one are the same words in the same place.
   */
  isPressed(label: string): boolean {
    return this.control(label).getAttribute('aria-pressed') === 'true';
  }

  /**
   * Whether a picture carrying this accessible name is on screen.
   *
   * The QR is the app's only graphic that says something — it is a link drawn as squares — and
   * there is nothing in it to read as text. `role="img"` and a name is what a screen reader is
   * given, so it is what this seam asks for too.
   */
  hasImage(label: string): boolean {
    return this.roots()
      .flatMap((root) => [...root.querySelectorAll('[role="img"]')])
      .some((image) => image.getAttribute('aria-label') === label && !isHidden(image));
  }

  isOnScreen(label: string): boolean {
    return this.controls().some((control) => labelOf(control) === label);
  }

  /**
   * Whether a field carrying this visible label is on screen.
   *
   * `isOnScreen` answers for controls, and a field is not one. Reading a field that is absent is
   * an error rather than an answer, which is right for `textIn` and useless for a test whose whole
   * subject is a field appearing and disappearing.
   */
  hasField(label: string): boolean {
    return this.labelFor(label) !== undefined;
  }

  /** Type into the field carrying this placeholder, as a person does: keystrokes, then look. */
  async type(placeholder: string, value: string): Promise<void> {
    const field = this.field(`[placeholder="${cssEscape(placeholder)}"]`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await this.settle();
  }

  /** Set the number field belonging to this visible label. */
  async setNumber(label: string, value: number): Promise<void> {
    await this.typeInto(label, String(value));
  }

  /**
   * Type into the field belonging to this visible label — anything at all, digits or not.
   *
   * `setNumber` cannot express what a thumb does to a numeric field on a phone keyboard that also
   * carries a minus sign, and a field that says it takes digits only has to be shown refusing
   * something that is not one.
   */
  async typeInto(label: string, value: string): Promise<void> {
    const field = this.field(`#${this.labelledFieldId(label)}`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await this.settle();
  }

  /** The value the organizer can see in the number field belonging to this label. */
  numberIn(label: string): number {
    return Number(this.textIn(label));
  }

  /** The characters standing in the field belonging to this label, exactly as they are. */
  textIn(label: string): string {
    return this.field(`#${this.labelledFieldId(label)}`).value;
  }

  /** Whether the field the organizer types names into is the one the browser would type into. */
  fieldHasFocus(placeholder: string): boolean {
    return (
      this.appRoot().ownerDocument.activeElement ===
      this.field(`[placeholder="${cssEscape(placeholder)}"]`)
    );
  }

  valueIn(placeholder: string): string {
    return this.field(`[placeholder="${cssEscape(placeholder)}"]`).value;
  }

  /**
   * The referee, run over whatever the repository is holding (decision #21).
   *
   * Any test that creates or changes a session ends here: the invariants live in one place, and
   * a screen that produced a session the engine would refuse is a bug in the screen no matter
   * how good the rendered text looked.
   */
  expectStoredSessionValid(): void {
    const record = this.repository.activeRecord();
    if (record === null) {
      throw new Error('The repository holds no session to validate.');
    }

    assertSessionValid(record.session);
  }

  /**
   * The same referee, run over the evening most recently ended.
   *
   * Ending empties the active slot, so `expectStoredSessionValid` has nothing to look at from the
   * moment the session becomes worth checking. Freezing a document is exactly the kind of change
   * that could quietly damage it, which is why the check follows it into history rather than
   * stopping at the door.
   */
  expectEndedSessionValid(): void {
    const [record] = this.repository.historyRecords();
    if (record === undefined) {
      throw new Error('The repository holds no ended session to validate.');
    }

    assertSessionValid(record.session);
  }

  /**
   * How each number on screen reading exactly `points` is set: pointed at, muted, or neither.
   *
   * The other thing about this app a spec cannot read as words. A court card says who won by
   * setting the winner's number in brand and muting the loser's, and a draw by muting neither —
   * three treatments that render the same characters. So the treatment is read off the class the
   * card gave the number, named by the constant that file exports rather than spelled out again
   * here, exactly as `sheetPosition` reads a sheet's anchor.
   *
   * A list rather than one answer, because a draw is two numbers that are the same and the whole
   * assertion is that both of them are set the same way. Anything on screen carrying those
   * characters and none of the treatments is not a score, and is passed over rather than guessed
   * about.
   */
  scoreEmphasis(points: number): ScoreEmphasis[] {
    const treatments = Object.entries(SCORE_EMPHASIS) as [ScoreEmphasis, string][];

    return this.roots()
      .flatMap((root) => [...root.querySelectorAll<HTMLElement>('*')])
      .filter((element) => visibleText(element).trim() === String(points) && !isHidden(element))
      .flatMap((element) =>
        treatments
          .filter(([, classes]) =>
            classes.split(' ').every((name) => element.classList.contains(name)),
          )
          .map(([treatment]) => treatment),
      );
  }

  /**
   * Where the focused surface currently on screen is anchored.
   *
   * The one thing about a sheet a spec cannot read as words. Everything else here goes through
   * labels and rendered text, and position deliberately does not have any — a bottom sheet and a
   * centered dialog say the same sentences, which is the point of ADR-0022 §4. So it is read off
   * the class `Sheets` gave the overlay panel, named by the constant that file exports rather than
   * spelled out again here.
   *
   * jsdom does no layout, so there is nothing else to read: the panel's own geometry is zero at
   * every width.
   */
  sheetPosition(): SheetPosition {
    const positions = Object.entries(SHEET_PANEL) as [SheetPosition, string][];
    const found = this.roots()
      .flatMap((root) => [...root.querySelectorAll('.cdk-overlay-pane')])
      .flatMap((panel) =>
        positions.filter(([, panelClass]) => panel.classList.contains(panelClass)),
      )
      .map(([position]) => position);

    if (found.length === 0) {
      throw new Error('No sheet is on screen.');
    }
    if (found.length > 1) {
      throw new Error(`${found.length} sheets are on screen at once.`);
    }

    return found[0];
  }

  private appRoot(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  /** Everywhere the app has put something on screen: its own element, and any CDK overlay. */
  private roots(): HTMLElement[] {
    const overlays = [
      ...this.appRoot().ownerDocument.querySelectorAll<HTMLElement>('.cdk-overlay-container'),
    ];

    return [this.appRoot(), ...overlays];
  }

  private controls(): HTMLButtonElement[] {
    return this.roots()
      .flatMap((root) => [...root.querySelectorAll('button')])
      .filter((control) => !isHidden(control));
  }

  private control(label: string): HTMLButtonElement {
    const found = this.controls().filter((control) => labelOf(control) === label);
    if (found.length === 0) {
      throw new Error(
        `No control labelled "${label}". On screen: ${this.controls().map(labelOf).join(', ')}`,
      );
    }
    if (found.length > 1) {
      throw new Error(`${found.length} controls are labelled "${label}".`);
    }

    return found[0];
  }

  private field(selector: string): HTMLInputElement {
    for (const root of this.roots()) {
      const field = root.querySelector<HTMLInputElement>(selector);
      if (field !== null && !isHidden(field)) {
        return field;
      }
    }

    throw new Error(`No field matching ${selector} is on screen.`);
  }

  private labelledFieldId(label: string): string {
    const found = this.labelFor(label);
    if (found === undefined) {
      throw new Error(`No field is labelled "${label}".`);
    }

    return found.htmlFor;
  }

  private labelFor(label: string): HTMLLabelElement | undefined {
    return this.roots()
      .flatMap((root) => [...root.querySelectorAll('label')])
      .find((element) => element.textContent?.trim() === label && !isHidden(element));
  }

  private async settle(): Promise<void> {
    await this.fixture.whenStable();
    this.fixture.detectChanges();
    await this.fixture.whenStable();
  }
}

/**
 * A control's accessible name — what a screen reader would announce, which is `aria-label` where
 * one is given and the control's own words otherwise.
 *
 * Taking the same answer the browser takes is what lets a card with a paragraph of explanation on
 * it still be tapped by the one word it is actually called.
 */
function labelOf(control: HTMLButtonElement): string {
  const labelled = control.getAttribute('aria-label');

  return labelled ?? visibleText(control).replace(/\s+/g, ' ').trim();
}

/**
 * Whether this element sits inside something the app has taken off the screen.
 *
 * Two ways that happens, and the app uses both. A tab panel kept in the DOM so it can be returned
 * to unchanged is `hidden`. Everything behind an open sheet is `aria-hidden` — CDK marks the rest
 * of the document while a dialog is up — and that is exactly as off screen: a confirmation naming
 * what it is about to do sits over the button that opened it, and only one of the two is a thing
 * the organizer can read or reach.
 */
function isHidden(element: Element): boolean {
  return element.closest('[hidden], [aria-hidden="true"]') !== null;
}

/**
 * The text of everything under `element` that is not inside a hidden subtree, with each element's
 * words separated from its siblings'.
 *
 * The separator is not decoration. Angular strips whitespace-only text nodes out of a template, so
 * three spans holding a position, a name and a rate concatenate to `1Ana17.0` in the DOM while
 * rendering as three columns with a gap between them. Reading them back without a separator would
 * make every test assert a string nobody can see.
 */
function visibleText(element: Element): string {
  if (isHidden(element)) {
    return '';
  }

  let text = '';
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? '';
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      text += ` ${visibleText(child as Element)} `;
    }
  }

  return text;
}

function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}
