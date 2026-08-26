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
      `${modeNames[mode]} · ${playerCount} players · round ${roundNumber}`,
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
} as const;

const modeBlurbs: Readonly<Record<SessionMode, string>> = {
  americano: 'Partners rotate every round. Everyone plays with everyone.',
  mixicano: 'Partners rotate, paired across gender wherever the roster allows.',
  'team-americano': 'Fixed pairs you choose. The team is what gets ranked.',
};
