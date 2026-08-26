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
 */
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { assertSessionValid } from 'padel-engine';
import { App } from '../app';
import { InMemorySessionRepository } from '../session/in-memory-session-repository';
import { SESSION_REPOSITORY } from '../session/session-repository';

export class AppHarness {
  private constructor(
    private readonly fixture: ComponentFixture<App>,
    readonly repository: InMemorySessionRepository,
  ) {}

  static async launch(
    repository: InMemorySessionRepository = new InMemorySessionRepository(),
  ): Promise<AppHarness> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SESSION_REPOSITORY, useValue: repository }],
    });

    const fixture = TestBed.createComponent(App);
    const harness = new AppHarness(fixture, repository);
    await harness.settle();

    return harness;
  }

  /** Close the app and open it again: a new injector, the same stored session. */
  async reload(): Promise<AppHarness> {
    this.fixture.destroy();

    return AppHarness.launch(this.repository);
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

  isOnScreen(label: string): boolean {
    return this.controls().some((control) => labelOf(control) === label);
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
    const found = this.roots()
      .flatMap((root) => [...root.querySelectorAll('label')])
      .find((element) => element.textContent?.trim() === label && !isHidden(element));
    if (found === undefined) {
      throw new Error(`No field is labelled "${label}".`);
    }

    return found.htmlFor;
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

/** Whether this element sits inside something the app has taken off the screen. */
function isHidden(element: Element): boolean {
  return element.closest('[hidden]') !== null;
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
  if (element.hasAttribute('hidden')) {
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
