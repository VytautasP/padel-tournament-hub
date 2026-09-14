/*
 * A document definition, as the bytes of a PDF (ADR-0038 §5, §6).
 *
 * The whole of this app's dependency on pdfmake is in this file, and it is deliberately three
 * lines: `buildReport` decides everything about what the report says and this decides nothing at
 * all. That seam is what keeps the library replaceable and — far more usefully — what keeps every
 * decision ADR-0038 records in a pure function that needs no library to be read.
 *
 * A token for the reason `QR_ENCODER` is one. This is the second third-party library the app
 * fetches on first use, it is therefore the only part of the report that can fail at runtime, and
 * a spec has to be able to cause that failure without a network. `share/qr-matrix.ts` established
 * the whole pattern — the lazy import, the CommonJS interop, `allowedCommonJsDependencies` in
 * `angular.json`, and a sentence rather than a dead button where the chunk does not arrive
 * (ADR-0030).
 */
import { InjectionToken } from '@angular/core';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

/** Rendering a report. Rejects where the library could not be reached, which the link renders. */
export type PdfMaker = (document: TDocumentDefinitions) => Promise<Blob>;

export const PDF_MAKER = new InjectionToken<PdfMaker>('PdfMaker');

/**
 * The real one: pdfmake and its fonts, fetched on first use.
 *
 * Two imports rather than one, because the browser build of pdfmake ships the *names* of the
 * Roboto faces and not their bytes — `vfs_fonts` is the file that carries them, and without it
 * every report would fail at the first glyph. They are both fetched here so that an evening that
 * never asks for a report downloads neither, which is the same bargain the QR encoder strikes.
 *
 * There is still no service worker (decision #15), so this is a network fetch every time. That is
 * what makes `copy.report.unavailable` load-bearing rather than defensive.
 */
export const pdfMaker: PdfMaker = async (document) => {
  /*
   * The `default ?? namespace` dance, for the reason `qrEncoder` documents at length: pdfmake and
   * its font file are both CommonJS, and what a CommonJS module looks like on the other side of
   * `await import()` is decided by whoever compiled the call. The production bundler and Vitest do
   * not agree, and the test runner's interop is the one that hides the disagreement — which is why
   * ADR-0038 asks for the built chunk's exports to be read by hand.
   */
  const pdfmake = await import('pdfmake');
  const make = pdfmake.default ?? pdfmake;

  const fonts = await import('pdfmake/build/vfs_fonts');
  make.addVirtualFileSystem(fonts.default ?? fonts);

  return make.createPdf(document).getBlob();
};
