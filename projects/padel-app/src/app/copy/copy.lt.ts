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
 * **#69 translated the front door and the settings sheet. Everything else is still English here,
 * on purpose** — that ticket proved the machinery end to end and #70 replaces the rest in place,
 * with the compiler holding the shape still while it happens. An English string below is a string
 * nobody has got to yet, not a string that was decided against.
 *
 * **Nothing here has been read by a native speaker yet** (spec §8). Four terms are club vernacular
 * that a dictionary translates and a player never says, and none of them is settled: **bench**,
 * **needs partner**, **went home** — which `CONTEXT.md` defines as explicitly not a deletion, and
 * whose Lithuanian has to keep that softness — and **v** for versus. They are in the untranslated
 * half today, which is the honest place for them until somebody who plays has looked.
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
  woman: 'Woman',
  man: 'Man',
};

const googleAccount = 'jūsų Google paskyra';

const shareHeading = 'Share this session';

const settingsHeading = 'Nustatymai';

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
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',

    mode: {
      heading: 'Which format?',
      lead: 'Fixed for the evening — pick the one the group agreed on.',
      name: (mode: SessionMode): string => modeNames[mode],
      blurb: (mode: SessionMode): string => modeBlurbs[mode],
    },

    players: {
      heading: 'Who is playing?',
      lead: 'First names. Type one, hit add, type the next.',
      placeholder: 'Name',
      add: 'Add',
      save: 'Save',
      edit: (name: string): string => `Edit ${name}`,
      remove: (name: string): string => `Remove ${name}`,
      count: (playerCount: number): string =>
        counted(playerCount, { one: 'player', other: 'players' }),
      tooFew: (minimum: number): string => `A session needs at least ${minimum} players.`,
      genderMissing: 'Mixicano pairs across gender, so every player needs one.',
      oddRoster: 'Team Americano plays in fixed pairs, so the roster needs an even number.',
    },

    pairing: {
      heading: 'Who plays with whom?',
      lead: 'Tap two names to pair them. Every player is on a team.',
      teams: 'Teams',
      unpaired: 'Not yet paired',
      choose: (name: string): string => `Pair ${name}`,
      unpair: (team: string): string => `Break up ${team}`,
      unpairedRemain: 'Every player needs a partner before the evening can be created.',
    },

    review: {
      heading: 'Review & create',
      lead: 'Change anything you do not like. Rounds can be added during play.',
      mode: 'Format',
      players: 'Players',
      targetScore: 'Target score',
      courtCount: 'Courts',
      roundCount: 'Rounds',
      courtNames: 'Court names',
      courtName: (courtNumber: number): string => `Court ${courtNumber} name`,
      create: 'Create session',
    },
  },

  session: {
    round: 'Round',
    standings: 'Standings',
    players: 'Players',
    summary: modeAndSize,
    done: 'Done',
  },

  spectator: {
    summary: modeAndSize,
    gone: {
      heading: 'This session is gone',
      lead: 'There is no evening at this code. A session that has been deleted is deleted for everybody, and nothing here can be recovered.',
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
    lead: 'Anyone with the code can watch this evening. They cannot change it.',
    qr: 'QR code for this session',
    qrUnavailable: 'The QR needs a connection to draw. The code below works without one.',
    code: 'Share code',
    copyLink: 'Copy link',
    copied: 'Link copied.',
    copyFailed: 'The link did not copy. Read the code out instead.',
    done: 'Done',
  },

  round: {
    heading: (roundNumber: number, roundCount: number): string =>
      `Round ${roundNumber} of ${roundCount}`,
    courtName: (courtNumber: number): string => `Court ${courtNumber}`,
    side: (names: readonly string[]): string => names.join(' & '),
    versus: 'v',
    noScore: 'No score yet',
    bench: (names: readonly string[]): string => `Sitting out: ${names.join(', ')}`,
    bye: (teams: readonly string[]): string => `Bye: ${teams.join(', ')}`,
    previous: 'Previous round',
    previousGlyph: '←',
    next: 'Next round',
    nextGlyph: '→',
    backToCurrent: 'Back to current round',
    advance: (roundNumber: number): string => `Round ${roundNumber} →`,
    addRound: {
      heading: 'The evening ends here',
      lead: 'One more round is planned against everything already played. Nothing behind it moves.',
      action: 'Add round',
    },
    enterScore: (courtName: string): string => `Enter score for ${courtName}`,
    sameGender: {
      mark: '*',
      markLabel: 'Same-gender pair',
      legend: '* Same-gender pair: the roster left nobody of the other gender to partner.',
    },
  },

  players: {
    placeholder: 'Name',
    add: 'Add',
    benched: 'Sitting out',
    gone: 'Went home',
    options: (name: string): string => `Options for ${name}`,
    optionsGlyph: '⋯',
    wentHome: 'Went home',
    nobodyCanLeave: (minimum: number): string =>
      `A session needs at least ${minimum} players, so nobody can go home from this one.`,
    noTeamCanLose: (teams: number): string =>
      `A round needs ${teams} teams with both their players, so nobody can go home from this one.`,
    arrivalsJoinATeam:
      'Team Americano plays in fixed pairs, so a new player joins a team that needs a partner.',
    genderMissing: 'Mixicano pairs across gender, so a new player needs one.',
    needsPartner: 'Needs partner',
    assignPartner: 'Assign partner',
    assignPartnerTo: (team: string): string => `Assign partner to ${team}`,
    partner: {
      heading: 'Assign a partner',
      lead: 'Everyone here already has a partner, so a new name joins the team.',
      dismiss: 'Not now',
    },
    preview: {
      heading: 'The rest of the evening',
      lead: 'Every round from here is planned again. Rounds already played do not move.',
      dismiss: "Don't change the roster",
      confirmArrival: (name: string): string => `Add ${name}`,
      confirmDeparture: (name: string): string => `${name} went home`,
      confirmPartner: (name: string, team: string): string => `${name} joins ${team}`,
    },
  },

  score: {
    outOf: (targetScore: number): string => `of ${targetScore}`,
    tooHigh: (targetScore: number): string => `A score cannot be more than ${targetScore}.`,
    save: 'Save',
    cancel: 'Cancel',
  },

  standings: {
    podium: 'Podium',
    end: 'End session',
    endConfirm: {
      heading: 'End the session?',
      lead: 'The table is final from here: no more scores, no more rounds, no roster changes. This cannot be undone.',
      action: 'End session',
    },
    total: (points: number, matchesPlayed: number, benched: number): string =>
      matchesPlayed === 0 && benched === 0
        ? '–'
        : Number.isInteger(points)
          ? String(points)
          : points.toFixed(1),
    record: 'W–T–L',
    recordOf: (won: number, tied: number, lost: number): string => `${won}–${tied}–${lost}`,
    matchesPlayed: 'Matches played',
    benched: 'Benched',
  },

  history: {
    heading: 'Sesijų istorija',
    row: (day: string, mode: SessionMode, playerCount: number): string =>
      `${day} · ${modeAndSize(mode, playerCount)}`,
    winner: (names: readonly string[]): string => `Laimėjo ${names.join(' & ')}`,
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
      `${name} is a ${genderNames[gender].toLowerCase()}`,
  },

  team: {
    name: (names: readonly string[]): string => names.join(' & '),
  },

  confirm: {
    cancel: 'Atšaukti',
  },
} as const satisfies Copy;

function modeAndSize(mode: SessionMode, playerCount: number): string {
  return `${modeNames[mode]} · ${counted(playerCount, { one: 'žaidėjas', few: 'žaidėjai', other: 'žaidėjų' })}`;
}

function eveningCount(evenings: number): string {
  return counted(evenings, { one: 'vakarą', few: 'vakarus', other: 'vakarų' });
}

const modeBlurbs: Readonly<Record<SessionMode, string>> = {
  americano: 'Partners rotate every round. Everyone plays with everyone.',
  mixicano: 'Partners rotate, paired across gender wherever the roster allows.',
  'team-americano': 'Fixed pairs you choose. The team is what gets ranked.',
};
