/*
 * Naming the player who repairs an orphaned team (decision #2b, ADR-0012).
 *
 * The ticket calls this a picker of players not already on a team, and that is exactly what it
 * is — the list is just always empty. Every player on the roster plays for a team, because the
 * engine refuses a session where anybody does not (`session-shape.ts`), so the only partner a
 * stranded half can be given is somebody the evening has not met yet. Typing the name is picking
 * from the one set of people who can be picked, and an impossible pairing is unconstructible here
 * rather than merely refused: there is no control on this sheet that could name a player who
 * already has a partner.
 *
 * It is a sheet rather than a field on the row for the same reason going home is behind an
 * overflow: the Players tab already has one field at the bottom of the list, for a late arrival to
 * the evening, and a second one appearing inside a row would be two ways to type a name with
 * different consequences a thumb apart.
 *
 * Nothing is written here. The name comes back to the row, which plans the repair and shows the
 * regenerated schedule before any of it commits (ADR-0015).
 */
import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { copy } from '../copy/copy';
import { openBottomSheet } from '../sheet/bottom-sheet';

/** The team being repaired, as the organizer reads it: `Ana & Ben`. */
export interface PartnerData {
  readonly team: string;
}

@Component({
  selector: 'app-partner-sheet',
  templateUrl: './partner-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerSheet {
  protected readonly data = inject<PartnerData>(DIALOG_DATA);

  private readonly sheetRef = inject<DialogRef<string>>(DialogRef);

  protected readonly copy = copy;
  protected readonly typed = signal('');

  protected onType(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  /**
   * Hand the name back, or do nothing at all while the field is empty.
   *
   * A blank submission is not a refusal — there is simply nobody named yet — which is how the
   * same keystroke is read everywhere else a name is typed in this app.
   */
  protected commit(): void {
    const name = this.typed().trim();
    if (name === '') {
      return;
    }

    this.sheetRef.close(name);
  }

  protected dismiss(): void {
    this.sheetRef.close();
  }
}

/** Asking for the name, from the row that is flagged `needs partner`. */
@Injectable({ providedIn: 'root' })
export class Partner {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  /** The name the organizer gave, or `null` if they left the sheet any other way. */
  async named(team: string): Promise<string | null> {
    const name = await openBottomSheet<string, PartnerData>(
      this.dialog,
      this.overlay,
      PartnerSheet,
      { team },
    );

    return name ?? null;
  }
}
