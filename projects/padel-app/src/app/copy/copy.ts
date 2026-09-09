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
import type { Theme } from '../preference/theme';

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

/**
 * The product's name, out on its own because two entries below need it in a sentence.
 *
 * Written once for the same reason every other word in this file is written once: a name that
 * appeared twice would be a name that could be changed once.
 */
const appName = 'Padel Tournament Hub';

/**
 * What a Google account is called when Google gave no address for it.
 *
 * Out on its own for the same reason `appName` is: two entries below need it in a sentence, and a
 * word written twice is a word that can be changed once.
 */
const googleAccount = 'your Google account';

/**
 * What sharing a session is called, in the two places that name it.
 *
 * The header control announces it and the sheet it opens is titled it. Out on its own for the
 * reason `appName` is: a sentence written twice is a sentence that can be changed once.
 */
const shareHeading = 'Share this session';

/**
 * What the settings sheet is called, in the two places that name it: the gear, and the sheet's own
 * heading. Out on its own for the reason `appName` is.
 */
const settingsHeading = 'Settings';

export const copy = {
  appName,

  /**
   * A startup that could not reach the organizer's sessions (ADR-0025 §4).
   *
   * Almost always the first launch of a device with no network — the uid is minted once on
   * Firebase's servers and restored locally forever after, so an organizer who reads this will
   * usually read it once and never again. The other way here is a read that failed with a uid
   * already in hand, which ADR-0025 accepts as stopping an evening. The words cover both without
   * asking the organizer to diagnose which, because their move is the same either way.
   *
   * There is no Retry button. Reopening the app is the retry, it is the thing a person does
   * anyway, and a button that fails silently in the same place teaches them the app is broken
   * rather than that the signal is.
   */
  connection: {
    heading: 'No connection to your sessions',
    lead: `${appName} could not reach your sessions. The first time you open it on a device it needs a connection to set itself up; after that it works on court with no signal at all.`,
    hint: 'Find a signal or some Wi-Fi, then open the app again.',
  },

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

  /**
   * How durable the organizer's history is, and the one thing they can do about it (decision #14,
   * ADR-0028).
   *
   * It is written as a fact rather than as a warning. Browser-bound history is the state every
   * organizer starts in and the state most of them will stay in, and a front door that nagged
   * about it every evening would be a front door people stop reading. So it says what is true and
   * offers the one thing that changes it, in the quietest voice on the page.
   */
  identity: {
    browserOnly: 'History is kept on this browser. Clear its data and it goes.',
    kept: (account: string | null): string => `History is kept with ${account ?? googleAccount}.`,
    keep: 'Keep history with Google',
    /**
     * A link that did not happen and was nobody's mistake.
     *
     * One sentence for every cause — no signal, a blocked popup, a project misconfigured, a
     * credential that expired while the question was on screen — because the organizer's move is
     * the same in all of them and the detail is in the console. It says the *act* did not happen
     * rather than naming a cause, because naming one would be wrong for most of them: a popup the
     * browser blocked is not Google being unreachable. Closing the Google window says nothing at
     * all: changing your mind is an answer, not a failure.
     */
    unavailable: 'Linking to Google did not work. Try again.',
    /**
     * The account already belongs to a uid, which is nearly always this organizer's own previous
     * browser (ADR-0028 §2).
     *
     * The question names what it costs, because that is the only thing that makes it worth
     * reading, and the cost is the one thing about it that varies: a browser holding nothing loses
     * nothing and this is pure recovery, while a browser holding evenings leaves them behind for
     * good — `ownerUid` cannot move (ADR-0024 §2), so nothing can bring them back afterwards.
     *
     * It is not marked unrecoverable and its button is not `danger`, for the reason **went home**
     * is neither (ADR-0021 §3): nothing is deleted. Those evenings are exactly where they were,
     * still owned by a uid — what changes is that this browser is no longer holding it.
     */
    adoptConfirm: (account: string | null, evenings: number) => ({
      heading: 'Use this Google account?',
      lead:
        `${account ?? googleAccount} already keeps history from another browser. ` +
        (evenings === 0
          ? 'Signing in brings that history here, and this browser has none of its own to leave behind.'
          : `Signing in brings that history here and leaves ${eveningCount(evenings)} behind for good — an evening belongs to the browser that created it and cannot be moved.`),
      action: 'Use this account',
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
     * The line under the app's name in the desktop rail: which evening this rail belongs to.
     *
     * The same sentence the Resume card says, because it answers the same question — an organizer
     * with two laptop windows open should not have to tap a destination to find out which evening
     * they are looking at. It is the rail's only text that is not a destination.
     */
    summary: modeAndSize,
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

  /**
   * What the other end of a share code reads (ADR-0026 §2).
   *
   * A spectator is not an organizer with the buttons taken away — they are somebody standing on a
   * court holding a phone, and the two things they need said are which evening this is and that
   * nothing they do here changes it. Everything else on the route is the session itself, in the
   * same words the organizer reads: the roster, the courts and the table are one vocabulary, and a
   * second set of them for watchers would be two apps describing one night.
   */
  spectator: {
    /**
     * The line under the app's name on the spectator's header — the same sentence the rail says
     * about the same evening, because it answers the same question.
     */
    summary: modeAndSize,
    /**
     * The state a share code can be in besides working (decision #10's hard delete).
     *
     * It says the evening is not there rather than naming a cause, because from here the causes are
     * indistinguishable: a code whose evening was deleted and a code that never named one are the
     * same non-answer, and neither is anything the person holding the phone can fix. Blaming a
     * deletion would be the app guessing out loud, in front of somebody who may simply have
     * mistyped. There is no retry either, for the reason the front door has none.
     */
    gone: {
      heading: 'This session is gone',
      lead: 'There is no evening at this code. A session that has been deleted is deleted for everybody, and nothing here can be recovered.',
    },
  },

  /**
   * The settings sheet, and the one preference it carries so far (ADR-0031).
   *
   * `Settings` names the gear and titles the sheet it opens, out of one constant for the reason
   * `shareHeading` is: a control and the surface it leads to that disagreed about their own name
   * would be two names for one act. Unlike sharing it needs no object — there is only one thing
   * settings could be the settings of — so the sentence is the word.
   *
   * The three answers are the organizer's words for them, not the stored ones. *System* is what
   * "follow the phone" is called on every platform the app runs on, and it is deliberately not
   * called Automatic: automatic would suggest the app is deciding, and it is not — it is
   * doing what it is told, by something else.
   */
  settings: {
    open: settingsHeading,
    heading: settingsHeading,
    /** A glyph on screen and the sentence above to a screen reader, like the share control. */
    openGlyph: '⚙',
    theme: {
      heading: 'Theme',
      answers: {
        system: 'System',
        light: 'Light',
        dark: 'Dark',
      } satisfies Record<Theme, string>,
    },
    /** A dismiss rather than a commit: a theme applies as it is tapped, and there is no Save. */
    done: 'Done',
  },

  /**
   * Getting a share code from the organizer's phone onto everybody else's (ADR-0026 §4).
   *
   * The one surface in the app that shows a share code to a human, which is what ADR-0024's choice
   * of alphabet was for. Three ways out of it — a QR, ten characters read aloud, a link pasted
   * into whatever the group talks in — and the words below never call any of them a fallback,
   * because all three are how this actually happens.
   */
  share: {
    /**
     * The control ADR-0026 adds to a session's header, and the whole of its accessible name.
     *
     * The first of the two that header now carries: the gear was paired with it on the left by
     * ADR-0031 §2, and `settings.open` is named the same way for the same reason.
     *
     * A glyph on screen and a sentence to a screen reader, like the paging arrows: the icon is all
     * a thumb needs beside a screen that is plainly a session, and "Share" alone would not say
     * share *what*.
     *
     * The same sentence as the heading of the sheet it opens, and the same constant: a control and
     * the surface it leads to that disagreed about their own name would be two names for one act.
     */
    open: shareHeading,
    heading: shareHeading,
    /**
     * What the person on the other end of this gets, said before they are handed it.
     *
     * It says watching rather than joining, because a spectator has no identity here and changes
     * nothing (ADR-0026 §3) — and it does not promise the code can be taken back, because it
     * cannot (CONTEXT.md, **share code**).
     */
    lead: 'Anyone with the code can watch this evening. They cannot change it.',
    /** The QR's accessible name. The grid of squares is not describable and does not need to be. */
    qr: 'QR code for this session',
    /**
     * The QR encoder did not arrive, which on a court means no signal (ADR-0026 §4).
     *
     * It says what still works rather than what failed. The code is underneath it, it is the whole
     * credential, and it can be read out — so the sheet is not broken, it is one of its three ways
     * short.
     */
    qrUnavailable: 'The QR needs a connection to draw. The code below works without one.',
    code: 'Share code',
    copyLink: 'Copy link',
    copied: 'Link copied.',
    /**
     * A clipboard the browser would not write to — a denied permission, or an origin with no
     * clipboard API at all.
     *
     * One sentence for every cause, like `identity.unavailable`: the organizer's move is the same
     * in all of them, and it is the one thing this sheet can always offer.
     */
    copyFailed: 'The link did not copy. Read the code out instead.',
    /** The way out of the sheet. Nothing here is confirmed, so there is nothing to cancel. */
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
     * The same sentence where the unit is the team (ADR-0011).
     *
     * A different reason rather than the same one counting differently: an eight-player Team
     * Americano evening of two teams has twice the minimum roster and still cannot lose anybody,
     * because what a round needs is two teams with both their players. Saying "a session needs at
     * least four players" to somebody looking at eight would be answering a question they did not
     * ask with a number that does not apply.
     */
    noTeamCanLose: (teams: number): string =>
      `A round needs ${teams} teams with both their players, so nobody can go home from this one.`,
    /**
     * Why there is no Add on the Players tab of a Team Americano evening (decision #2a).
     *
     * A player does not arrive alone in this format — they arrive as somebody's partner — so the
     * field is absent rather than offered and refused. The one arrival that exists is the repair
     * above, and this says where to find it.
     */
    arrivalsJoinATeam:
      'Team Americano plays in fixed pairs, so a new player joins a team that needs a partner.',
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
     * A competitor's total, or a dash for somebody the evening has not answered for yet.
     *
     * A zero would be a claim about how they are playing. A dash says nothing has happened to
     * them, which before the first score is the truth about everybody — and stops being the truth
     * the moment they are owed a bench credit, even though they have still not been on a court
     * (ADR-0023 §2).
     *
     * Halves are real. An odd target score makes every credit one, so a total carries it rather
     * than rounding the credit into something that is no longer exactly a drawn match. Whole
     * totals stay whole: `.0` on every line to accommodate the one evening in two is noise.
     */
    total: (points: number, matchesPlayed: number, benched: number): string =>
      matchesPlayed === 0 && benched === 0
        ? '–'
        : Number.isInteger(points)
          ? String(points)
          : points.toFixed(1),
    /**
     * Wins, ties and losses as one triple, labelled by the only thing that says which is which.
     *
     * The label carries the order because the figures cannot: a `0` in the middle is a number of
     * ties only if the reader already knows where ties sit. En dashes rather than hyphens, which
     * is the dash this app writes everywhere else.
     */
    record: 'W–T–L',
    recordOf: (won: number, tied: number, lost: number): string => `${won}–${tied}–${lost}`,
    matchesPlayed: 'Matches played',
    /**
     * Rounds sat out, beside the record rather than inside it.
     *
     * A bench round is not a result, so it is none of the three (ADR-0023 §5) — which leaves a
     * total that the record alone cannot account for. This is the missing term, and without it a
     * player who sat out twice reads their own line as a bug.
     */
    benched: 'Benched',
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
 * A number of evenings, with the noun agreeing with it.
 *
 * One evening is not `1 evenings`, and the sentence it sits in is the one asking the organizer to
 * weigh what they are leaving behind — a plural that does not agree is exactly the sort of thing
 * that makes a person stop believing the rest of the sentence.
 */
function eveningCount(evenings: number): string {
  return evenings === 1 ? '1 evening' : `${evenings} evenings`;
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
