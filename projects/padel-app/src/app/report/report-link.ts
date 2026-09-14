/*
 * The one thing about the report that is on a screen: a line under the standings table that turns
 * the evening into a file (ADR-0038 §1).
 *
 * A component of its own for the reason `QrCode` is one. The screens around it know what evening
 * they are showing; this knows that producing a document means fetching a library, that the fetch
 * can fail, and that a failure is a sentence rather than a control that does nothing. Two concerns
 * that fail in different ways, so they are two files.
 *
 * It is *not* inside `StandingsTable`. That component is the shared data rendering — the same rows
 * on the organizer's tab and the spectator's shell (ADR-0026 §2) — and a control living inside it
 * would be the first thing on that table either reader could act on. The two screens place this
 * themselves, under the card, and both of them do it only when the evening has ended.
 *
 * The load runs through `PendingTasks` for the reason the QR's does: without it the app is
 * "stable" the moment the link is tapped, and a spec would be racing a promise it cannot see.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  PendingTasks,
  signal,
} from '@angular/core';
import { buildReport } from './report-document';
import { BUILD_RELOAD } from '../share/build-reload';
import { copy } from '../copy/copy';
import { download, reportFilename } from './report-file';
import { PDF_MAKER } from './pdf-maker';
import type { SessionRecord } from '../session/session-record';
import type { StandingRow } from '../standings/standing-row';

@Component({
  selector: 'app-report-link',
  templateUrl: './report-link.html',
  /*
   * The host is the column its two children are laid out in, rather than `contents` like the
   * table's. This component *is* a block on the screen — a line and, where the library did not
   * arrive, a sentence under it — so the box it needs is its own and not the screen's.
   */
  host: { class: 'flex flex-col items-start gap-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportLink {
  /** The evening to write out. Only ever an ended one — both callers check before rendering this. */
  readonly record = input.required<SessionRecord>();
  /** The same rows the table above is rendering, so the two cannot disagree (ADR-0038 §5). */
  readonly standings = input.required<readonly StandingRow[]>();

  private readonly make = inject(PDF_MAKER);
  private readonly reload = inject(BUILD_RELOAD);
  private readonly tasks = inject(PendingTasks);
  private readonly failed = signal(false);

  /** Held so a second tap while the first is still fetching does not build the document twice. */
  private readonly building = signal(false);

  /** Whether a report has been downloaded, which is when the escape below becomes worth saying. */
  private readonly delivered = signal(false);

  protected readonly copy = copy;
  protected readonly unavailable = this.failed.asReadonly();
  protected readonly busy = this.building.asReadonly();

  /**
   * Whether to show the way out (ADR-0040 §2).
   *
   * Only after a download has been attempted, and then on every browser — there is no condition to
   * put on it, because the browsers that swallow a download are indistinguishable from here. Before
   * the first tap it is `false` everywhere, so the screen is the one line ADR-0038 §1 asked for
   * until the moment the sentence could mean something to somebody.
   */
  protected readonly stuck = this.delivered.asReadonly();

  protected save(): void {
    if (this.building()) {
      return;
    }

    this.building.set(true);
    void this.tasks.run(() => this.write());
  }

  private async write(): Promise<void> {
    let report: Blob;

    try {
      report = await this.make(buildReport(this.record(), this.standings(), copy));
    } catch {
      /*
       * The library did not arrive, and there are two ways that happens: a court with no signal,
       * or a tab that has been open across a deploy asking for a chunk that no longer has that
       * name (ADR-0030). Only the first is the sentence below, and only `BuildReload` can tell
       * them apart; where it reloads, this component is about to stop existing and says nothing.
       */
      this.building.set(false);
      if (!this.reload.attempt()) {
        this.failed.set(true);
      }

      return;
    }

    this.failed.set(false);
    this.building.set(false);

    /*
     * Unguarded, because there is one failure mode here and it is the one above. The download
     * cannot reject — it is a detached anchor clicking itself (ADR-0039) — and it reports nothing
     * either way. A browser that quietly discards the file looks from here exactly like one that
     * saved it, and no second attempt would land anywhere better (ADR-0040 §1). So what is recorded
     * is only that the attempt happened, which is what entitles the screen to say the sentence.
     */
    download(report, reportFilename(this.record()));
    this.delivered.set(true);
  }
}
