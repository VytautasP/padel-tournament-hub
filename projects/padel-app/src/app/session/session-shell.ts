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
import { LAYOUT } from '../layout/layout';
import { PlayersTab } from '../players/players-tab';
import { RoundTab } from '../round/round-tab';
import { SessionStore } from './session-store';
import { Share } from '../share/share-sheet';
import { StandingsTab } from '../standings/standings-tab';

/**
 * The three panels this shell holds. Not the same list as the destinations: at the desk the
 * standings are a panel nobody navigates to, which is the whole of ADR-0022 §2.
 */
type Panel = 'round' | 'standings' | 'players';

/** One place the navigation offers: what it is called, and the panel it shows. */
interface Destination {
  readonly id: Panel;
  readonly label: string;
}

const ROUND: Destination = { id: 'round', label: copy.session.round };
const STANDINGS: Destination = { id: 'standings', label: copy.session.standings };
const PLAYERS: Destination = { id: 'players', label: copy.session.players };

@Component({
  selector: 'app-session-shell',
  imports: [PlayersTab, RoundTab, StandingsTab],
  templateUrl: './session-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionShell {
  private readonly store = inject(SessionStore);
  private readonly sharing = inject(Share);
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

  /**
   * The destinations there are, which is the whole of what the two shapes differ by.
   *
   * The bar has three and the rail has two. Written as one derivation rather than as two lists in
   * the template, because "Standings is not a destination at the desk" is a single fact and a
   * template that stated it twice could come to state it inconsistently.
   */
  protected readonly destinations = computed<readonly Destination[]>(() =>
    this.atDesk() ? [ROUND, PLAYERS] : [ROUND, STANDINGS, PLAYERS],
  );

  /**
   * The panel actually on screen, derived rather than clamped on the way in.
   *
   * An organizer standing on the Standings tab who drags the window past 1280 has just lost the
   * destination they were on. The table is not gone — it is in the aside beside them — so the
   * main area falls back to the round rather than to a panel with no way back to it.
   */
  protected readonly current = computed<Panel>(() => {
    const asked = this.requested();

    return this.atDesk() && asked === 'standings' ? 'round' : asked;
  });

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
  protected async share(): Promise<void> {
    const session = this.store.openSession();

    if (session !== null) {
      await this.sharing.open(session.id);
    }
  }
}
