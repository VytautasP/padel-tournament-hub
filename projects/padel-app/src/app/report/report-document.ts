/*
 * The evening as a document: the final table, then every round it played (ADR-0038).
 *
 * A pure function producing a plain data structure, which is the whole of why it is a file of its
 * own. Every decision ADR-0038 records — the columns the phone had no room for, the `DIFF` that is
 * not here, the abandoned rounds that are, the joint positions marked, the absence of medals —
 * lives in this function and nowhere near the library that renders it. `PDF_MAKER` is handed the
 * result and does three lines of work with it.
 *
 * It is given the same `StandingRow`s the screen renders and the same dictionary the screen reads,
 * so there is one answer in this app to what a competitor is called and what they scored. A report
 * that recomputed either would be a second, drifting rendering of the standings, and the argument
 * at the side of the court six months later would be about whose copy was right.
 *
 * **The day formatters are read from `copy.ts` rather than taken as arguments.** They are
 * reassigned by `useLanguage` in the same statement `copy` is, before any screen exists (ADR-0032
 * §3), so the dates and the words on this page always come from one language — provided the caller
 * hands in the dictionary the app is actually speaking, which is why `copy` is a required argument
 * and both callers pass the live binding rather than a dictionary of their own choosing. Handing in
 * the other one would print the sentences in one language and the dates in the other.
 *
 * The one other thing this function reads from outside its arguments is the clock, once, for the
 * footer — see `generatedOn` below, where the reasoning is.
 *
 * Nothing here names a colour. The report is monochrome — pdfmake's built-in
 * `lightHorizontalLines` draws the one rule on the page — for ADR-0018's reason and for ADR-0038
 * §3's: the three metals are the one warm thing on the Standings screen, and a print-ready
 * document is not that screen.
 */
import { formatDate, formatDay } from '../copy/copy';
import { roundView } from '../round/round-view';
import type { Copy } from '../copy/copy';
import type { RoundView, SideView } from '../round/round-view';
import type { SessionRecord } from '../session/session-record';
import type { StandingRow } from '../standings/standing-row';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

/**
 * The type scale of the document, in points.
 *
 * Four sizes and no fifth. A report is read at a desk or on paper rather than at arm's length in
 * fading light, so none of ADR-0021 §4's reasoning about the screen's scale carries over — what
 * these answer is a page. They are named here for the reason the screen's roles are named in
 * `styles.css`: a measurement written at the point of use is a measurement that drifts.
 */
const TYPE = { title: 16, section: 11, body: 9.5, legend: 8 };

/** The page's margins, in points: left, top, right, bottom. */
const MARGINS: [number, number, number, number] = [40, 44, 40, 44];

/** The gap under a round block, in points, so two rounds do not read as one. */
const ROUND_GAP = 12;

/**
 * The evening, ready to be rendered.
 *
 * `record` rather than a `Session`, because two of the things on this page are the app's and not
 * the engine's: the day the evening was created, and what the organizer calls each court
 * (ADR-0017).
 */
export function buildReport(
  record: SessionRecord,
  rows: readonly StandingRow[],
  copy: Copy,
): TDocumentDefinitions {
  const { session } = record;

  /*
   * Whether the page carries a ninth column and a third legend clause.
   *
   * `Comp` is asked of the session's own flag rather than of the rows. That is what ADR-0038 §4
   * says — "`Comp` appears only when `compensatedUnplayed` is set" — and it is also the only
   * reading that cannot go wrong: the figures in the column are `compensationsFor`'s, and an
   * evening where every competitor available for its abandoned round was already paid by a court
   * that did finish pays nobody, which a row-derived predicate would read as an evening that
   * compensated nothing. The organizer answered the question; the flag is their answer.
   *
   * The joint mark is asked of the rows, because that one really is a fact about them: the engine
   * declares a shared place on the evidence (decision #8), and the session holds no flag for it.
   */
  const compensated = session.compensatedUnplayed === true;
  const joint = rows.some((row) => row.joint);

  /*
   * The clock, read once.
   *
   * pdfmake calls `footer` per page, so reading it in there would let a report that renders across
   * midnight print two dates — and would put an ambient clock inside a structure ADR-0038 §5 wants
   * assertable. This is the one impurity in this function and it is here, in one place, on purpose:
   * §4's footer is the date the file was *generated*, which `endedAt` is not.
   */
  const generatedOn = formatDate(new Date().toISOString());

  return {
    pageSize: 'A4',
    pageMargins: MARGINS,
    /*
     * Roboto, forced, and this is the load-bearing line of the file (ADR-0038 §2). Verdana carries
     * the screen because it is installed everywhere and therefore costs nothing, which is exactly
     * what makes it unembeddable; and what a PDF offers instead is the core-14 fonts, which are
     * WinAnsi and cannot spell `Deimantė`. Half this app's audience reads Lithuanian.
     */
    defaultStyle: { font: 'Roboto', fontSize: TYPE.body },
    content: [
      {
        text: reportTitle(record, copy),
        fontSize: TYPE.title,
        bold: true,
        margin: [0, 0, 0, 14],
      },
      ...standingsBlock(rows, copy, compensated, joint),
      ...session.rounds.flatMap((round) =>
        roundBlock(
          roundView(session, round.number, record.courtNames),
          copy,
          session.rounds.length,
        ),
      ),
    ],
    /*
     * The footer is a function because pdfmake asks for one per page, and it says the same thing
     * on all of them. Page numbers are deliberately absent: what a reader of a loose sheet needs
     * is which app made it and when, and the rounds already number themselves.
     */
    footer: () => ({
      text: copy.report.footer(generatedOn),
      fontSize: TYPE.legend,
      alignment: 'center',
      margin: [MARGINS[0], 0, MARGINS[2], 0],
    }),
  };
}

/**
 * What this evening is called: the sentence a history row names it by (ADR-0013 §4 — there is no
 * session name, so this is the whole of a session's identity).
 */
function reportTitle(record: SessionRecord, copy: Copy): string {
  const { session } = record;

  return copy.history.row(formatDay(record.createdAt), session.mode, session.roster.length);
}

/**
 * The final table: a heading, a row per competitor, and the legend that expands the abbreviations.
 *
 * No `DIFF`. Point difference is computed nowhere in the engine, deliberately — ties resolve on
 * head-to-head and then stop (decision #8) — and a difference column printed beside the ranking
 * would look like the tie-break and would not be it, on the one artefact where no reader can tap
 * anything to find out.
 */
function standingsBlock(
  rows: readonly StandingRow[],
  copy: Copy,
  compensated: boolean,
  joint: boolean,
): readonly Content[] {
  /*
   * The `Comp` column is spliced rather than emptied, so an ordinary evening's table is eight
   * columns wide and not eight columns and a gap. The widths, the headings and every row are built
   * from this one condition, which is what stops a heading and its column drifting one apart.
   */
  const whenCompensated = <Cell>(cell: Cell): readonly Cell[] => (compensated ? [cell] : []);

  return [
    { text: copy.session.standings, fontSize: TYPE.section, bold: true, margin: [0, 0, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: [
          'auto',
          '*',
          'auto',
          'auto',
          'auto',
          'auto',
          'auto',
          ...whenCompensated('auto'),
          'auto',
        ],
        body: [
          [
            heading(copy.standings.position),
            heading(copy.standings.player),
            heading(copy.report.played, 'right'),
            heading(copy.report.won, 'right'),
            heading(copy.report.tied, 'right'),
            heading(copy.report.lost, 'right'),
            heading(copy.report.bench, 'right'),
            ...whenCompensated(heading(copy.report.compensated, 'right')),
            heading(copy.report.points, 'right'),
          ],
          ...rows.map((row) => [
            /*
             * The engine's position, rendered exactly as given, and marked where it is shared: the
             * places a joint position occupies are used up (decision #8), so two `=2`s are
             * followed by a `4`. Unmarked, that reads as a bug in the generator on a page nobody
             * can ask a question of (ADR-0038 §3).
             */
            cell(row.joint ? copy.report.jointPosition(row.position) : String(row.position)),
            cell(row.name),
            figure(row.matchesPlayed),
            figure(row.won),
            figure(row.tied),
            figure(row.lost),
            figure(row.benched),
            ...whenCompensated(figure(row.compensated)),
            /*
             * The total, through the same sentence the screen reads it with — so a dash is a dash
             * and a half is a half, in both places, decided once (ADR-0023 §2).
             */
            {
              text: copy.standings.total(
                row.points,
                row.matchesPlayed,
                row.benched,
                row.compensated,
              ),
              alignment: 'right' as const,
              bold: true,
            },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
    },
    {
      text: copy.report.legend(compensated, joint),
      fontSize: TYPE.legend,
      margin: [0, 6, 0, 18],
    },
  ];
}

/**
 * One round: what was played on each court, who sat out, and whether it counted.
 *
 * An ungenerated round produces no block at all rather than an empty heading — a slot is a number
 * in a form field rather than a fixture, and `roundView` already answers `null` for one.
 */
function roundBlock(round: RoundView | null, copy: Copy, roundCount: number): readonly Content[] {
  if (round === null) {
    return [];
  }

  /*
   * An abandoned round is a generated one still holding a court nobody scored (ADR-0037 §2), and
   * it is printed and marked rather than dropped: a report that left it out could not explain the
   * `Comp` column standing above it.
   */
  const unplayed = round.courts.some((court) => court.score === undefined);
  const title = copy.round.heading(round.number, roundCount);

  /*
   * Everything the round says besides its courts, in the order the screen says it. Each line is
   * present only where it has something to say, which is what keeps an ordinary round four lines
   * rather than seven blanks.
   */
  const notes = [
    ...(round.bench.length > 0 ? [copy.round.bench(round.bench)] : []),
    ...(round.bye.length > 0 ? [copy.round.bye(round.bye)] : []),
    ...(round.unusedCourts.length > 0 ? [copy.round.strictMixing.unused(round.unusedCourts)] : []),
    ...(round.hasSameGenderPair ? [copy.round.sameGender.legend] : []),
  ];

  /*
   * One `unbreakable` stack rather than a heading and a table that happen to follow each other.
   *
   * This is the failure ADR-0038 §8 names: page three opening on the second court of round six,
   * or — the one `tools/print-report.mjs` actually caught — a `Round 7 of 12` sitting alone at the
   * foot of a page with its courts overleaf. A round is a handful of lines, so keeping it whole
   * costs a little white space at the bottom of a page and buys a document that reads as rounds
   * instead of as a column of text that happens to have headings in it.
   */
  return [
    {
      unbreakable: true,
      margin: [0, 0, 0, ROUND_GAP],
      stack: [
        {
          text: unplayed ? `${title} · ${copy.report.unplayed}` : title,
          fontSize: TYPE.section,
          bold: true,
          margin: [0, 0, 0, 4],
        },
        {
          table: {
            widths: ['auto', '*', 'auto', '*'],
            body: round.courts.map((court) => [
              cell(court.name),
              { text: sideName(court.sideA, copy), alignment: 'right' as const },
              /*
               * The result, or `v` where the court never finished. Both sides' figures, because
               * the engine derives one from the other (ADR-0007) and a reader checking the
               * arithmetic on paper has nothing else to check it against.
               */
              {
                text:
                  court.score === undefined
                    ? copy.round.versus
                    : `${court.score.sideA} – ${court.score.sideB}`,
                alignment: 'center' as const,
                bold: court.score !== undefined,
              },
              cell(sideName(court.sideB, copy)),
            ]),
          },
          layout: 'noBorders',
        },
        ...notes.map((note) => ({
          text: note,
          fontSize: TYPE.legend,
          margin: [0, 1, 0, 0] as [number, number, number, number],
        })),
      ],
    },
  ];
}

/**
 * One side of a court, with the mark the roster forced on it (ADR-0010).
 *
 * `copy.round.side` is what joins the names, so a side in the report is spelled the way a side on
 * the Round tab is — which in Team Americano is also how the team is named, because a team's name
 * is its two players joined the same way (ADR-0011).
 */
function sideName(side: SideView, copy: Copy): string {
  const names = copy.round.side(side.names);

  return side.sameGender ? `${names}${copy.round.sameGender.mark}` : names;
}

function heading(label: string, alignment: 'left' | 'right' = 'left'): Content {
  return { text: label, bold: true, alignment };
}

/** A cell that is only its words: no weight, no alignment, nothing to say about itself. */
function cell(value: string): Content {
  return { text: value };
}

/** A figure in a column of figures: right-aligned, so the digits line up down the page. */
function figure(value: number): Content {
  return { text: String(value), alignment: 'right' };
}
