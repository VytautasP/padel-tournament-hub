/*
 * Getting the finished report off the phone that made it (ADR-0038 §7).
 *
 * Two paths, and shipping either one alone would hand the bad half of the audience a broken
 * feature: a blob download on iOS Safari opens a tab full of binary instead of saving a file, and
 * the share sheet does not exist on desktop Firefox. So the browser is asked which it can do —
 * `canShare({ files })` is the only honest question, because a browser can have `share` and refuse
 * files — and the download is what is left.
 *
 * A cancelled share sheet is silence. `navigator.share` rejects when the person dismisses it, and
 * that is a decision rather than a failure: falling back to a download there would save a file
 * somebody has just said they did not want.
 *
 * What is shared is `{ files }` and nothing else. A `title` or a `text` beside it would be a second
 * sentence naming the evening, and the file already carries its name — which is the one the report
 * prints in its own header, because `reportFilename` and the header are built from the same record.
 */
import type { SessionRecord } from '../session/session-record';

/** What the file is called, so it stays recognisable in a downloads folder six months later. */
const EXTENSION = '.pdf';

/** The media type, on the `File` the share sheet reads and on the blob a download saves. */
const PDF = 'application/pdf';

/** Hand the report to the person who asked for it. */
export async function deliver(report: Blob, filename: string): Promise<void> {
  const file = new File([report], filename, { type: PDF });

  if (navigator.canShare?.({ files: [file] }) === true) {
    try {
      await navigator.share({ files: [file] });
    } catch {
      // Dismissed, or a sheet the browser would not open. Either way the person is looking at the
      // screen they started on, and a download they did not ask for would be the wrong answer.
    }

    return;
  }

  download(report, filename);
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

/**
 * The fallback: a link the page clicks for itself, and the object URL released straight after.
 *
 * The anchor is never in the document. Appending it is the folklore fix for a browser that has not
 * shipped for years, and an invisible link in the DOM is one more thing a screen reader can find.
 *
 * The URL is released on the next task rather than on the next line. Revoking it synchronously
 * after `click()` races the browser's own reading of the href, and the failure mode is a download
 * that silently produces nothing — which on this feature is indistinguishable from the offline
 * sentence being wrong.
 */
function download(report: Blob, filename: string): void {
  const url = URL.createObjectURL(report);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url));
}
