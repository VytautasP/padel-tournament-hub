/*
 * The running session: the destinations there are, and the two shapes they come in (ADR-0016,
 * amended by ADR-0022 §2).
 *
 * Below 1280px it is what ADR-0016 drew: three tabs — Round, Standings, Players — in a bar under
 * the thumb, with Round the default because that is the posture the app is used in, standing at
 * the side of a court being asked things.
 *
 * At 1280 and above the shell is a 248px rail, the courts two-up, and standings in a 340px aside
 * that never leaves. **The rail carries two destinations, not three.** Once the table is
 * permanently on screen a Standings item would change nothing when it was tapped, which is a
 * defect found within a minute; what ADR-0016 §1 was actually claiming — the table never more than
 * one move away — is honoured harder by an aside than by a tab, because it stops being a move away
 * at all.
 *
 * **The aside is not the Round view's.** It is on screen from Players too, and that is the point
 * rather than a convenience: deciding whether to let somebody go home is a question about how the
 * evening is going, and Standings is no longer somewhere the organizer can go and ask.
 *
 * Exactly one navigation exists at a time, and that is a correctness requirement rather than a
 * preference (ADR-0022 §5). The DOM test seam drives this app by visible label; a rail and a
 * bottom bar rendered together would put two buttons labelled `Round` on screen and every spec
 * that taps one would throw. So the restructuring reads the tier from `LAYOUT` and `@if`s one of
 * them into existence — never CSS, which the seam cannot see.
 *
 * Both panels stay in the DOM and the inactive one is hidden, rather than being switched out and
 * rebuilt. That is what "state and scroll position survive switching" costs, and the scroll half
 * needs the second half of the arrangement: each panel is its own scroll container, so each keeps
 * a scroll offset of its own. One scroller shared between them would hand the standings the
 * round's offset and lose both.
 *
 * The rail, the bar and the list of destinations are their own files, because the spectator's
 * shell wears the same two arrangements around the same three panels (ADR-0026 §2). What is left
 * here is what only an organizer's session has: the share control, the gear beside it, the door
 * out of an ended one, and the three tabs rather than the three boards underneath them.
 *
 * **The header carries two controls that open something and one that leaves** (ADR-0031 §2,
 * amending ADR-0026 §4's "one piece of chrome"). Share and settings are paired on the left; Done
 * has the right edge alone, so it is not read as a third thing that opens. The gear is on screen
 * during a round, which is chrome competing with the game, and it earns that by being the only
 * way to fix a screen that is unreadable in the light the organizer is actually standing in — a
 * problem you have *while* playing rather than before.
 *
 * **An ended session has a door, and only an ended session.** ADR-0016's "no back button" is a rule
 * about an evening in progress: leaving one is ending it or discarding it, and both of those are
 * elsewhere on purpose. A finished session is not an evening being run — it is a record being
 * read, whether the organizer closed it a second ago or opened it out of history a week later —
 * and a record has to be closable or the landing page is unreachable.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { copy } from '../copy/copy';
import { destinationsAt, panelAt } from './destinations';
import type { Panel } from './destinations';
import { LAYOUT } from '../layout/layout';
import { PlayersTab } from '../players/players-tab';
import { RoundTab } from '../round/round-tab';
import { SessionRail } from './session-rail';
import { SessionStore } from './session-store';
import { Settings } from '../settings/settings-sheet';
import { Share } from '../share/share-sheet';
import { StandingsTab } from '../standings/standings-tab';
import { TabBar } from './tab-bar';

@Component({
  selector: 'app-session-shell',
  imports: [PlayersTab, RoundTab, SessionRail, StandingsTab, TabBar],
  templateUrl: './session-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionShell {
  private readonly store = inject(SessionStore);
  private readonly sharing = inject(Share);
  private readonly settings = inject(Settings);
  private readonly tier = inject(LAYOUT).tier;

  /** The destination the organizer asked for. Held here; what is shown is `current`. */
  private readonly requested = signal<Panel>('round');

  /** Emitted when the organizer closes a finished session. Nothing else leaves this screen. */
  readonly left = output<void>();

  protected readonly copy = copy;

  /** Whether this session has ended, which is the only condition under which there is a way out. */
  protected readonly ended = this.store.ended;

  /** Whether the shell is wearing the rail and the aside rather than the bottom bar. */
  protected readonly atDesk = computed(() => this.tier() === 'desk');

  /** The destinations there are at this tier, which is the whole of what the two shapes differ by. */
  protected readonly destinations = computed(() => destinationsAt(this.atDesk()));

  /** The panel actually on screen, which is not always the one that was asked for. */
  protected readonly current = computed(() => panelAt(this.atDesk(), this.requested()));

  /** Which evening this rail belongs to: the line under the app's name. */
  protected readonly summary = computed(() => {
    const session = this.store.openSession();

    return session === null ? '' : copy.session.summary(session.mode, session.roster.length);
  });

  protected show(panel: Panel): void {
    this.requested.set(panel);
  }

  /**
   * Open the share sheet on the session in front of the organizer.
   *
   * The code it shares is the session's id, because those are one value (ADR-0024 §1) — there is
   * no share code field to read and nothing to derive. The header is only rendered inside a
   * session, so the null branch is the impossible one and does nothing rather than inventing a
   * state for it.
   */
  /**
   * Open the settings sheet, which is the landing page's sheet and not a second one.
   *
   * Nothing about it is a session's, so there is nothing to hand it — which is exactly why the
   * two headers can share one component rather than each growing a variant of it.
   */
  protected async openSettings(): Promise<void> {
    await this.settings.open();
  }

  protected async share(): Promise<void> {
    const session = this.store.openSession();

    if (session !== null) {
      await this.sharing.open(session.id);
    }
  }
}
