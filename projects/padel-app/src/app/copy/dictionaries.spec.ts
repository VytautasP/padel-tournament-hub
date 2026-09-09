/*
 * The two dictionaries, held against each other (ADR-0032 §1).
 *
 * `Copy` does nearly all of this work at build time and this file exists for the part it cannot.
 * A missing entry, a renamed one and a wrong return type are already build errors — proved by the
 * type, not repeated here. What TypeScript permits, everywhere in the language, is a function that
 * takes *fewer* arguments than the one it replaces: `(name: string) => string` is assignable to
 * `(name: string, team: string) => string`. In a dictionary that is a Lithuanian sentence quietly
 * dropping the team out of the middle of itself, on a screen the compiler has just declared fine.
 *
 * So the shapes are walked. It is done here rather than in `tools/verify-app-conventions.mjs`,
 * which is where ADR-0032 §1 said the parity check would go, and ADR-0033 records why it does not:
 * that file reads source *text* with regular expressions, and the two facts worth checking — how
 * many arguments a function declares, and whether the words that must not be translated are the
 * same object — are facts about the loaded modules rather than about their text. A checker that
 * re-implemented a TypeScript parser to find them would be a second, worse compiler. The convention
 * check keeps its four rules, unchanged, and this runs beside it in the same `npm run verify`.
 */
import { copyEn } from './copy.en';
import { copyLt } from './copy.lt';
import { appName, modeNames } from './names';
import { countIn } from './plural';

describe('the dictionaries', () => {
  it('have the same shape, entry for entry', () => {
    expect(driftBetween(copyEn, copyLt, 'copy')).toEqual([]);
  });

  /*
   * The drift walker, shown biting. A parity check nobody has seen reject anything is
   * indistinguishable from one that always passes — the same bargain `verify-app-conventions.mjs`
   * makes with itself.
   */
  it('would notice a translation that dropped an argument', () => {
    const short = { ...copyEn, round: { ...copyEn.round, advance: () => 'Round →' } };

    expect(driftBetween(copyEn, short, 'copy')).toEqual([
      'copy.round.advance takes 1 argument in one dictionary and 0 in the other',
    ]);
  });

  it('would notice an entry that stopped being a sentence', () => {
    const wrong = { ...copyEn, landing: { ...copyEn.landing, resume: () => 'Tęsti' } };

    expect(driftBetween(copyEn, wrong, 'copy')).toEqual([
      'copy.landing.resume is a string in one dictionary and a function in the other',
    ]);
  });

  /*
   * The proper nouns of the sport and of the product (ADR-0032 §5).
   *
   * Asserted as the same *object* rather than as equal strings, because equal strings are a thing
   * somebody has to keep equal and one shared module is a thing that cannot drift. If this ever
   * fails it is because a dictionary has written its own mode names, which is the failure worth
   * catching — not a typo in one of them.
   */
  it('name the modes and the product from one place, so neither can translate them', () => {
    expect(copyEn.appName).toBe(appName);
    expect(copyLt.appName).toBe(appName);
    expect(copyEn.wizard.mode.name('americano')).toBe(modeNames.americano);
    expect(copyLt.wizard.mode.name('team-americano')).toBe(modeNames['team-americano']);
  });

  /*
   * Both dictionaries carry the same two words here, and it is the one place that is deliberate
   * rather than an oversight: a language named in a language the reader does not have is the one
   * control on the sheet they cannot use.
   */
  it('name each language in that language, identically in both', () => {
    expect(copyEn.settings.language.answers).toEqual(copyLt.settings.language.answers);
    expect(copyLt.settings.language.answers.en).toBe('English');
    expect(copyEn.settings.language.answers.lt).toBe('Lietuvių');
  });
});

/*
 * `Intl.PluralRules` doing the thing hand-written arithmetic gets wrong (ADR-0032 §4).
 *
 * 11 is the one an English speaker would guess wrong — it takes the same form as 111 and *not* the
 * same form as 21, which is a rule about the last two digits rather than the last one. It is
 * checked through the dictionary rather than against the rules directly, because what is being
 * claimed is that the front door inflects, not that the browser has a plural table.
 */
describe('counting in Lithuanian', () => {
  it('inflects the roster on the Resume card', () => {
    expect(summaries([1, 3, 11, 21, 111])).toEqual([
      'Americano · 1 žaidėjas',
      'Americano · 3 žaidėjai',
      'Americano · 11 žaidėjų',
      'Americano · 21 žaidėjas',
      'Americano · 111 žaidėjų',
    ]);
  });

  it('inflects the same numbers in English, where there are only two answers', () => {
    const english = [1, 3, 11, 21, 111].map((size) => copyEn.session.summary('americano', size));

    expect(english).toEqual([
      'Americano · 1 player',
      'Americano · 3 players',
      'Americano · 11 players',
      'Americano · 21 players',
      'Americano · 111 players',
    ]);
  });

  /** A form the dictionary did not write down falls back to `other` rather than to nothing. */
  it('falls back to the form every locale has', () => {
    const counted = countIn('lt-LT');

    expect(counted(0.5, { other: 'žaidėjo' })).toBe('0.5 žaidėjo');
  });

  it('inflects the roster on the wizard step that builds it', () => {
    expect(SPOT_CHECKS.map((size) => copyLt.wizard.players.count(size))).toEqual([
      '1 žaidėjas',
      '3 žaidėjai',
      '11 žaidėjų',
      '21 žaidėjas',
      '111 žaidėjų',
    ]);
  });

  /*
   * The same noun, twice, because Lithuanian inflects for case as well as for number: a roster
   * names itself in the nominative and `reikia` — needs — governs the genitive. A dictionary that
   * carried one set of forms would read as wrong on whichever screen it was not written for.
   */
  it('asks for a roster in the genitive and names one in the nominative', () => {
    expect(copyLt.wizard.players.tooFew(1)).toBe('Sesijai reikia bent 1 žaidėjo.');
    expect(copyLt.wizard.players.tooFew(4)).toBe('Sesijai reikia bent 4 žaidėjų.');
    expect(copyLt.wizard.players.count(4)).toBe('4 žaidėjai');
  });

  it('inflects the round header, which counts rounds after a preposition', () => {
    expect(SPOT_CHECKS.map((count) => copyLt.round.heading(1, count))).toEqual([
      '1 raundas iš 1 raundo',
      '1 raundas iš 3 raundų',
      '1 raundas iš 11 raundų',
      '1 raundas iš 21 raundo',
      '1 raundas iš 111 raundų',
    ]);
  });

  it('inflects a history row, through the summary it shares with the front door', () => {
    expect(copyLt.history.row('tr 26 rugp.', 'mixicano', 11)).toBe(
      'tr 26 rugp. · Mixicano · 11 žaidėjų',
    );
  });

  /*
   * The evenings a browser leaves behind (ADR-0028 §2), in the accusative `palikti` governs — and
   * the one place in this dictionary where `few` is a different word rather than a second spelling
   * of `other`.
   */
  it('inflects the evenings the adoption question costs', () => {
    expect(SPOT_CHECKS.map(leavesBehind)).toEqual([
      '1 vakarą',
      '3 vakarus',
      '11 vakarų',
      '21 vakarą',
      '111 vakarų',
    ]);
  });
});

/*
 * Nothing was left in English by the translation (#70).
 *
 * The type proves every entry is *present* and the drift walker proves every function still takes
 * its arguments; neither can see a Lithuanian entry that is still the English sentence, which is
 * the one failure a 180-entry replacement actually has. So the two dictionaries are held against
 * each other and every string they agree on is listed — if that list grows, a screen has gone back
 * to English.
 *
 * Only plain strings are compared. A function's output depends on what it is handed, and the
 * arguments that would make each of the 36 of them speak are the app, not a test.
 */
describe('the Lithuanian dictionary', () => {
  it('shares only the words that are deliberately not translated', () => {
    expect(sharedStringsBetween(copyEn, copyLt, 'copy')).toEqual([
      'copy.appName',
      'copy.landing.optionsGlyph',
      'copy.settings.openGlyph',
      'copy.settings.language.answers.en',
      'copy.settings.language.answers.lt',
      'copy.round.previousGlyph',
      'copy.round.nextGlyph',
      'copy.round.sameGender.mark',
      'copy.players.optionsGlyph',
      'copy.history.deleteGlyph',
    ]);
  });

  /*
   * **Went home** is not a deletion (`CONTEXT.md`), and in Lithuanian that is a claim about one
   * verb: `ištrinti` is what history does to an evening and must not be what the Players tab does
   * to a person. Asserted because the softness is the whole of the term and it is invisible to
   * anybody reading the file in English.
   */
  it('never says delete about a player who went home', () => {
    const departure = [
      copyLt.players.gone,
      copyLt.players.wentHome,
      copyLt.players.preview.confirmDeparture('Ana'),
      copyLt.players.nobodyCanLeave(4),
      copyLt.players.noTeamCanLose(2),
    ];

    expect(departure.some((sentence) => /ištrin|pašalin|panaikin/i.test(sentence))).toBe(false);
    expect(copyLt.players.gone).toBe('Išėjo namo');
  });

  /*
   * **Bench** and **bye** are two terms in the glossary and stay two words here, as do
   * **standings** and the count of rounds a competitor sat out.
   */
  it('keeps the bench and the bye apart', () => {
    expect(copyLt.round.bench(['Ana', 'Benas'])).toBe('Nežaidžia: Ana, Benas');
    expect(copyLt.round.bye(['Ana ir Benas'])).toBe('Raundą praleidžia: Ana ir Benas');
  });
});

/** The numbers ADR-0032 §4 names: 11 and 21 disagree, and 111 agrees with 11 rather than with 1. */
const SPOT_CHECKS = [1, 3, 11, 21, 111] as const;

function leavesBehind(evenings: number): string {
  const lead = copyLt.identity.adoptConfirm('ana@example.com', evenings).lead;

  return lead.match(/paliks (.+?) —/)?.[1] ?? lead;
}

/** Every plain string the two dictionaries write identically, named by the path it sits at. */
function sharedStringsBetween(left: unknown, right: unknown, path: string): string[] {
  if (typeof left === 'string' && typeof right === 'string') {
    return left === right ? [path] : [];
  }

  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return [];
  }

  const ours = left as Record<string, unknown>;
  const theirs = right as Record<string, unknown>;

  return Object.keys(ours).flatMap((key) =>
    key in theirs ? sharedStringsBetween(ours[key], theirs[key], `${path}.${key}`) : [],
  );
}

function summaries(sizes: readonly number[]): string[] {
  return sizes.map((size) => copyLt.session.summary('americano', size));
}

/**
 * Every way two dictionaries disagree about their shape, named by the path they disagree at.
 *
 * Both directions, because a key present in only one of them is drift whichever one has it, and
 * the two failures read differently to whoever has to fix them.
 */
function driftBetween(left: unknown, right: unknown, path: string): string[] {
  const kind = (value: unknown): string =>
    typeof value === 'function'
      ? 'function'
      : typeof value === 'object' && value !== null
        ? 'object'
        : typeof value;

  if (kind(left) !== kind(right)) {
    return [`${path} is a ${kind(left)} in one dictionary and a ${kind(right)} in the other`];
  }

  if (typeof left === 'function' && typeof right === 'function') {
    return left.length === right.length
      ? []
      : [
          `${path} takes ${left.length} argument${left.length === 1 ? '' : 's'} in one dictionary and ${right.length} in the other`,
        ];
  }

  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return [];
  }

  const ours = left as Record<string, unknown>;
  const theirs = right as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])];

  return keys.flatMap((key) => {
    if (!(key in theirs)) {
      return [`${path}.${key} is in one dictionary and not the other`];
    }
    if (!(key in ours)) {
      return [`${path}.${key} is in one dictionary and not the other`];
    }

    return driftBetween(ours[key], theirs[key], `${path}.${key}`);
  });
}
