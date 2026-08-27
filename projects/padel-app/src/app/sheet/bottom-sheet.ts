/*
 * Every sheet in this app opens at the bottom of the screen, and this is the one place that says
 * so.
 *
 * It is not decoration. A phone is held in one hand and the tap that matters — the score, the
 * confirmation, the roster change — has to land under the thumb that asked for it (ADR-0014 §1). A
 * dialog in the middle of the screen puts the dismissal where the thumb already is, which is the
 * wrong way round for every one of them.
 *
 * The three sheets said it identically three times before this existed, which is three chances to
 * fix a position on one of them and leave the others where they were.
 */
import type { Dialog } from '@angular/cdk/dialog';
import type { Overlay } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import { firstValueFrom } from 'rxjs';

/**
 * Open one sheet and wait for whatever it closes with — `undefined` where it was dismissed by the
 * backdrop or by Escape, which every caller has to read as a no.
 */
export function openBottomSheet<Result, Data>(
  dialog: Dialog,
  overlay: Overlay,
  sheet: ComponentType<unknown>,
  data: Data,
): Promise<Result | undefined> {
  const opened = dialog.open<Result, Data>(sheet, {
    data,
    positionStrategy: overlay.position().global().bottom().centerHorizontally(),
    width: '100%',
    maxWidth: '28rem',
  });

  return firstValueFrom(opened.closed);
}
