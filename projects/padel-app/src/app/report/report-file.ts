/*
 * Getting the finished report off the phone that made it (ADR-0040, refining ADR-0039).
 *
 * One function, because there is one way to hand somebody a file and the alternatives turned out
 * not to exist. A tap downloads, and the browser is asked nothing first: a sheet in front of the
 * file is a second decision nobody asked to make, and every destination it offers is one the
 * downloads folder reaches anyway.
 *
 * Some browsers take the download and do nothing with it. An in-app WebView — a link tapped inside
 * Messenger, which is where a spectator meets this app — accepts `download` on a `blob:` URL,
 * fires no error and saves no file. `navigator.share` is not the way out of that: the Web Share
 * API is a Chrome feature rather than a WebView one, so the browsers that swallow the download are
 * the same ones that cannot open a sheet. There is nothing left here to try.
 *
 * So the escape is not in this file and is not code. It is a sentence on the screen telling the
 * person to open the page in their browser, which is the one thing a WebView still offers and the
 * one thing that works (ADR-0040 §2).
 */
import type { SessionRecord } from '../session/session-record';

/** What the file is called, so it stays recognisable in a downloads folder six months later. */
const EXTENSION = '.pdf';

/**
 * Hand the report to the person who asked for it: a link the page clicks for itself, and the
 * object URL released straight after.
 *
 * The blob arrives already typed `application/pdf` — pdfmake's `getBlob()` sets it — so nothing
 * here re-wraps it.
 *
 * The anchor is never in the document. Appending it is the folklore fix for a browser that has not
 * shipped for years, and an invisible link in the DOM is one more thing a screen reader can find.
 *
 * The URL is released on the next task rather than on the next line. Revoking it synchronously
 * after `click()` races the browser's own reading of the href, and the failure mode is a download
 * that silently produces nothing — which on this feature is indistinguishable from the offline
 * sentence being wrong.
 */
export function download(report: Blob, filename: string): void {
  const url = URL.createObjectURL(report);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url));
}

/**
 * The file's name: `padel-americano-2026-08-26.pdf`.
 *
 * From `createdAt` rather than from the moment it was generated, because what names the file is
 * the night it holds. Two evenings of one mode in a day collide, and the browser's own `(1)` is a
 * better answer to that than a timestamp on every file forever.
 *
 * The date is read in local time, so the file agrees with the day printed in the report's header
 * — an evening that ran past midnight in a timezone ahead of UTC would otherwise be filed under
 * tomorrow.
 */
export function reportFilename(record: SessionRecord): string {
  const created = new Date(record.createdAt);
  const month = String(created.getMonth() + 1).padStart(2, '0');
  const day = String(created.getDate()).padStart(2, '0');

  return `padel-${record.session.mode}-${created.getFullYear()}-${month}-${day}${EXTENSION}`;
}
