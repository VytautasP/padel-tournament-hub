/**
 * Prints generated schedules to stdout, so fairness can be eyeballed rather than only asserted.
 *
 * Build-order step 1 asks for exactly this: print schedules, read them, and notice what a
 * validator cannot. `formatSchedule` does the rendering — this script only decides which sessions
 * are worth looking at and hands them over. The names below are duplicated from the engine's test
 * fixtures on purpose: this script reads the built package, which does not ship test support.
 *
 *   npm run print:schedule                # the sessions below
 *   npm run print:schedule -- 11 2 11     # 11 players, 2 courts, 11 rounds
 *   npm run print:schedule -- 11 2 11 7   # ...as Mixicano, with 7 of the 11 women
 *
 * It imports the built library, so it also proves the printed output survives the package build
 * rather than only the test bundler. `npm run print:schedule` builds first.
 */
import {
  createSession,
  formatSchedule,
  generateRemaining,
} from '../dist/padel-engine/fesm2022/padel-engine.mjs';

const NAMES = [
  'Ana',
  'Ben',
  'Cara',
  'Dov',
  'Elin',
  'Finn',
  'Gita',
  'Hugo',
  'Iris',
  'Jonas',
  'Kaja',
  'Liam',
  'Mira',
  'Nils',
  'Olga',
  'Pavel',
];

/** A roster of `count` players; the first `women` of them women, where a mode asks for genders. */
const roster = (count, women) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: NAMES[index % NAMES.length] ?? `Player ${index + 1}`,
    ...(women === undefined ? {} : { gender: index < women ? 'woman' : 'man' }),
  }));

const schedule = (id, players, courtCount, roundCount, women) =>
  generateRemaining(
    createSession({
      id,
      mode: women === undefined ? 'americano' : 'mixicano',
      players: roster(players, women),
      courtCount,
      targetScore: 24,
      roundCount,
    }),
  );

/** A usage mistake is the reader's, not the code's — say what is wrong, without a stack trace. */
function usage(message) {
  process.stderr.write(
    `${message}\nUsage: node tools/print-schedule.mjs [players] [courts] [rounds] [women]\n`,
  );
  process.exit(1);
}

function main(argv) {
  if (argv.length > 0) {
    const [players, courts, rounds, women] = argv.map(Number);
    if (
      (argv.length !== 3 && argv.length !== 4) ||
      ![players, courts, rounds].every((value) => Number.isInteger(value) && value > 0)
    ) {
      usage('Expected three positive whole numbers, and optionally a fourth.');
    }
    if (players < 4) {
      usage('A session needs at least 4 players.');
    }
    if (argv.length === 4 && !(Number.isInteger(women) && women >= 0 && women <= players)) {
      usage(`Expected the number of women to be between 0 and ${players}.`);
    }

    return [{ session: schedule(`cli-${players}p`, players, courts, rounds, women) }];
  }

  return [
    // Nine rounds on an eight-player roster: every partnership is exhausted in seven, so rounds
    // 8 and 9 are where repeats show up in the per-player blocks.
    { session: schedule('session-8p', 8, 2, 9), note: 'Exact fit: nobody sits out.' },
    {
      session: schedule('session-11p', 11, 2, 11),
      note: [
        'Eleven players on two courts — the case the build order names by name. Three sit out',
        'every round; read the bench lines down the page and the per-player counts at the end.',
      ].join('\n'),
    },
    { session: schedule('session-12p', 12, 3, 5), note: 'Exact fit on three courts.' },
    { session: schedule('session-6p', 6, 2, 6), note: 'Two courts booked, one court staffed.' },
    {
      session: schedule('mixicano-8p', 8, 2, 7, 4),
      note: 'Mixicano on an even split: every pair mixes, and nothing is marked.',
    },
    {
      session: schedule('mixicano-10p', 10, 2, 12, 7),
      note: [
        'Mixicano on seven women and three men — the split real rosters actually produce. Read',
        'the starred pairs down the page: there should be as few as the arithmetic allows, and',
        'they should not be the same two women every round.',
      ].join('\n'),
    },
    {
      session: schedule('mixicano-10p-skew', 10, 2, 10, 9),
      note: 'Mixicano with one man among nine women: the degenerate end of hybrid fill.',
    },
  ];
}

for (const { session, note } of main(process.argv.slice(2))) {
  process.stdout.write(`${'='.repeat(72)}\n`);
  if (note) {
    process.stdout.write(`${note}\n${'-'.repeat(72)}\n`);
  }
  process.stdout.write(formatSchedule(session));
  process.stdout.write('\n');
}
