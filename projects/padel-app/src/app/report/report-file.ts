/*
 * Getting the finished report off the phone that made it (ADR-0039, refining ADR-0038 §7).
 *
 * One path: the file is downloaded, and the browser is asked nothing first. The link above this
 * says "Save this evening as a PDF", and a share sheet between the tap and the file is a second
 * decision nobody asked to make — every destination it offers is one the downloads folder reaches
 * anyway, a minute later and with the file still there afterwards.
 *
 * This costs the app its only signal that the file arrived. `click()` on a detached anchor reports
 * nothing and cannot reject, so a browser that refuses the download is silence. That was already
 * true of the fallback path; what is new is that there is no other path for it to be true of.
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
