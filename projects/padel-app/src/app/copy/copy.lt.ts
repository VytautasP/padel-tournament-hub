/*
 * Every string the organizer can read, in Lithuanian (ADR-0032 §1).
 *
 * `copy.en.ts` is the source of truth for the *shape* and this file is one instance of it: it ends
 * `satisfies Copy`, so an entry deleted here, renamed here, or added there and forgotten here is a
 * build error. There is no runtime fallback to English and there is deliberately no key echoed at
 * somebody standing on a court — a dictionary either compiles or it does not ship.
 *
 * **It carries no rationale comments, and that is not an oversight.** Why an entry exists, what it
 * is careful not to say, and which decision put it there are facts about the string rather than
 * about the language, and they are written once, beside the English. Two copies of an essay is two
 * copies to keep true. Read `copy.en.ts` alongside this file when the wording is in question.
 *
 * **The glossary's distinctions survive into Lithuanian in these words** (`CONTEXT.md`). They are
 * listed here rather than beside each entry because the point of each of them is the *other* word
 * it is not, and a pair is only legible written down together:
 *
 * - **bench** is `nežaidžia` and **bye** is `raundą praleidžia` — the player who is off a court
 *   this round, and the whole team that is. Two words, as in English, because a team that sits out
 *   sits out together and two loose names would read as two people who happen to be free.
 * - **went home** is `išėjo namo`, which is where a person goes rather than something done to a
 *   row. `Ištrinti` — the Lithuanian for deleting — appears in this file only where an evening
 *   actually is deleted: history, and discarding from the front door.
 * - **device identity** is `ši naršyklė` and a **linked account** is `Google paskyra`. The front
 *   door says which of the two is keeping the history, in those words, and never calls either one
 *   the other.
 * - a **stranded evening** is `vakaras, kuris lieka jį sukūrusiai naršyklei` and an **orphaned
 *   team** is one that `reikia partnerio` — an evening nobody can list again, and a team short a
 *   player. Neither is called the other's word, and neither is called deleted.
 * - **joint position** is not a **tie**: `lygiosios` is one drawn match and lives only in the
 *   record triple, while the podium simply repeats a shared place rather than naming it.
 *
 * Two English pairs do collapse, and are called out rather than hidden. `Lentelė` is the word for
 * **standings** that a Lithuanian club actually says, and it is also the word `CONTEXT.md` tells
 * English to avoid — there is no second noun here to keep the two apart. And `nežaidžia` is true
 * of a player who **went home** as well as of one on the **bench**; what keeps them apart on
 * screen is that the badges never both appear on a row, not the words themselves.
 *
 * **Plurals are asked of `Intl.PluralRules`, never written as a ternary** (ADR-0032 §4). Lithuanian
 * has three forms where English has two and the rule is about the last two digits, so `11 žaidėjų`
 * and `21 žaidėjas` disagree in a way no hand-written modulo gets right at `111`. Case matters too:
 * a roster names itself in the nominative and is asked for in the genitive, which is two sets of
 * forms for one noun rather than one — `playerCountIn` and `genitive` below. The one number that
 * does *not* go through the rules is the round a header names: `3 raundas` is an ordinal, and an
 * ordinal does not agree with anything.
 *
 * **What is still English here is English on purpose** (ADR-0032 §5): the three mode names and the
 * product's, shared out of `names.ts` so that neither dictionary can translate them, and
 * `Lietuvių` / `English` in the language sheet, each named in the language it is.
 *
 * **This file has not been read by a native speaker** and the ticket that wrote it does not merge
 * until one has. Four terms are club vernacular that a dictionary translates and a player never
 * says, and the drafter's answer to each is a proposal rather than a decision: `nežaidžia` for
 * **bench**, `reikia partnerio` for **needs partner**, `išėjo namo` for **went home**, and `prieš`
 * for **v** — one character in English and six here, in the middle of a scoreline.
 *
 * Four more are coinages rather than translations, and are named here so that the reviewer can
 * find them without reading all 180: `Perg.–Lyg.–Pral.` for the record triple, `Pjedestalas` for
 * the podium, `Lentelė` for the standings, and `Nežaidė raundų` for the count of rounds sat out.
 */
import type { Gender, SessionMode } from 'padel-engine';
import { LOCALES } from '../preference/language';
import type { Language } from '../preference/language';
import type { Theme } from '../preference/theme';
import type { Copy } from './copy.en';
import { appName, modeNames } from './names';
import { countIn } from './plural';

/** This dictionary's plural rules, built once — three forms where English has two. */
const counted = countIn(LOCALES.lt);

const genderNames: Readonly<Record<Gender, string>> = {
  woman: 'Moteris',
  man: 'Vyras',
};

const googleAccount = 'jūsų Google paskyra';

const shareHeading = 'Dalintis šia sesija';

const settingsHeading = 'Nustatymai';

/** **Went home**, in the one wording the badge, the action and the confirmation all share. */
const wentHome = 'Išėjo namo';

export const copyLt = {
  appName,

  connection: {
    heading: 'Nėra ryšio su jūsų sesijomis',
    lead: `${appName} nepavyko pasiekti jūsų sesijų. Pirmą kartą atidarius programą įrenginyje jai reikia ryšio, kad pasiruoštų; vėliau ji veikia aikštelėje ir visai be signalo.`,
    hint: 'Raskite signalą arba Wi-Fi ir atidarykite programą iš naujo.',
  },

  landing: {
    tagline: 'Vienas padelio vakaras, valdomas telefonu.',
    newSession: 'Nauja sesija',
    resumeHeading: 'Vyksta sesija',
    resume: 'Tęsti',
    resumeSummary: (mode: SessionMode, playerCount: number, roundNumber: number): string =>
      `${modeAndSize(mode, playerCount)} · ${roundNumber} raundas`,
    options: 'Sesijos parinktys',
    optionsGlyph: '⋯',
    discard: 'Atsisakyti',
    discardConfirm: {
      heading: 'Atsisakyti šios sesijos?',
      lead: 'Vakaras dings visam laikui — jo raundai, rezultatai ir lentelė. Istorijoje jis neišliks.',
      action: 'Atsisakyti sesijos',
    },
  },

  identity: {
    browserOnly: 'Istorija saugoma šioje naršyklėje. Išvalius jos duomenis ji dings.',
    kept: (account: string | null): string => `Istorija saugoma su ${account ?? googleAccount}.`,
    keep: 'Saugoti istoriją su Google',
    unavailable: 'Susieti su Google nepavyko. Bandykite dar kartą.',
    adoptConfirm: (account: string | null, evenings: number) => ({
      heading: 'Naudoti šią Google paskyrą?',
      lead:
        `${account ?? googleAccount} jau saugo istoriją iš kitos naršyklės. ` +
        (evenings === 0
          ? 'Prisijungus ta istorija atsiras čia, o ši naršyklė neturi savos, kurią paliktų.'
          : `Prisijungus ta istorija atsiras čia, o ši naršyklė visam laikui paliks ${eveningCount(evenings)} — vakaras priklauso jį sukūrusiai naršyklei ir negali būti perkeltas.`),
      action: 'Naudoti šią paskyrą',
    }),
  },

  wizard: {
    back: 'Atgal',
    next: 'Toliau',
    cancel: 'Atšaukti',

    mode: {
      heading: 'Koks formatas?',
      lead: 'Visam vakarui — pasirinkite tą, dėl kurio susitarėte.',
      name: (mode: SessionMode): string => modeNames[mode],
      blurb: (mode: SessionMode): string => modeBlurbs[mode],
    },

    players: {
      heading: 'Kas žaidžia?',
      lead: 'Vardai. Įrašykite vieną, spauskite pridėti, rašykite kitą.',
      placeholder: 'Vardas',
      add: 'Pridėti',
      save: 'Išsaugoti',
      edit: (name: string): string => `Taisyti ${name}`,
      remove: (name: string): string => `Pašalinti ${name}`,
      count: playerCountIn,
      tooFew: (minimum: number): string =>
        `Sesijai reikia bent ${genitive(minimum, 'žaidėjo', 'žaidėjų')}.`,
      genderMissing: 'Mixicano poruoja skirtingas lytis, todėl jos reikia kiekvienam žaidėjui.',
      oddRoster:
        'Team Americano žaidžiama pastoviomis poromis, todėl žaidėjų turi būti lyginis skaičius.',
    },

    pairing: {
      heading: 'Kas su kuo žaidžia?',
      lead: 'Palieskite du vardus, kad juos suporuotumėte. Kiekvienas žaidėjas yra komandoje.',
      teams: 'Komandos',
      unpaired: 'Dar be poros',
      choose: (name: string): string => `Poruoti ${name}`,
      unpair: (team: string): string => `Išardyti ${team}`,
      unpairedRemain: 'Prieš sukuriant vakarą kiekvienas žaidėjas turi turėti porą.',
    },

    review: {
      heading: 'Peržiūra ir kūrimas',
      lead: 'Pakeiskite, kas netinka. Raundų galima pridėti ir žaidžiant.',
      mode: 'Formatas',
      players: 'Žaidėjai',
      targetScore: 'Tikslinis rezultatas',
      courtCount: 'Aikštelės',
      roundCount: 'Raundai',
      courtNames: 'Aikštelių pavadinimai',
      courtName: (courtNumber: number): string => `Aikštelės ${courtNumber} pavadinimas`,
      create: 'Sukurti sesiją',
    },
  },

  session: {
    round: 'Raundas',
    standings: 'Lentelė',
    players: 'Žaidėjai',
    summary: modeAndSize,
    done: 'Atlikta',
  },

  spectator: {
    summary: modeAndSize,
    gone: {
      heading: 'Šios sesijos nebėra',
      lead: 'Su šiuo kodu jokio vakaro nėra. Ištrinta sesija yra ištrinta visiems, ir čia nieko atkurti nebeįmanoma.',
    },
  },

  settings: {
    open: settingsHeading,
    heading: settingsHeading,
    openGlyph: '⚙',
    theme: {
      heading: 'Tema',
      answers: {
        system: 'Sistemos',
        light: 'Šviesi',
        dark: 'Tamsi',
      } satisfies Record<Theme, string>,
    },
    language: {
      heading: 'Kalba',
      answers: {
        en: 'English',
        lt: 'Lietuvių',
      } satisfies Record<Language, string>,
    },
    done: 'Atlikta',
  },

  share: {
    open: shareHeading,
    heading: shareHeading,
    lead: 'Kiekvienas, turintis kodą, gali stebėti šį vakarą. Pakeisti jo negali.',
    qr: 'Šios sesijos QR kodas',
    qrUnavailable: 'QR kodui nupiešti reikia ryšio. Žemiau esantis kodas veikia ir be jo.',
    code: 'Dalijimosi kodas',
    copyLink: 'Kopijuoti nuorodą',
    copied: 'Nuoroda nukopijuota.',
    copyFailed: 'Nuorodos nukopijuoti nepavyko. Vietoj to perskaitykite kodą balsu.',
    done: 'Atlikta',
  },

  round: {
    heading: (roundNumber: number, roundCount: number): string =>
      `${roundNumber} raundas iš ${genitive(roundCount, 'raundo', 'raundų')}`,
    courtName: (courtNumber: number): string => `Aikštelė ${courtNumber}`,
    side: (names: readonly string[]): string => names.join(' ir '),
    versus: 'prieš',
    noScore: 'Rezultato dar nėra',
    bench: (names: readonly string[]): string => `Nežaidžia: ${names.join(', ')}`,
    bye: (teams: readonly string[]): string => `Raundą praleidžia: ${teams.join(', ')}`,
    previous: 'Ankstesnis raundas',
    previousGlyph: '←',
    next: 'Kitas raundas',
    nextGlyph: '→',
    backToCurrent: 'Grįžti į dabartinį raundą',
    advance: (roundNumber: number): string => `${roundNumber} raundas →`,
    addRound: {
      heading: 'Vakaras baigiasi čia',
      lead: 'Dar vienas raundas suplanuojamas pagal viską, kas jau sužaista. Niekas prieš jį nepasikeičia.',
      action: 'Pridėti raundą',
    },
    enterScore: (courtName: string): string => `${courtName}: įvesti rezultatą`,
    sameGender: {
      mark: '*',
      markLabel: 'Tos pačios lyties pora',
      legend: '* Tos pačios lyties pora: sąraše neliko kitos lyties žaidėjo porai.',
    },
  },

  players: {
    placeholder: 'Vardas',
    add: 'Pridėti',
    benched: 'Nežaidžia',
    gone: wentHome,
    options: (name: string): string => `${name} parinktys`,
    optionsGlyph: '⋯',
    wentHome,
    nobodyCanLeave: (minimum: number): string =>
      `Sesijai reikia bent ${genitive(minimum, 'žaidėjo', 'žaidėjų')}, todėl iš šios niekas negali išeiti namo.`,
    noTeamCanLose: (teams: number): string =>
      `Raundui reikia ${genitive(teams, 'komandos', 'komandų')} su abiem žaidėjais, todėl iš šios sesijos niekas negali išeiti namo.`,
    arrivalsJoinATeam:
      'Team Americano žaidžiama pastoviomis poromis, todėl naujas žaidėjas prisijungia prie komandos, kuriai reikia partnerio.',
    genderMissing: 'Mixicano poruoja skirtingas lytis, todėl jos reikia ir naujam žaidėjui.',
    needsPartner: 'Reikia partnerio',
    assignPartner: 'Priskirti partnerį',
    assignPartnerTo: (team: string): string => `Priskirti partnerį komandai ${team}`,
    partner: {
      heading: 'Priskirti partnerį',
      lead: 'Visi čia jau turi porą, todėl į komandą įsijungia naujas vardas.',
      dismiss: 'Ne dabar',
    },
    preview: {
      heading: 'Likusi vakaro dalis',
      lead: 'Visi raundai nuo čia suplanuojami iš naujo. Jau sužaisti raundai nesikeičia.',
      dismiss: 'Nekeisti sąrašo',
      confirmArrival: (name: string): string => `Pridėti ${name}`,
      confirmDeparture: (name: string): string => `${name} išėjo namo`,
      confirmPartner: (name: string, team: string): string =>
        `${name} prisijungia prie komandos ${team}`,
    },
  },

  score: {
    outOf: (targetScore: number): string => `iš ${targetScore}`,
    tooHigh: (targetScore: number): string => `Rezultatas negali būti didesnis nei ${targetScore}.`,
    save: 'Išsaugoti',
    cancel: 'Atšaukti',
  },

  standings: {
    podium: 'Pjedestalas',
    end: 'Baigti sesiją',
    endConfirm: {
      heading: 'Baigti sesiją?',
      lead: 'Nuo šiol lentelė galutinė: jokių naujų rezultatų, raundų ar sąrašo pakeitimų. To atšaukti nebus galima.',
      action: 'Baigti sesiją',
    },
    total: (points: number, matchesPlayed: number, benched: number): string =>
      matchesPlayed === 0 && benched === 0
        ? '–'
        : Number.isInteger(points)
          ? String(points)
          : points.toFixed(1),
    record: 'Perg.–Lyg.–Pral.',
    recordOf: (won: number, tied: number, lost: number): string => `${won}–${tied}–${lost}`,
    matchesPlayed: 'Sužaista rungtynių',
    benched: 'Nežaidė raundų',
  },

  history: {
    heading: 'Sesijų istorija',
    row: (day: string, mode: SessionMode, playerCount: number): string =>
      `${day} · ${modeAndSize(mode, playerCount)}`,
    winner: (names: readonly string[]): string => `Laimėjo ${names.join(' ir ')}`,
    delete: (title: string): string => `Ištrinti ${title}`,
    deleteGlyph: '×',
    deleteConfirm: {
      heading: 'Ištrinti šią sesiją?',
      lead: 'Vakaras dings visam laikui — jo raundai, rezultatai ir galutinė lentelė. Nieko iš to atkurti nebus galima.',
      action: 'Ištrinti sesiją',
    },
  },

  gender: {
    name: (gender: Gender): string => genderNames[gender],
    choose: (name: string, gender: Gender): string =>
      `${name} yra ${genderNames[gender].toLowerCase()}`,
  },

  team: {
    name: (names: readonly string[]): string => names.join(' ir '),
  },

  confirm: {
    cancel: 'Atšaukti',
  },
} as const satisfies Copy;

function modeAndSize(mode: SessionMode, playerCount: number): string {
  return `${modeNames[mode]} · ${playerCountIn(playerCount)}`;
}

/** `3 žaidėjai` — a roster naming itself, which Lithuanian does in the nominative. */
function playerCountIn(playerCount: number): string {
  return counted(playerCount, { one: 'žaidėjas', few: 'žaidėjai', other: 'žaidėjų' });
}

/**
 * A counted noun in the genitive, which `reikia` and `iš` both govern: `bent 4 žaidėjų`,
 * `2 komandų`, `iš 12 raundų`.
 *
 * Two forms rather than three, because the genitive is where Lithuanian's `few` and `other`
 * collapse into one word — `4 žaidėjų` and `11 žaidėjų` — and only the singular parts company at
 * 1, 21 and 121. Written once here rather than three times at three call sites, so that the rule
 * is a fact about the language rather than something spelled identically in three places.
 */
function genitive(count: number, singular: string, plural: string): string {
  return counted(count, { one: singular, few: plural, other: plural });
}

function eveningCount(evenings: number): string {
  return counted(evenings, { one: 'vakarą', few: 'vakarus', other: 'vakarų' });
}

const modeBlurbs: Readonly<Record<SessionMode, string>> = {
  americano: 'Poros keičiasi kas raundą. Kiekvienas žaidžia su kiekvienu.',
  mixicano: 'Poros keičiasi ir sudaromos iš skirtingų lyčių, kiek leidžia sąrašas.',
  'team-americano': 'Jūsų pasirinktos pastovios poros. Vertinama komanda.',
};
