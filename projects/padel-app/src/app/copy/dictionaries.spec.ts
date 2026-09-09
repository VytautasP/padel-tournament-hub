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
 *
 * `Function.length` answers half of that and the half it answers is the easier one. A translation
 * that *declares* both arguments and writes only one of them into its sentence has the same hole
 * in the same screen, and it is the likelier version, because a sentence with a hole in it reads
 * perfectly right up until somebody needs the word that is missing. So the sentences are also
 * spoken twice, with one argument changed, and an argument that moves one dictionary and not the
 * other has gone missing from one of them (#71).
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
   * A key one dictionary has and the other does not, both ways round (#71).
   *
   * The type catches this in the direction that matters most — a missing entry is a build error —
   * but not in the other: an *extra* Lithuanian key whose shape happens to be compatible is
   * something `satisfies` will accept, and it is dead weight that reads as translated work still
   * to do. The walker is shown rejecting both, because a rule enforced in one direction is half a
   * rule.
   */
  it('would notice a key the Lithuanian is missing', () => {
    const missing = { ...copyEn, session: without(copyEn.session, 'done') };

    expect(driftBetween(copyEn, missing, 'copy')).toEqual([
      'copy.session.done is in one dictionary and not the other',
    ]);
  });

  it('would notice a key the English no longer has', () => {
    const extra = { ...copyEn, session: { ...copyEn.session, tabScores: 'Taškai' } };

    expect(driftBetween(copyEn, extra, 'copy')).toEqual([
      'copy.session.tabScores is in one dictionary and not the other',
    ]);
  });

  /*
   * Every argument a translated sentence was handed, still somewhere in the sentence (#71).
   *
   * This is the half of the arity question `Function.length` cannot answer. A Lithuanian function
   * that *declares* `(name, team)` and writes only `${name}` satisfies the type, satisfies the
   * drift walk above, and drops the team out of the middle of a screen — and it is the likeliest
   * way a 36-function translation goes wrong, because a sentence that reads perfectly in isolation
   * is a sentence nobody re-counts the holes in.
   *
   * Where the argument goes is not asserted, only that it goes somewhere. Lithuanian reorders
   * almost every sentence it translates and pinning positions would be pinning the grammar.
   */
  it('carry every argument they are handed into the sentence', () => {
    expect(interpolationDriftBetween(copyEn, copyLt, 'copy')).toEqual([]);
  });

  it('would notice a sentence that declared an argument and never said it', () => {
    const silent = {
      ...copyEn,
      players: { ...copyEn.players, options: declaring(1, () => 'Parinktys') },
    };

    expect(interpolationDriftBetween(copyEn, silent, 'copy')).toEqual([
      'copy.players.options carries argument 1 into the sentence in one dictionary and not the other',
    ]);
  });

  /*
   * The one that reads as finished, which is why it is here as well as the empty sentence above.
   * A partner joining a team is a complete Lithuanian sentence with the team taken out of it, and
   * nothing but this walk is going to notice that it no longer says which team.
   */
  it('would notice a sentence that dropped the second of two arguments', () => {
    const half = {
      ...copyEn,
      players: {
        ...copyEn.players,
        preview: {
          ...copyEn.players.preview,
          confirmPartner: declaring(2, (name) => `${name} prisijungia`),
        },
      },
    };

    expect(interpolationDriftBetween(copyEn, half, 'copy')).toEqual([
      'copy.players.preview.confirmPartner carries argument 2 into the sentence in one dictionary and not the other',
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
    expect(summaries(SPOT_CHECKS)).toEqual([
      'Americano · 1 žaidėjas',
      'Americano · 3 žaidėjai',
      'Americano · 11 žaidėjų',
      'Americano · 21 žaidėjas',
      'Americano · 111 žaidėjų',
    ]);
  });

  it('inflects the same numbers in English, where there are only two answers', () => {
    const english = SPOT_CHECKS.map((size) => copyEn.session.summary('americano', size));

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
    expect(leavesBehind(1)).toContain('paliks 1 vakarą —');
    expect(leavesBehind(3)).toContain('paliks 3 vakarus —');
    expect(leavesBehind(11)).toContain('paliks 11 vakarų —');
    expect(leavesBehind(21)).toContain('paliks 21 vakarą —');
    expect(leavesBehind(111)).toContain('paliks 111 vakarų —');
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
   * verb: `ištrinti` is what history does to an evening, and it must not be what the Players tab
   * does to a person. Asserted because the softness is the whole of the term and it is invisible
   * to anybody reading the file in English.
   *
   * The *wording* is not asserted anywhere here, deliberately. #70 leaves **went home**,
   * **bench**, **needs partner** and **v** to a native speaker, and a test that pinned the
   * drafter's guess would turn their correction into a red build — which is exactly backwards.
   * What is asserted is the constraint the reviewer is being asked to keep.
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
  });

  /**
   * The badge, the action that produces it and the confirmation say the same words, because they
   * record the same fact — which is a claim about this file rather than about the language.
   */
  it('says went home in one wording wherever it says it', () => {
    expect(copyLt.players.wentHome).toBe(copyLt.players.gone);
    expect(copyLt.players.preview.confirmDeparture('Ana')).toContain(
      copyLt.players.gone.toLowerCase(),
    );
  });

  /*
   * **Bench**, **bye** and **went home** are three terms in the glossary, and a player off a court
   * is not a player who has left. Three different words, asserted as different rather than as any
   * particular three — the reviewer settles which they are.
   */
  it('keeps the bench, the bye and going home apart', () => {
    const bench = copyLt.round.bench(['Ana']);
    const bye = copyLt.round.bye(['Ana ir Benas']);

    expect(new Set([copyLt.players.benched, copyLt.players.gone]).size).toBe(2);
    expect(bench.startsWith(copyLt.players.benched)).toBe(true);
    expect(bye.startsWith(copyLt.players.benched)).toBe(false);
    expect(bench).not.toContain(copyLt.players.gone);
  });
});

describe('the parity walk over the dictionaries', () => {
  /*
   * The walk, shown able to speak about every argument it is asked about.
   *
   * `carriesArgument` answers "no probe moved this one" by saying nothing, which is the honest
   * answer and is also indistinguishable from a check that has quietly stopped working. A function
   * added to the dictionaries whose arguments none of the pairs above can vary would be waved
   * through in silence, and the parity claim would be a little smaller than it reads. So the
   * silence is counted here: if this fails, the ladder needs a rung, not a suppression.
   */
  it('can speak about every argument the dictionaries take', () => {
    const unprobed = functionsIn(copyEn, copyLt, 'copy').flatMap(([left, right, path]) =>
      argumentsOf(left, right)
        .filter((index) => carriesArgument(left, right, index) === null)
        .map((index) => `${path} argument ${index + 1}`),
    );

    expect(unprobed).toEqual([]);
  });
});

/** The numbers ADR-0032 §4 names: 11 and 21 disagree, and 111 agrees with 11 rather than with 1. */
const SPOT_CHECKS = [1, 3, 11, 21, 111] as const;

function leavesBehind(evenings: number): string {
  return copyLt.identity.adoptConfirm('ana@example.com', evenings).lead;
}

/**
 * The two dictionaries walked together, and whatever `answer` has to say about each pair of values
 * that sit at the same path. `null` from `answer` means "not what I am looking for, keep going
 * down"; a list means it has answered and this branch is finished.
 *
 * Two of the three walks in this file are this one with a different question at the leaves —
 * "are these the same string" and "are these both functions". `driftBetween` is deliberately not
 * built on it: this walk descends into the keys the dictionaries *share*, and the whole of that
 * one's job is the keys they do not.
 */
function walkingBoth<T>(
  left: unknown,
  right: unknown,
  path: string,
  answer: (left: unknown, right: unknown, path: string) => T[] | null,
): T[] {
  const answered = answer(left, right, path);
  if (answered !== null) {
    return answered;
  }

  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return [];
  }

  const ours = left as Record<string, unknown>;
  const theirs = right as Record<string, unknown>;

  return Object.keys(ours).flatMap((key) =>
    key in theirs ? walkingBoth(ours[key], theirs[key], `${path}.${key}`, answer) : [],
  );
}

/** Every plain string the two dictionaries write identically, named by the path it sits at. */
function sharedStringsBetween(left: unknown, right: unknown, path: string): string[] {
  return walkingBoth(left, right, path, (ours, theirs, at) =>
    typeof ours === 'string' && typeof theirs === 'string' ? (ours === theirs ? [at] : []) : null,
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

/**
 * One dictionary branch with a key taken out of it, for showing the drift walk bite.
 *
 * Built by name rather than by destructuring the key away, because the discarded half of a
 * destructure is a binding nothing reads and the linter is right to ask what it is for.
 */
function without<T extends object>(branch: T, key: keyof T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(branch).filter(([name]) => name !== key));
}

/**
 * A sentence that declares more arguments than it says, which is exactly the fault the
 * interpolation walk exists to find and is a fault a test cannot simply write down: a parameter
 * left unused on purpose is indistinguishable, to everything except a reader, from one left unused
 * by accident. So the arity is stated and the body only takes what it actually uses.
 */
function declaring(arity: number, sentence: DictionaryFunction): DictionaryFunction {
  return Object.defineProperty(sentence, 'length', { value: arity }) as DictionaryFunction;
}

/*
 * The probe values, and the reason there is a ladder of them rather than one.
 *
 * An argument's presence in a sentence is found by handing the function two different values for
 * one parameter and seeing whether the sentence changes — which needs a pair of values that
 * parameter will actually accept. The dictionaries take five kinds of argument between them —
 * modes, genders, plain names, counts and lists of names — and nothing at runtime says which is
 * which. (`identity.kept` also accepts `null`, which needs no rung of its own: it is the absent
 * half of an account the string pair already moves.) So each pair is tried in turn and the first
 * one that makes *either* dictionary's sentence move is the one that answers. A pair the parameter cannot
 * use either throws — `names.join` on a number — or produces the same answer twice, and both read
 * as "this pair says nothing", which is the next pair's cue.
 *
 * The zero is last and is there for one entry. `standings.total` reads two of its three arguments
 * without ever printing them: they choose between a dash and a figure (ADR-0023 §2), and no pair
 * of ordinary counts moves that branch. A pair that is zero on one side does, which is the
 * difference between an argument this walk can speak about and one it has to pass over.
 */
const PROBES: readonly (readonly [unknown, unknown])[] = [
  ['americano', 'mixicano'],
  [3, 7],
  [['Ana'], ['Benas']],
  ['woman', 'man'],
  [0, 4],
];

/** Every place the two dictionaries both hold a function, paired up and named by its path. */
function functionsIn(
  left: unknown,
  right: unknown,
  path: string,
): [DictionaryFunction, DictionaryFunction, string][] {
  return walkingBoth(left, right, path, (ours, theirs, at) =>
    typeof ours === 'function' && typeof theirs === 'function'
      ? [[ours as DictionaryFunction, theirs as DictionaryFunction, at]]
      : null,
  );
}

type DictionaryFunction = (...args: readonly unknown[]) => unknown;

/**
 * How many arguments the pair can be asked about: the shorter of the two.
 *
 * A disagreement about the count is `driftBetween`'s to report and reporting it twice, in two
 * vocabularies, would make one fault read as two.
 */
function arityOf(left: DictionaryFunction, right: DictionaryFunction): number {
  return Math.min(left.length, right.length);
}

/** The positions there are to ask about, as indices, so a caller can map over them. */
function argumentsOf(left: DictionaryFunction, right: DictionaryFunction): number[] {
  return Array.from({ length: arityOf(left, right) }, (_, index) => index);
}

/**
 * What a dictionary entry says when handed these arguments, or `null` if it cannot be handed them.
 *
 * A throw is `null` rather than a failure, because most of them are this walk's own fault — a rung
 * of the ladder offering a number to something that wanted a list. An entry that throws on every
 * rung loses every rung, which is the silence the coverage test above counts.
 *
 * Serialised rather than compared directly because `identity.adoptConfirm` answers with an object
 * — a lead and a confirmation — and an argument that vanished from either half of it has vanished.
 */
function sentenceOf(entry: DictionaryFunction, args: readonly unknown[]): string | null {
  try {
    return JSON.stringify(entry(...args)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether each of the two functions carries argument `index` into what it says — or `null` where
 * no probe pair could move either of them, which is not a disagreement and is not reported.
 */
function carriesArgument(
  left: DictionaryFunction,
  right: DictionaryFunction,
  index: number,
): readonly [boolean, boolean] | null {
  for (const [held, changed] of PROBES) {
    const before = Array.from({ length: arityOf(left, right) }, () => held);
    const after = before.map((value, at) => (at === index ? changed : value));

    const said = [
      sentenceOf(left, before),
      sentenceOf(left, after),
      sentenceOf(right, before),
      sentenceOf(right, after),
    ];
    if (said.some((sentence) => sentence === null)) {
      continue;
    }

    const [leftBefore, leftAfter, rightBefore, rightAfter] = said;
    if (leftBefore === leftAfter && rightBefore === rightAfter) {
      continue;
    }

    return [leftBefore !== leftAfter, rightBefore !== rightAfter];
  }

  return null;
}

/**
 * Every argument one dictionary says and the other silently swallows, named by the path and the
 * position it happens at.
 *
 * The companion to `driftBetween`, which proves a translated function *declares* the arguments its
 * counterpart does. Declaring them is what TypeScript can be made to check; using them is not, and
 * a Lithuanian sentence that takes a team and never mentions it is a hole on a screen the compiler
 * has already called fine (#71).
 *
 * Two things it does not claim, both of them consequences of being a *parity* check rather than a
 * rule about any one sentence. A hole both dictionaries share is invisible here, because there is
 * nothing to disagree about — an argument the English never says either is a question for whoever
 * wrote the English, and this walk would have to be told what every function means to answer it.
 * And "carries" means the argument changes what comes out, which is not quite the same as being
 * printed: one that only picks a plural form or chooses the dash in `standings.total` counts as
 * carried, because from outside the function there is no way to tell those apart.
 */
function interpolationDriftBetween(left: unknown, right: unknown, path: string): string[] {
  return functionsIn(left, right, path).flatMap(([ours, theirs, at]) =>
    argumentsOf(ours, theirs).flatMap((index) => {
      const carried = carriesArgument(ours, theirs, index);

      return carried === null || carried[0] === carried[1]
        ? []
        : [
            `${at} carries argument ${index + 1} into the sentence in one dictionary and not ` +
              `the other`,
          ];
    }),
  );
}
