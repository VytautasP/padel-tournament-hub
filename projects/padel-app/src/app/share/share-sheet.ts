/*
 * How a share code gets from the organizer's phone onto everybody else's (ADR-0026 §4).
 *
 * Three answers to one question, because the question is asked in three situations. A camera in a
 * hand scans the QR. A phone across the net with a cracked lens is told ten characters out loud,
 * which is what ADR-0024's Crockford alphabet is for — no I, L, O or U, so a code read across a
 * court cannot come back ambiguous. And a group that talks in a chat app gets the link pasted into
 * it. None of the three is a fallback for the others: they are the three ways this actually
 * happens.
 *
 * It is a persistent control in the header rather than a screen at the end of the wizard, and that
 * is ADR-0026's amendment to ADR-0016 rather than an oversight of it. The wizard's last step is a
 * better moment and it happens once; people arrive late, phones lock, and somebody asks again in
 * round four.
 *
 * Nothing leaves the device to make any of this. The code is the credential (ADR-0024 §4), so the
 * QR is encoded here and a hosted QR image API is disqualified rather than merely unnecessary.
 */
import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { CLIPBOARD } from './clipboard';
import { copy } from '../copy/copy';
import { QrCode } from './qr-code';
import { shareLink } from './share-link';
import { Sheets } from '../sheet/sheets';

/** What is being shared: the code a human reads, and the link a camera and a clipboard carry. */
export interface ShareData {
  readonly code: string;
  readonly link: string;
}

/** What came of the last tap on copy — nothing yet, the link copied, or a browser that refused. */
type Copying = 'untried' | 'copied' | 'refused';

@Component({
  selector: 'app-share-sheet',
  imports: [QrCode],
  templateUrl: './share-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareSheet {
  protected readonly data = inject<ShareData>(DIALOG_DATA);

  private readonly clipboard = inject(CLIPBOARD);
  private readonly sheetRef = inject<DialogRef<void>>(DialogRef);
  private readonly copying = signal<Copying>('untried');

  protected readonly copy = copy;
  protected readonly copied = this.copying.asReadonly();

  /**
   * Copy the link, and say which of the two things happened.
   *
   * The answer is the clipboard's rather than the sheet's optimism. A browser can refuse the
   * permission and an insecure origin has no clipboard at all, and a sheet that said "copied"
   * regardless would be lying at the exact moment somebody pastes nothing into a group chat.
   */
  protected async copyLink(): Promise<void> {
    const written = await this.clipboard.write(this.data.link);

    this.copying.set(written ? 'copied' : 'refused');
  }

  protected close(): void {
    this.sheetRef.close();
  }
}

/**
 * Opening the sheet, from the one control in the session header.
 *
 * A service for the same reason `Confirm` is one: the header offers sharing, and knowing how a
 * focused surface is opened is not part of offering it. This is also the only thing in the app
 * that needs the origin it is being served from — the code is the session's id and the link is
 * that id at an address — so the document is read here and nowhere else.
 */
@Injectable({ providedIn: 'root' })
export class Share {
  private readonly sheets = inject(Sheets);
  private readonly document = inject(DOCUMENT);

  async open(code: string): Promise<void> {
    await this.sheets.open<void, ShareData>(ShareSheet, {
      code,
      link: shareLink(this.document.location.origin, code),
    });
  }
}
