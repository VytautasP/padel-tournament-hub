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
import type { Gender, SessionMode } from 'padel-engine';

export const modeNames: Readonly<Record<SessionMode, string>> = {
  americano: 'Americano',
  mixicano: 'Mixicano',
  'team-americano': 'Team Americano',
};

/**
 * The two answers Mixicano's toggle offers (ADR-0010).
 *
 * Two, because what is being recorded is the pairing rule rather than the person: a Mixicano pair
 * is mixed or it is not. There is no third word here because there is no third answer the engine
 * would schedule around, and a dictionary that offered one would be promising a format this is
 * not.
 */
export const genderNames: Readonly<Record<Gender, string>> = {
  woman: 'Woman',
  man: 'Man',
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
      /**
       * Why an untouched toggle holds the step (ADR-0010).
       *
       * It says what is missing rather than that something is wrong, because nothing is: the
       * organizer has not answered a question yet, and the question is one only they can answer.
       * A default would be a guess, and a guessed gender does not fail loudly — it silently
       * produces a pairing rule the schedule then honours all evening.
       */
      genderMissing: 'Mixicano pairs across gender, so every player needs one.',
      /**
       * Why a roster of nine cannot go on to the pairing step (decision #2a, ADR-0017 §4).
       *
       * It is said here rather than on the pairing screen because that screen cannot be reached
       * in a state where it is true: a roster with somebody left over has no pairing to show, and
       * the honest place to say so is the screen where the odd name is standing.
       */
      oddRoster: 'Team Americano plays in fixed pairs, so the roster needs an even number.',
    },

    /**
     * The pairing step: Team Americano's fourth screen (decision #2a, ADR-0017 §1).
     *
     * The organizer assigns the pairs themselves — there is no draw and no seeding, because the
     * pairs are the ones the group already agreed on in the car park. So the whole screen is one
     * gesture repeated: tap a name, tap their partner, they become a team.
     */
    pairing: {
      heading: 'Who plays with whom?',
      lead: 'Tap two names to pair them. Every player is on a team.',
      teams: 'Teams',
      unpaired: 'Not yet paired',
      /** Tapping the first name of a pair; tapping the second is what makes the team. */
      choose: (name: string): string => `Pair ${name}`,
      /** Undoing a pair, which returns both names to the list they came from. */
      unpair: (team: string): string => `Break up ${team}`,
      /** Why Next is withheld while somebody is still standing on their own. */
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
    /**
     * The team-level bench (CONTEXT.md). It names the team rather than its two players, because a
     * pair that sits out sits out together — two loose names would read as two benched people who
     * happen to be free at the same time.
     */
    bye: (teams: readonly string[]): string => `Bye: ${teams.join(', ')}`,
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
    /**
     * The mark on a same-gender side, and the sentence that explains it (ADR-0010).
     *
     * Real rosters do not split evenly: seven women and three men produce same-gender pairs
     * however well the evening is scheduled. The mark exists so the organizer can *explain* a
     * pairing rather than appear to have invented it, which is why the legend is never far from
     * it — a glyph nobody can look up is a decoration, and an unexplained pairing is an argument.
     *
     * It sits on the side rather than on the card, because it is one pair of two that the roster
     * forced, and a banner across the court would accuse the other pair as well.
     */
    sameGender: {
      mark: '*',
      /** What a screen reader announces in place of the glyph, which announces as nothing. */
      markLabel: 'Same-gender pair',
      legend: '* Same-gender pair: the roster left nobody of the other gender to partner.',
    },
  },

  players: {
    /** The single input at the bottom of the list — the wizard's pattern, learned once. */
    placeholder: 'Name',
    add: 'Add',
    /** The badge on whoever this round leaves off a court, so "am I out?" has an answer. */
    benched: 'Sitting out',
    /**
     * The badge on somebody who has left. It is what happened rather than what was done to them:
     * their played matches and their standings line stay, and no later round holds them.
     */
    gone: 'Went home',
    /**
     * The row's overflow, and the one thing in it.
     *
     * Going home is never a swipe. A stray thumb at the side of a court must not be able to take
     * a player out of the evening, so it costs one deliberate tap to find and another to cause.
     */
    options: (name: string): string => `Options for ${name}`,
    optionsGlyph: '⋯',
    /**
     * The one thing in the overflow. It says the same words as the badge it produces, because it
     * records the same fact: the player went home. Nobody is being removed (CONTEXT.md).
     */
    wentHome: 'Went home',
    /**
     * Why an evening at the minimum offers nobody the door.
     *
     * Absent rather than disabled, like New session on the landing page: the engine refuses a
     * round it cannot staff (decision #4), so there is nothing to offer — and a greyed control
     * invites a tap and explains nothing.
     */
    nobodyCanLeave: (minimum: number): string =>
      `A session needs at least ${minimum} players, so nobody can go home from this one.`,
    /**
     * Why a late arrival to a Mixicano evening cannot be taken on yet (ADR-0010).
     *
     * The same rule the wizard's roster step enforces, at the other place a roster grows: a
     * Mixicano roster cannot gain a player without a gender, so Add is absent until the toggle
     * has been answered — absent rather than disabled, like every other control here that has
     * nothing to do.
     */
    genderMissing: 'Mixicano pairs across gender, so a new player needs one.',
    /**
     * The flag on the half of a pair whose partner went home (decision #2b, ADR-0012).
     *
     * It is a badge on their row rather than a banner on the screen, because the fix belongs
     * where the problem is displayed — the Assign partner action sits right beside it.
     */
    needsPartner: 'Needs partner',
    /**
     * Repairing an orphaned team, from the row that is flagged.
     *
     * It names the team rather than the stranded player, because what is short a player is the
     * team: the points the repair keeps are the team's, and the row is only where the team is
     * visible.
     */
    assignPartner: 'Assign partner',
    /**
     * What a screen reader announces for that button, and what tells two flagged rows apart.
     *
     * Two teams can lose a half on the same evening, and `Assign partner` announced twice says
     * nothing about which pair is being repaired.
     */
    assignPartnerTo: (team: string): string => `Assign partner to ${team}`,
    partner: {
      heading: 'Assign a partner',
      /**
       * Who can be picked, and why the list is the one it is.
       *
       * Everybody already on the roster plays for a team (the engine refuses a session where
       * anybody does not), so the only player who can be paired with a stranded half is one the
       * evening has not met yet. That is the whole of "a picker of players not already on a
       * team" — typing the name is picking from it.
       */
      lead: 'Everyone here already has a partner, so a new name joins the team.',
      dismiss: 'Not now',
    },
    /**
     * The preview every roster change opens (ADR-0015).
     *
     * The dismissal is worded for the cause rather than for the schedule, because backing out is
     * not a chance to reject the rotation and keep the change — that state does not exist. The
     * confirmation names the act for the same reason: it is the roster that moves, and the rounds
     * below it are the consequence being read before it is caused.
     */
    preview: {
      heading: 'The rest of the evening',
      lead: 'Every round from here is planned again. Rounds already played do not move.',
      dismiss: "Don't change the roster",
      confirmArrival: (name: string): string => `Add ${name}`,
      confirmDeparture: (name: string): string => `${name} went home`,
      /** Repairing a team is a roster change, so it rides the same preview (ADR-0015). */
      confirmPartner: (name: string, team: string): string => `${name} joins ${team}`,
    },
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

  /**
   * The gender toggle, written once for the two places a Mixicano roster grows a name (ADR-0010).
   *
   * The wizard's Players step and the Players tab ask the same question of the same roster, so
   * they ask it in the same words. What differs is only which of them is on screen — and the
   * sentence each says when the question has not been answered, because one blocks a step and the
   * other blocks an addition.
   */
  gender: {
    name: (gender: Gender): string => genderNames[gender],
    /**
     * What a screen reader announces for one player's half of the toggle.
     *
     * It carries the name because the wizard's list is a column of identical pairs of buttons,
     * and `Woman` announced eleven times says nothing about whose row it is.
     */
    choose: (name: string, gender: Gender): string =>
      `${name} is a ${genderNames[gender].toLowerCase()}`,
  },

  /**
   * A team, as every screen that names one names it: `Ana & Ben`.
   *
   * The same two words the engine's own team standings use, written here because every word the
   * organizer reads is in this file (decision #20). It is not `round.side` — a side is a pairing
   * for one round and belongs to nobody, and a team is the competitor (CONTEXT.md).
   */
  team: {
    name: (names: readonly string[]): string => names.join(' & '),
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
