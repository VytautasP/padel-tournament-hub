/*
 * The whole of what a share code opens: `/s/:code`, watched live, and read-only (ADR-0026).
 *
 * This is the one surface in the product that is a *place*. It has an address somebody else holds,
 * it is arrived at by scanning a square at the side of a court, and it can be reloaded into — all
 * of which are things ADR-0019 said were false of every screen the organizer uses, and still are.
 *
 * The one thing on it that can be tapped is the language toggle, which is the whole of a
 * spectator's settings (ADR-0032 §6): it changes nothing about the evening and everything about
 * whether the person holding the phone can read it. It is on both branches below, because the
 * screen most likely to be unreadable is the one whose entire content is a single sentence.
 *
 * Three things it deliberately does not do:
 *
 *   - **It does not sign in.** A spectator has no identity here (ADR-0026 §3) and needs none: the
 *     rules allow a `get` of one session document to anybody holding its id, which is what makes
 *     the code the credential (ADR-0024 §3). Minting an anonymous account for everybody who
 *     watches an evening would be a pile of users this product has no use for.
 *   - **It does not touch `SessionStore`.** The store is the organizer's — it signs in, it reads
 *     their sessions, it calls the engine's operations. Nothing on this route can write, and the
 *     honest way to say that is to hold nothing that could.
 *   - **It does not show a spinner.** The app renders nothing until it knows something, exactly as
 *     the organizer's shell does until its restore settles: a share code resolves in a moment, and
 *     the alternative is a screen that flashes.
 *
 * A code with no session behind it is the evening being gone. That is decision #10's hard delete
 * seen from the other end, and it is what the acceptance criterion asks for: not a permission
 * error, not an empty round card, but a sentence saying the evening is not there any more. A code
 * that never existed reads the same, because from here the two are indistinguishable and neither
 * is anything the person holding the phone can fix.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { copy } from '../copy/copy';
import { SESSION_REPOSITORY } from '../session/session-repository';
import type { SessionRecord } from '../session/session-record';
import { LanguageToggle } from './language-toggle';
import { SpectatorShell } from './spectator-shell';

@Component({
  selector: 'app-spectator-page',
  imports: [LanguageToggle, SpectatorShell],
  templateUrl: './spectator-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpectatorPage {
  /** The share code out of the URL, bound by the router (`withComponentInputBinding()`). */
  readonly code = input.required<string>();

  private readonly repository = inject(SESSION_REPOSITORY);

  /**
   * What is known about the evening at this code: the record, `null` for gone, `undefined` for
   * not yet answered.
   *
   * Three states rather than two, because "no session" and "no answer yet" are different things to
   * say and only one of them is true of a phone that has just opened the page.
   */
  private readonly held = signal<SessionRecord | null | undefined>(undefined);

  protected readonly copy = copy;
  protected readonly record = computed(() => this.held() ?? null);

  /** Whether the code has been answered and the answer was that there is no such evening. */
  protected readonly gone = computed(() => this.held() === null);

  constructor() {
    /*
     * One listener, for as long as this page is on screen and the code is this code (ADR-0025 §3).
     *
     * An effect rather than a call in the constructor, because the code is an input and a routed
     * input can change under a component the router keeps: `/s/A` to `/s/B` reuses this page, and
     * the cleanup is what stops the old evening reporting into the new one.
     */
    effect((onCleanup) => {
      const code = this.code();
      // Back to knowing nothing before the new code is asked. Without this, `/s/A` becoming
      // `/s/B` would go on rendering A's round until B answered — one share code showing another
      // evening, which is the one thing an unlisted address must never do.
      this.held.set(undefined);
      onCleanup(this.repository.watch(code, (record) => this.held.set(record)));
    });
  }
}
