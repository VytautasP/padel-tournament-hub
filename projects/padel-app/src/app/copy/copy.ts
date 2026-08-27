/*
 * Every string the organizer can read (decision #20).
 *
 * No template in this app writes a word of its own. That is not a translation feature — the app
 * is English-only and will stay that way — it is so that adding Transloco later is wiring rather
 * than template archaeology, and so that the whole voice of the product can be read in one file
 * and made consistent.
 *
 * Strings that need a value in the middle are functions rather than templates with a placeholder
 * to substitute, so the compiler checks that what a screen has to say is a thing it actually
 * knows. `tools/verify-app-conventions.mjs` proves no template has quietly grown a literal.
 */
import type { SessionMode } from 'padel-engine';

export const modeNames: Readonly<Record<SessionMode, string>> = {
  americano: 'Americano',
  mixicano: 'Mixicano',
  'team-americano': 'Team Americano',
};

export const copy = {
  appName: 'Padel Tournament Hub',

  landing: {
    tagline: 'One padel evening, run from your phone.',
    newSession: 'New session',
    resumeHeading: 'Session in progress',
    resume: 'Resume',
    resumeSummary: (mode: SessionMode, playerCount: number, roundNumber: number): string =>
      `${modeAndSize(mode, playerCount)} · round ${roundNumber}`,
    /**
     * The overflow on the Resume card, and the one thing in it.
     *
     * Discard is here rather than inside the session because an evening is never discarded from
     * the side of a court (ADR-0013 §3). The overflow is what keeps it one deliberate tap away
     * from the button beside it, which is the one the organizer actually wants.
     */
    options: 'Session options',
    /** The overflow itself is a glyph; the sentence beside it is what a screen reader announces. */
    optionsGlyph: '⋯',
    discard: 'Discard',
    discardConfirm: {
      heading: 'Discard this session?',
      lead: 'The evening goes for good — its rounds, its scores and its table. It is not kept in history.',
      action: 'Discard session',
    },
  },

  wizard: {
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',

    mode: {
      heading: 'Which format?',
      lead: 'Fixed for the evening — pick the one the group agreed on.',
      notYet: 'Coming soon',
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
        playerCount === 1 ? '1 player' : `${playerCount} players`,
      tooFew: (minimum: number): string => `A session needs at least ${minimum} players.`,
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
      /**
       * The label beside one court's name field.
       *
       * It names the slot rather than the court, because the field beside it is where the court
       * gets its name — "Court 2 name" still means something once the field says "Far end".
       */
      courtName: (courtNumber: number): string => `Court ${courtNumber} name`,
      create: 'Create session',
    },
  },

  session: {
    round: 'Round',
    standings: 'Standings',
    players: 'Players',
    /**
     * The way out of a session that has ended.
     *
     * A session in progress has no way out (ADR-0016) — leaving it is ending it or discarding it.
     * A finished one is a record being read rather than an evening being run, so it has a door,
     * and the door is the same whether the organizer just closed the night or opened it out of
     * history a week later.
     */
    done: 'Done',
  },

  round: {
    heading: (roundNumber: number, roundCount: number): string =>
      `Round ${roundNumber} of ${roundCount}`,
    /**
     * A court named by its number: what Review pre-fills a name field with, and what a court
     * whose field was left blank is called on the schedule (ADR-0017 §6).
     */
    courtName: (courtNumber: number): string => `Court ${courtNumber}`,
    side: (names: readonly string[]): string => names.join(' & '),
    versus: 'v',
    noScore: 'No score yet',
    bench: (names: readonly string[]): string => `Sitting out: ${names.join(', ')}`,
    /** The result on the court card. An en dash, because it is a scoreline and not a subtraction. */
    score: (sideA: number, sideB: number): string => `${sideA} – ${sideB}`,
    /**
     * The paging controls. Each is an arrow on screen and a sentence to a screen reader: the
     * glyph is all a thumb needs beside a header that already says which round this is, and
     * "Previous" alone would not say previous *what* to somebody who cannot see the header.
     */
    previous: 'Previous round',
    previousGlyph: '←',
    next: 'Next round',
    nextGlyph: '→',
    /** The way back from wherever the organizer paged to (ADR-0016 §2). */
    backToCurrent: 'Back to current round',
    /**
     * The call to action on a round every court of which has been scored (ADR-0016 §3).
     *
     * It names the round it goes to rather than saying "next", because the screen does not move
     * on its own and the organizer is being offered a destination, not told where they now are.
     */
    advance: (roundNumber: number): string => `Round ${roundNumber} →`,
    /** The card past the last round, which is where "have we time for another?" gets asked. */
    addRound: {
      heading: 'The evening ends here',
      lead: 'One more round is planned against everything already played. Nothing behind it moves.',
      action: 'Add round',
    },
    /**
     * What tapping a court does. One wording whether or not the court has a score already:
     * correcting a typo is the ordinary path (ADR-0007), not a second, differently-named action.
     *
     * It says the court's name rather than its number, because the name is what the organizer is
     * looking at and a label that disagreed with the card would be the one thing on the screen
     * still sending people to the wrong end of the building.
     */
    enterScore: (courtName: string): string => `Enter score for ${courtName}`,
  },

  score: {
    /** Beside each field, because `17` means nothing without `of 24` (ADR-0014). */
    outOf: (targetScore: number): string => `of ${targetScore}`,
    tooHigh: (targetScore: number): string => `A score cannot be more than ${targetScore}.`,
    save: 'Save',
    cancel: 'Cancel',
  },

  standings: {
    /**
     * The top three, above the table rather than on a screen of their own.
     *
     * The top three *are* the standings (ADR-0016 §6), so a podium screen would render the same rows
     * twice. What the block adds is the pause at the end of the evening — and it repeats a joint
     * first rather than picking a winner, because the engine declared the tie and the app does
     * not break it (decision #8).
     */
    podium: 'Podium',
    /** The ending, in the footer of the table it makes final (ADR-0016 §6). */
    end: 'End session',
    endConfirm: {
      heading: 'End the session?',
      lead: 'The table is final from here: no more scores, no more rounds, no roster changes. This cannot be undone.',
      action: 'End session',
    },
    /**
     * Points per match, or a dash for somebody who has not been on a scored court yet.
     *
     * A zero would be a claim about how they are playing. A dash says the evening has not
     * answered the question, which before the first score is the truth about everybody.
     */
    rate: (pointsPerMatch: number, matchesPlayed: number): string =>
      matchesPlayed === 0 ? '–' : pointsPerMatch.toFixed(1),
    matchesPlayed: 'Matches played',
    totalPoints: 'Total points',
  },

  history: {
    heading: 'Session history',
    /**
     * A row names itself: when the evening was, what it played and how many played it.
     *
     * There is no name field in the wizard (ADR-0013 §4), so this is the whole of a session's
     * identity in a list. The year is absent on purpose — a list of a year's Tuesdays does not
     * need telling which year each of them was.
     */
    row: (day: string, mode: SessionMode, playerCount: number): string =>
      `${day} · ${modeAndSize(mode, playerCount)}`,
    /** Who topped the final table. More than one name where the top place was joint. */
    winner: (names: readonly string[]): string => `${names.join(' & ')} won`,
    /** Names the row it deletes, because every row on the page carries one of these. */
    delete: (title: string): string => `Delete ${title}`,
    deleteGlyph: '×',
    deleteConfirm: {
      heading: 'Delete this session?',
      lead: 'The evening goes for good — its rounds, its scores and its final table. Nothing here can be recovered.',
      action: 'Delete session',
    },
  },

  /** The way out of any confirmation, which is the same way out of all of them. */
  confirm: {
    cancel: 'Cancel',
  },
} as const;

/**
 * What an evening is, in the two words both the Resume card and a history row use to say it.
 *
 * One expression rather than two identical ones, because a session summarised on the front door
 * and a session summarised in the list below it are the same sentence about the same thing, and
 * they should not be able to drift into disagreeing about the separator.
 */
function modeAndSize(mode: SessionMode, playerCount: number): string {
  return `${modeNames[mode]} · ${playerCount} players`;
}

/**
 * The day an evening was played, as a history row says it: `Wed 26 Aug`.
 *
 * Formatting lives here rather than beside the record because the weekday and the month are words
 * the organizer reads, and every word the organizer reads is in this file (decision #20). The
 * locale is named rather than taken from the device for the same reason: the dictionary is
 * English, so the date beside its words has to be too.
 */
const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function formatDay(instant: string): string {
  return dayFormat.format(new Date(instant));
}

const modeBlurbs: Readonly<Record<SessionMode, string>> = {
  americano: 'Partners rotate every round. Everyone plays with everyone.',
  mixicano: 'Partners rotate, paired across gender wherever the roster allows.',
  'team-americano': 'Fixed pairs you choose. The team is what gets ranked.',
};
