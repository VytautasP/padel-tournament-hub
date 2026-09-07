/*
 * The QR itself: a link handed in, a grid of squares drawn, or a sentence where it could not be.
 *
 * It is a component of its own rather than markup inside the share sheet because it is the only
 * asynchronous thing on that sheet. The sheet knows what is being shared; this knows that drawing
 * it means fetching an encoder, that the fetch can fail, and that a failure is a sentence rather
 * than an empty square. Two concerns that fail in different ways, so they are two files.
 *
 * The load runs through `PendingTasks` for the same reason the app's restore does: without it the
 * app is "stable" the moment the sheet paints, and every spec would be racing a promise it cannot
 * see.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  PendingTasks,
  signal,
} from '@angular/core';
import { copy } from '../copy/copy';
import { QR_ENCODER } from './qr-matrix';
import type { QrMatrix } from './qr-matrix';

/**
 * The four modules of blank a QR needs around it to be found at all.
 *
 * Part of the drawing rather than of the matrix: it is margin, and it is expressed inside the
 * viewBox so that the quiet zone scales with the code rather than being a padding somebody has to
 * keep in proportion.
 */
const QUIET_ZONE = 4;

/** One QR as the template draws it: where the coordinates start, how far they run, and the ink. */
interface Drawing {
  readonly edge: number;
  readonly across: number;
  readonly viewBox: string;
  readonly path: string;
}

@Component({
  selector: 'app-qr-code',
  templateUrl: './qr-code.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCode {
  /** What the camera should end up at. */
  readonly text = input.required<string>();

  private readonly encode = inject(QR_ENCODER);
  private readonly tasks = inject(PendingTasks);
  private readonly matrix = signal<QrMatrix | null>(null);
  private readonly failed = signal(false);

  protected readonly copy = copy;
  protected readonly unavailable = this.failed.asReadonly();

  /**
   * The code in module coordinates: one unit per module, the quiet zone as negative space around
   * it, and nothing here in pixels. How big it is drawn is the sheet's business and CSS's.
   */
  protected readonly drawing = computed<Drawing | null>(() => {
    const matrix = this.matrix();
    if (matrix === null) {
      return null;
    }

    const across = matrix.size + QUIET_ZONE * 2;

    return {
      edge: -QUIET_ZONE,
      across,
      viewBox: `${-QUIET_ZONE} ${-QUIET_ZONE} ${across} ${across}`,
      path: matrix.path,
    };
  });

  constructor() {
    effect(() => {
      const text = this.text();

      void this.tasks.run(() => this.draw(text));
    });
  }

  private async draw(text: string): Promise<void> {
    try {
      this.matrix.set(await this.encode(text));
      this.failed.set(false);
    } catch {
      // The encoder did not arrive. Nothing else here can fail — a link is always encodable — so
      // this is a network, and the sheet's answer is the code printed underneath it.
      this.matrix.set(null);
      this.failed.set(true);
    }
  }
}
