/*
 * Where every focused surface in this app opens, and the one place that says so.
 *
 * It is not decoration, and it is not one answer either. A phone is held in one hand and the tap
 * that matters — the score, the confirmation, the roster change — has to land under the thumb that
 * asked for it (ADR-0014 §1), so below the desk tier a sheet rises from the bottom. That argument
 * is explicitly about a thumb. At 1280px and above there is no thumb, and a surface pinned to the
 * bottom of a laptop window is a conclusion kept past its premise, so there it is a centered
 * dialog instead (ADR-0022 §4).
 *
 * The score sheet, the confirmations, the partner sheet and the roster preview all come through
 * here, and not one of them knows which of the two it got. That is the whole reason this file
 * exists: the four of them said the position identically four times before it did, which is four
 * chances to move one of them and leave the others where they were.
 *
 * A service rather than a function, because the tier arrives from `LAYOUT` and a free function
 * would have to be handed it by every caller — which is the same as every caller knowing that
 * width is involved.
 */
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LAYOUT } from '../layout/layout';

/**
 * The two shapes a sheet is given, as the class the overlay panel wears.
 *
 * The position decides the panel's whole outer form — which corners are round, which edges carry a
 * line, which way the shadow falls, and whether there is a drag handle above the content — and
 * `styles.css` draws both. Naming them here keeps the deciding and the naming in one file.
 */
export const SHEET_PANEL = {
  bottom: 'sheet-at-the-bottom',
  centered: 'sheet-in-the-middle',
} as const;

/** Which of the two a sheet is currently wearing. */
export type SheetPosition = keyof typeof SHEET_PANEL;

@Injectable({ providedIn: 'root' })
export class Sheets {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly tier = inject(LAYOUT).tier;

  /**
   * Open one sheet and wait for whatever it closes with — `undefined` where it was dismissed by
   * the backdrop or by Escape, which every caller has to read as a no.
   */
  open<Result, Data>(sheet: ComponentType<unknown>, data: Data): Promise<Result | undefined> {
    const position = this.positionNow();
    const anchored = this.overlay.position().global().centerHorizontally();

    const opened = this.dialog.open<Result, Data>(sheet, {
      data,
      positionStrategy: position === 'bottom' ? anchored.bottom() : anchored.centerVertically(),
      panelClass: SHEET_PANEL[position],
      width: '100%',
      maxWidth: '28rem',
    });

    return firstValueFrom(opened.closed);
  }

  /**
   * Read once, as the sheet opens, rather than followed while it is up.
   *
   * A window dragged across 1280px with a half-typed score on screen would otherwise have the
   * sheet jump out from under the cursor mid-entry, which is worse than the position being a
   * little stale. Closing and reopening it is what picks up the new tier — and reopening a sheet
   * is one tap.
   */
  private positionNow(): SheetPosition {
    return this.tier() === 'desk' ? 'centered' : 'bottom';
  }
}
