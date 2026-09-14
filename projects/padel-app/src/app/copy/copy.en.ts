/*
 * Every string the organizer can read, in English — and the shape every other dictionary has to
 * have (ADR-0032 §1).
 *
 * No template in this app writes a word of its own, which is the rule decision #20 imposed for
 * exactly this moment: adding a second language was wiring rather than template archaeology, and
 * the whole voice of the product can still be read in one file and made consistent.
 *
 * **This file is the source of truth for the shape.** `Copy` is derived from it below, and every
 * other dictionary ends `satisfies Copy` — so an entry deleted here and not there, or added here
 * and forgotten there, is a build error rather than a key echoed at somebody standing on a court.
 * English is the one that carries the shape because it is the one that is always complete: it is
 * what a new string is written in, and `en` is what a browser that has never been told otherwise
 * opens in (ADR-0032 §2).
 *
 * Strings that need a value in the middle are functions rather than templates with a placeholder
 * to substitute, so the compiler checks that what a screen has to say is a thing it actually
 * knows. `tools/verify-app-conventions.mjs` proves no template has quietly grown a literal.
 *
 * Two things are deliberately not here. The mode names and the product name are in `names.ts`,
 * shared rather than translated (ADR-0032 §5). And plurals are asked of `Intl.PluralRules` rather
 * than written as a ternary, because the ternary is right in English and wrong in the next
 * language (ADR-0032 §4) — `count` below is this dictionary's copy of the rules for `en-GB`.
 */
import type { Gender, SessionMode } from 'padel-engine';
import { LOCALES } from '../preference/language';
import type { Language } from '../preference/language';
import type { Theme } from '../preference/theme';
import { appName, modeNames } from './names';
import { countIn } from './plural';

/** This dictionary's plural rules, built once. See `plural.ts`. */
const counted = countIn(LOCALES.en);

/**
 * The two answers Mixicano's toggle offers (ADR-0010).
 *
 * Two, because what is being recorded is the pairing rule rather than the person: a Mixicano pair
 * is mixed or it is not. There is no third word here because there is no third answer the engine
 * would schedule around, and a dictionary that offered one would be promising a format this is
 * not.
 */
const genderNames: Readonly<Record<Gender, string>> = {
  woman: 'Woman',
  man: 'Man',
};

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

export const copyEn = {
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
        counted(playerCount, { one: 'player', other: 'players' }),
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
      /**
       * Why a strict roster with fewer than two of a gender is held here (ADR-0036 §5).
       *
       * Said as the names are typed rather than at Create, because it is answerable while the
       * organizer is still standing with the group: one more man, or the other rule. Below two of
       * either gender a strict round has no match in it at all, which is not a session — and the
       * engine refuses it in the same arithmetic.
       */
      strictTooFew: (minimum: number): string =>
        `Strict mixing needs at least ${minimum} women and ${minimum} men.`,
      /**
       * The choice ADR-0036 put on this screen, and the number that makes it a choice.
       *
       * It is here rather than on the mode step because the thing it changes — how many of the
       * booked courts this evening actually fills — is a function of the roster, and a choice made
       * before the roster exists is a choice made blind. So the count sits beside the two answers
       * and moves as the names and the genders are typed: strict mixing costs courts on a skewed
       * roster and costs nothing on an even one, and which evening this is, is visible.
       *
       * The two rules are named in `copy.mixing` rather than here, because Review names them too.
       */
      mixing: {
        heading: 'Mixing',
        /** The price, in the unit it is paid in: courts this roster fills, of the courts booked. */
        courts: (inPlay: number, booked: number): string =>
          `Fills ${inPlay} of ${counted(booked, { one: 'court', other: 'courts' })}.`,
      },
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
      /**
       * The mixing choice and its price, restated on the screen that commits the evening
       * (ADR-0036 §2).
       *
       * Read back rather than offered again, like the mode and the roster above it: changing it
       * is stepping back to the screen that asked. The court count is here because it is the one
       * number on this screen the organizer did not type — the courts they booked are in the
       * field below, and how many of them this roster fills is the difference the choice makes.
       */
      mixing: 'Mixing',
      courtsInPlay: 'Courts in play',
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
    /**
     * The second preference, and the one that costs a reload (ADR-0032 §3).
     *
     * **Each language is named in that language.** *Lietuvių*, not *Lithuanian* — an organizer
     * looking for their own language is looking for the word they would use for it, and a list
     * that named it in a language they do not read would be the one control on the screen they
     * could not use. This is the single deliberate exception to every string being translated:
     * both dictionaries carry these same two words.
     */
    language: {
      heading: 'Language',
      answers: {
        en: 'English',
        lt: 'Lietuvių',
      } satisfies Record<Language, string>,
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
    /**
     * Why a booked court is standing empty, on the one kind of evening where the answer is a rule
     * (ADR-0036 §8).
     *
     * It replaces the star rather than joining it: a strict session has no same-gender pair to
     * mark, and the question its bench asks is not "why am I paired with her?" but "why am I
     * sitting out again while a court is free?". Said once per round, under the courts, beside the
     * bench it explains.
     */
    strictMixing: {
      unused: (courts: readonly string[]): string => `${courts.join(', ')} unused — strict mixing.`,
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
      /**
       * The preview of a strict evening this change would leave nothing to schedule (ADR-0036 §5).
       *
       * There is no rotation to print, so the sheet says the arithmetic instead of showing an
       * empty schedule. The app does not fall back to hybrid fill on the organizer's behalf —
       * that would undo the choice at exactly the moment it mattered — so what is offered is the
       * two moves a person can actually make.
       */
      nobodyCanPlay:
        '0 courts — nobody can play. Keep this player, or end the evening and start another.',
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
     * The one further question, asked only of an evening that has something to answer it with
     * (ADR-0037 §1).
     *
     * The toggle names the act rather than agreeing with a question, so that a pressed pill still
     * reads as a sentence about the evening. The note under it is not decoration: answering yes
     * pays points to competitors who are already on the table the organizer is looking at, so the
     * order of it can change on the way to the podium, and a leaderboard that reorders itself
     * between a tap and the next screen is indistinguishable from a bug.
     *
     * It says nothing about halves or the target score. What is being asked is whether the evening
     * owes anybody anything; the arithmetic of what it then pays is the expanded row's to show.
     */
    compensate: {
      question: 'Pay for the rounds nobody played',
      note: 'Everyone who was available for them is paid, on court or on the bench. This can change the podium.',
    },
    /**
     * A competitor's total, or a dash for somebody the evening has not answered for yet.
     *
     * A zero would be a claim about how they are playing. A dash says nothing has happened to
     * them, which before the first score is the truth about everybody — and stops being the truth
     * the moment they are owed a bench credit, even though they have still not been on a court
     * (ADR-0023 §2). Compensation is the third way that can happen and it is asked about for the
     * same reason: an evening ended before anybody's first court, paid for, owes every one of them
     * points, and a dash beside those points would be the line contradicting itself.
     *
     * Halves are real. An odd target score makes every credit one, so a total carries it rather
     * than rounding the credit into something that is no longer exactly a drawn match. Whole
     * totals stay whole: `.0` on every line to accommodate the one evening in two is noise.
     */
    total: (points: number, matchesPlayed: number, benched: number, compensated: number): string =>
      matchesPlayed === 0 && benched === 0 && compensated === 0
        ? '–'
        : Number.isInteger(points)
          ? String(points)
          : points.toFixed(1),
    /**
     * The four column headings, in the order they are read across a row.
     *
     * `#` is a symbol rather than a word, so it is the same in every language and is written here
     * anyway: a heading the template spelled itself would be the one visible string in the app
     * that is not in a dictionary (decision #20).
     *
     * `Player` is what the column holds in every mode that rotates partners. Team Americano ranks
     * teams on this same table and a row there is `Ana & Ben` (ADR-0011) — the heading does not
     * follow, deliberately, because one word over one column is what keeps this screen from having
     * to ask what mode it is.
     */
    position: '#',
    player: 'Player',
    /** The heading over the totals, abbreviated because the column is 52px wide. */
    points: 'PTS',
    /**
     * Wins, ties and losses as one triple, labelled by the only thing that says which is which.
     *
     * The label carries the order because the figures cannot: a `0` in the middle is a number of
     * ties only if the reader already knows where ties sit. En dashes rather than hyphens, which
     * is the dash this app writes everywhere else.
     */
    record: 'W–T–L',
    /**
     * The triple itself, or a dash for a competitor no match has happened to yet.
     *
     * Not `total`'s condition, and deliberately so. A bench credit makes a total real while the
     * record is still empty (ADR-0023 §2), so somebody who has been paid for sitting out and has
     * never been on a court reads a dash here and a number beside it — which is exactly what has
     * happened to them.
     */
    recordOf: (won: number, tied: number, lost: number): string =>
      won + tied + lost === 0 ? '–' : `${won}–${tied}–${lost}`,
    /**
     * What the abbreviated headings stand for, in the table's caption.
     *
     * One sentence rather than four assembled fragments, so the word order and the separator are
     * inside the dictionary where a translator can see them and change them.
     *
     * `PTS` is in it because `PTS` is on the screen. `#` is not: a column of `1 2 3` under a hash
     * is not an abbreviation anybody has to be told the expansion of.
     */
    legend: 'W = Wins · T = Ties · L = Losses · PTS = Points',
    /**
     * Nothing renders this. It is kept against the day the figures behind a name come back — a
     * tap, a wider column, a screen of their own — because the word for them is a decision and
     * not a string, and nothing here checks for unused keys (#97).
     */
    matchesPlayed: 'Matches played',
    /**
     * Rounds sat out — a term of the total, and none of the three the record counts (ADR-0023 §5).
     *
     * Nothing renders it either, and it is kept for the same reason as `matchesPlayed` above: the
     * word for a benched round is a decision this app has already made once, and the screen it
     * belongs on may come back.
     */
    benched: 'Benched',
    /**
     * Abandoned rounds this competitor was paid for, beside the rounds they sat out rather than
     * inside them (ADR-0037 §8).
     *
     * Folding it into `benched` would tell a player they sat out a round they were scheduled into,
     * so the roster tab and this one would contradict each other — and adding the points silently
     * would break the arithmetic this row exists to let a reader check by hand.
     *
     * Nothing renders it. ADR-0037 §8 asked the expanded row to show it and #97 took the expansion
     * away, so it is kept for the reason `matchesPlayed` and `benched` above are: the word is a
     * decision already made, and the figure is still derived on every read.
     */
    compensated: 'Compensated',
  },

  /**
   * The evening as a file (ADR-0038).
   *
   * Every word here is read somewhere the app is not, which is why the section exists at all: the
   * table on screen is four columns wide because a phone is, and the three figures that explain
   * how a total was reached have never been anywhere a reader could see them. The link is the
   * only thing in here that is on a screen; everything else is on paper.
   */
  report: {
    /**
     * The link under the standings table, on the organizer's tab and the spectator's alike.
     *
     * Plain text rather than the gradient pill every primary action wears (ADR-0035 §2, move 4),
     * because this is a retrieval and not a decision: the evening is already over, and nothing
     * this link does changes anything about it.
     */
    link: 'Save this evening as a PDF',
    /**
     * The report's library did not arrive — a court with no signal, and there is still no service
     * worker to have kept it (decision #15, ADR-0030).
     *
     * A sentence rather than a button that does nothing, which is exactly `share.qrUnavailable`'s
     * bargain: say what is missing, and say what still works without it.
     */
    unavailable: 'The report needs a connection to build. The table above does not.',
    /**
     * The five columns the phone had no room for, over a page that has room for them.
     *
     * Abbreviated because nine headings across A4 beside a column of names is still a tight line,
     * and expanded in the legend underneath — the same bargain the screen's `W–T–L` makes with its
     * caption.
     */
    played: 'P',
    won: 'W',
    tied: 'T',
    lost: 'L',
    bench: 'Bench',
    /** Only ever printed where the evening paid compensation (ADR-0038 §4). */
    compensated: 'Comp',
    /** Written out rather than `PTS`: the column it heads is not 52px wide here. */
    points: 'Points',
    /**
     * What the abbreviated headings stand for, growing a clause per thing the page actually shows.
     *
     * Two clauses are conditional because both the things they explain are. `Comp` is printed only
     * on an evening that compensated something, and the joint mark only where the engine declared
     * a shared place — a legend explaining a column that is not there teaches a reader nothing and
     * invites them to go looking for it.
     */
    legend: (compensated: boolean, joint: boolean): string =>
      [
        'P = Played · W = Wins · T = Ties · L = Losses · Bench = Rounds sat out',
        ...(compensated ? ['Comp = Abandoned rounds paid for'] : []),
        ...(joint ? ['= Position shared'] : []),
      ].join(' · '),
    /**
     * A shared place, marked (ADR-0038 §3).
     *
     * Decision #8 went to real trouble to make a joint position a result rather than an unfinished
     * tie-break, and two rows reading `2` followed by a row reading `4` — on a page nobody can tap
     * to ask a question of — reads as a bug in the generator rather than as the finding it is.
     */
    jointPosition: (position: number): string => `=${position}`,
    /**
     * The mark on a round the evening abandoned (ADR-0037 §2).
     *
     * Printed rather than dropped, because a report that silently left them out could not explain
     * the `Comp` column sitting above them.
     */
    unplayed: 'Not played',
    /** The last line on the page: whose app made this, and when. */
    footer: (day: string): string => `${appName} · ${day}`,
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
  /**
   * The two rules a Mixicano can settle an unequal pool by (ADR-0036), and what each one does.
   *
   * Out here beside `gender` rather than inside one screen's section, because two screens name
   * them: the roster step, where the choice is made, and Review, which reads it back. A name the
   * organizer chose by and a name they are shown afterwards must be the same word, and one entry
   * is how that stays true.
   */
  mixing: {
    strict: 'Strict mixing',
    hybrid: 'Hybrid fill',
    strictLead: 'No pair shares a gender. Whoever is left over sits out.',
    hybridLead:
      'Every court filled. The same-gender pairs the roster forces are marked on the schedule.',
  },

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
 * The shape of a dictionary: the English one with its exact words forgotten.
 *
 * `typeof copyEn` alone would carry the English *strings* as literal types, and every Lithuanian
 * word would then be an error for the crime of not being English. So string literals are widened
 * back to `string` on the way through, and everything else — the nesting, the keys, the function
 * signatures — is kept exactly as this file declares it.
 *
 * What that buys is the whole of ADR-0032 §1: a missing entry, a renamed one or a function whose
 * arguments have changed is a build error in every other dictionary, at the moment the English is
 * edited rather than at a court in six weeks. What it cannot see is a translation whose function
 * takes fewer arguments than it is given, which TypeScript permits everywhere — that is what the
 * parity check in `dictionaries.spec.ts` is for.
 */
type Translatable<Entry> = Entry extends string
  ? string
  : Entry extends (...args: infer Args) => infer Result
    ? (...args: Args) => Translatable<Result>
    : { readonly [Key in keyof Entry]: Translatable<Entry[Key]> };

export type Copy = Translatable<typeof copyEn>;

/**
 * What an evening is, in the two words both the Resume card and a history row use to say it.
 *
 * One expression rather than two identical ones, because a session summarised on the front door
 * and a session summarised in the list below it are the same sentence about the same thing, and
 * they should not be able to drift into disagreeing about the separator.
 */
function modeAndSize(mode: SessionMode, playerCount: number): string {
  return `${modeNames[mode]} · ${counted(playerCount, { one: 'player', other: 'players' })}`;
}

/**
 * A number of evenings, with the noun agreeing with it.
 *
 * One evening is not `1 evenings`, and the sentence it sits in is the one asking the organizer to
 * weigh what they are leaving behind — a plural that does not agree is exactly the sort of thing
 * that makes a person stop believing the rest of the sentence.
 */
function eveningCount(evenings: number): string {
  return counted(evenings, { one: 'evening', other: 'evenings' });
}

const modeBlurbs: Readonly<Record<SessionMode, string>> = {
  americano: 'Partners rotate every round. Everyone plays with everyone.',
  mixicano: 'Partners rotate, paired across gender wherever the roster allows.',
  'team-americano': 'Fixed pairs you choose. The team is what gets ranked.',
};
