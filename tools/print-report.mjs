/**
 * Writes a report for an awkward session to a PDF, so it can be read by a person.
 *
 * This is what ships in place of tests (ADR-0038 §8, ADR-0005). The failure mode of a generated
 * document is that page three breaks in the middle of a round and looks wrong, and no assertion
 * has ever noticed that — so the treatment is the one `print:schedule` gets: build the awkward
 * case, print it, and look at it.
 *
 *   npm run print:report              # tools/report.pdf
 *   npm run print:report -- out.pdf   # somewhere else
 *
 * The session below is deliberately the worst evening this app can produce, so that one read of
 * one file exercises every branch in `buildReport`:
 *
 *   - **Lithuanian names.** `Deimantė`, `Šarūnas`, `Eglė` — the reason the report is set in Roboto
 *     and not in a core PDF font (ADR-0038 §2). If any of them prints as a box, the font did not
 *     embed and the whole feature is broken for half the audience.
 *   - **Mixicano on seven women and four men**, hybrid fill, so same-gender pairs are forced,
 *     marked and explained under the courts they are on.
 *   - **Eleven players on two courts**, so three people sit out every round and every table row
 *     has a bench credit in it that its record does not account for (ADR-0023 §5).
 *   - **A last round nobody finished**, compensated — so the `Comp` column appears, the legend
 *     grows its clause, and the round is printed and marked unplayed (ADR-0037, ADR-0038 §4).
 *   - **Two joint positions**, second and ninth, so the `=2` mark is on the page followed by the
 *     `4` that makes it look like a bug when it is not, and the legend grows its clause for it
 *     (ADR-0038 §3, decision #8).
 *   - **Twelve rounds**, which is more than one page: the page break is the thing to look at.
 *   - **Named courts**, one of them left blank, so both halves of ADR-0017 §6 are on the page.
 *
 * `buildReport` is TypeScript in `padel-app` and there is no built package to import it from, so
 * the module is bundled here with esbuild — which `@angular/build` already brings — and the
 * bundle's one bare import, `padel-engine`, is pointed at the built library. That is also why this
 * script builds first: it reads `dist/`, exactly as `print:schedule` does.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import pdfmake from 'pdfmake';
import {
  createSession,
  finishSession,
  generateRemaining,
  recordScore,
} from '../dist/padel-engine/fesm2022/padel-engine.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const enginePackage = path.join(repoRoot, 'dist', 'padel-engine', 'fesm2022', 'padel-engine.mjs');
const fontDirectory = path.join(repoRoot, 'node_modules', 'pdfmake', 'build', 'fonts', 'Roboto');

/**
 * The roster: seven women and four men, named the way this app's audience is named.
 *
 * The diacritics are the point. A report that cannot spell `Deimantė` is a report half the people
 * who played in it cannot read their own name on, which is the entire argument of ADR-0038 §2.
 */
const ROSTER = [
  { id: 'p1', name: 'Deimantė', gender: 'woman' },
  { id: 'p2', name: 'Eglė', gender: 'woman' },
  { id: 'p3', name: 'Rūta', gender: 'woman' },
  { id: 'p4', name: 'Aistė', gender: 'woman' },
  { id: 'p5', name: 'Gabija', gender: 'woman' },
  { id: 'p6', name: 'Živilė', gender: 'woman' },
  { id: 'p7', name: 'Miglė', gender: 'woman' },
  { id: 'p8', name: 'Šarūnas', gender: 'man' },
  { id: 'p9', name: 'Mantas', gender: 'man' },
  { id: 'p10', name: 'Tomas', gender: 'man' },
  { id: 'p11', name: 'Vytautas', gender: 'man' },
];

/** The courts the club booked, with the middle one left unnamed (ADR-0017 §6). */
const COURT_NAMES = ['Centre', ''];

const TARGET_SCORE = 24;
const ROUND_COUNT = 12;

/**
 * The evening, played out and then abandoned one round short of its schedule.
 *
 * Every round but the last is scored. The scores walk a fixed pattern rather than being random, so
 * two runs of this script produce the same document and a change to the layout is the only thing
 * that can make the two look different — and the pattern is chosen to land a tie at the top, which
 * is the one thing about the final table that cannot be arranged after the fact.
 */
function awkwardSession() {
  const scheduled = generateRemaining(
    createSession({
      id: 'awkward',
      mode: 'mixicano',
      players: ROSTER,
      courtCount: COURT_NAMES.length,
      targetScore: TARGET_SCORE,
      roundCount: ROUND_COUNT,
      strictMixing: false,
    }),
  );

  // Every round but the last. What that leaves behind is an abandoned round (ADR-0037 §2), which
  // is what the `Comp` column and the `Not played` mark below it exist to explain.
  const played = scheduled.rounds.slice(0, -1);
  let session = scheduled;
  let index = 0;

  for (const round of played) {
    for (const match of round.matches) {
      // A walk through 12, 24 and 18 rather than random numbers: a draw, a whitewash and a
      // comfortable win, in a repeating order, so the table has ties, blowouts and close games in
      // it and the document is the same one twice — bar the date in its footer, which is the day
      // it was generated. These three in this order are also what lands
      // the joint second place below — a tie that survives all three of decision #8's tiers is not
      // something that can be arranged after the fact, so the pattern was searched for it.
      const points = [12, 24, 18][index % 3];
      index += 1;
      session = recordScore(session, { matchId: match.id, side: 'A', points });
    }
  }

  return finishSession(session, { compensateUnplayed: true });
}

/**
 * `buildReport` and `rowsOf`, bundled into something Node can import.
 *
 * One bundle holding both, entered through a module written here rather than through either file,
 * because the two have to come from the same copy of `copy.ts` — the dictionary is a live binding
 * that `useLanguage` reassigns (ADR-0032 §3), and two bundles would be two of it.
 */
async function loadAppModules() {
  const appRoot = path.join(repoRoot, 'projects', 'padel-app', 'src', 'app');
  const bundle = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'padel-report-')), 'report.mjs');

  await build({
    stdin: {
      contents:
        `export { buildReport } from './report/report-document';\n` +
        `export { rowsOf } from './standings/standing-row';\n` +
        `export { copy } from './copy/copy';\n`,
      resolveDir: appRoot,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: bundle,
    // The app's one bare import. Pointed at the built library rather than at the engine's source,
    // so this script proves the same package the browser bundle loads.
    alias: { 'padel-engine': enginePackage },
    logLevel: 'warning',
  });

  return import(pathToFileURL(bundle).href);
}

/**
 * The four Roboto faces, from the files pdfmake ships beside the base64 the browser gets.
 *
 * The browser build carries the fonts as a virtual filesystem and Node does not, so this is the
 * one thing about the document the script wires differently from the app. It is still the same
 * four faces, which is what keeps what a person reads here the thing the app produces.
 */
function useRoboto() {
  pdfmake.setLocalAccessPolicy((requested) => requested.startsWith(fontDirectory));
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setFonts({
    Roboto: {
      normal: path.join(fontDirectory, 'Roboto-Regular.ttf'),
      bold: path.join(fontDirectory, 'Roboto-Medium.ttf'),
      italics: path.join(fontDirectory, 'Roboto-Italic.ttf'),
      bolditalics: path.join(fontDirectory, 'Roboto-MediumItalic.ttf'),
    },
  });
}

const out = path.resolve(process.argv[2] ?? path.join(repoRoot, 'tools', 'report.pdf'));
const { buildReport, copy, rowsOf } = await loadAppModules();
const session = awkwardSession();

useRoboto();

const document = buildReport(
  {
    session,
    createdAt: new Date('2026-08-26T18:30:00Z').toISOString(),
    courtNames: COURT_NAMES,
    endedAt: new Date('2026-08-26T21:10:00Z').toISOString(),
  },
  // The same rows the screen renders, through the same function (ADR-0038 §5), so this script
  // cannot be the place the report and the table drift apart.
  rowsOf(session),
  // English, which is what this binding is until `useLanguage` says otherwise and nothing here
  // does (ADR-0032 §2). It is passed rather than defaulted because `buildReport` requires it: an
  // argument nobody supplies is one nobody can get wrong, and also one nobody can use.
  copy,
);

fs.writeFileSync(out, await pdfmake.createPdf(document).getBuffer());
process.stdout.write(`${path.relative(process.cwd(), out)}
`);
