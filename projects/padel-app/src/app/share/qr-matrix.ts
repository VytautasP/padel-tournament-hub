/*
 * A link, as the grid of squares a camera reads (ADR-0026 §4).
 *
 * The QR is drawn from `qrcode`'s matrix rather than from its own SVG renderer, and that is the
 * whole reason this file exists. `toString(…, { type: 'svg' })` returns markup with two hex
 * colours baked into it, which would put a colour value in a TypeScript file — the one thing
 * ADR-0018 forbids everywhere outside `styles.css` — and would then have to be trusted past
 * Angular's sanitizer to reach the DOM. A matrix is data, so the drawing stays in a template where
 * the colours are tokens and nothing is bypassed.
 *
 * The library is imported dynamically, so the organizer downloads a QR encoder the first time they
 * open the sheet and never otherwise. That is the one thing on the sheet that can fail to arrive —
 * a phone with no signal — which is why this is a token: the failure is a state the sheet renders,
 * and a spec has to be able to cause it.
 */
import { InjectionToken } from '@angular/core';

/**
 * One QR, ready to draw: how many modules across it is, and the path that fills the dark ones.
 *
 * A path rather than a square per module, because a 25-across code is 625 elements and a version
 * or two up is four times that — one `<path>` of `M x y h1v1h-1z` subpaths draws the same thing in
 * one node. The quiet zone is not in here: it is margin, and margin is the drawing's business.
 */
export interface QrMatrix {
  readonly size: number;
  readonly path: string;
}

/** Encoding a link. Rejects where the encoder could not be reached, which the sheet renders. */
export type QrEncoder = (text: string) => Promise<QrMatrix>;

export const QR_ENCODER = new InjectionToken<QrEncoder>('QrEncoder');

/**
 * The real encoder: `qrcode`, fetched on first use.
 *
 * The error-correction level is the library's own default (M, a quarter of the code recoverable),
 * which is the level the format was designed around. A padel session's link is short enough that
 * a higher level would cost nothing in version, and low enough stakes that it would buy nothing
 * either: a QR that will not scan is retyped from the ten characters printed underneath it.
 */
export const qrEncoder: QrEncoder = async (text) => {
  /*
   * `qrcode` is CommonJS, and what a CommonJS module looks like on the other side of `await
   * import()` is decided by whoever compiled the call — the production bundler and the test
   * runner do not agree. Asking for the namespace and reaching through `default` where there is
   * one is the shape that survives both.
   *
   * This is not defensiveness for its own sake. Written as `const { create } = await
   * import('qrcode')` the production build emitted a chunk with no `export` statement in it at
   * all, so `create` arrived `undefined`, and calling it threw a `TypeError` that landed in the
   * same `catch` as a failed fetch — a QR that could not be drawn on a phone with full signal.
   * No test saw it, because the test runner's interop handed back the named export it asked for.
   */
  const qrcode = await import('qrcode');
  const { create } = qrcode.default ?? qrcode;
  const { size, data } = create(text).modules;

  return { size, path: pathOf(size, data) };
};

/**
 * Every dark module as one subpath, walked row by row.
 *
 * `M x y h1 v1 h-1 z` is a unit square at the module's own coordinates, which is what lets the
 * `<svg>` take the module grid as its viewBox and leave the scaling to CSS — nothing here knows
 * how many pixels a module is going to be, and nothing should.
 */
function pathOf(size: number, modules: Uint8Array): string {
  let path = '';

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y * size + x]) {
        path += `M${x} ${y}h1v1h-1z`;
      }
    }
  }

  return path;
}
