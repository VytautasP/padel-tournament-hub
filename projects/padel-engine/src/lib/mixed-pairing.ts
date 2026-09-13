/*
 * Mixicano's one rule, and the arithmetic of the times it cannot be kept.
 *
 * Mixicano is Americano with mixed-gender pairs — the bench rotation, the partner search and the
 * prefix fairness are the same machinery, and the only thing that changes is what a pair costs.
 * Which is exactly why the rule lives here rather than inside the scheduler: `plan-round.ts` asks
 * what a partnership costs, `assert-session-valid.ts` asks what a round was entitled to do, and
 * `format-schedule.ts` asks what to mark. Three callers, one answer.
 *
 * Real rosters do not split evenly. Seven women and three men make three mixed pairs and leave
 * two women over, and decision #7 says what happens then: **hybrid fill** — the courts take mixed
 * pairs first and the surplus plays same-gender. So same-gender pairing is a soft cost rather
 * than a hard constraint, and the two things that follow are this module's whole job.
 *
 *   - `forcedSameGenderPairs` is the floor: how many such pairs the players on court cannot
 *     avoid, `|women - men| / 2`. Maximising mixed pairs minimises same-gender ones, so there is
 *     nothing cleverer to do than fill mixed first — the arithmetic has one answer and this is it.
 *     The scheduler aims at that number and the referee holds it to it.
 *   - Which players carry it is free, and freedom is what makes it rotatable. Nothing here
 *     chooses; `plan-round.ts` spends the choice on whoever has been compromised least.
 *
 * That was the whole of the module until ADR-0036 made hybrid fill the opt-in. Under **strict
 * mixing** a same-gender pair is not expensive, it is not available: the courts shrink to what
 * the smaller gender can staff (`mixedCourts`) and the surplus sits. Which rule a session plays
 * by is read off the document here too, so the one branch every caller asks about is `strict`.
 *
 * A same-gender pair is **derived, never stored** (ADR-0010): it is a fact about the roster's
 * genders and the pair, so a corrected gender re-marks the schedule rather than leaving a stale
 * flag behind. `sameGenderSides` is the public form of that derivation.
 */
import type { Gender, Match, PlayerId, Session, Side } from './model';

/**
 * Whether two players are the same gender, and how many such pairs a set of players forces.
 *
 * For Americano — for any mode that does not pair across gender — every question answers "no"
 * and "none", so the scheduler and the referee run the same code either way and Mixicano is
 * genuinely one more term rather than a second scheduler.
 */
export interface MixedPairing {
  /** Does this mode want mixed pairs at all? */
  readonly mixes: boolean;
  /**
   * Does it want them so much it would rather bench a player than forgo one (ADR-0036 §1)?
   *
   * False for hybrid fill, for a Mixicano written before the choice existed, and for every mode
   * that does not mix at all.
   */
  readonly strict: boolean;
  /** Are these two the same gender — the pair Mixicano forms only when it must? */
  sameGender(a: PlayerId, b: PlayerId): boolean;
  /** The fewest same-gender pairs these players, split onto courts, can be paired into. */
  forcedSameGenderPairs(playing: readonly PlayerId[]): number;
  /**
   * How many courts these players fill with mixed pairs and nothing else: a court is two women
   * and two men, so `floor(min(women, men) / 2)`.
   *
   * The question a strict session asks instead of "how many fours are there?", and the price
   * ADR-0036 §2 accepts: seven women and three men fill one court and bench six. Zero for a mode
   * that forms no mixed pairs, which is the only honest answer and one nothing asks for.
   */
  mixedCourts(playing: readonly PlayerId[]): number;
  /**
   * These units split into the queues that bench independently: one holding all of them, except
   * under strict mixing, where it is one per gender (ADR-0036 §3).
   *
   * The bench question asked of the population that could answer it (ADR-0020's move again):
   * three men among seven women are on court every round by arithmetic, so a single queue would
   * read their empty bench as a scheduler with favourites rather than as the shape of the roster.
   * Within a gender the question is exactly as sharp as it has always been, because a woman was
   * never a candidate for the seat a man is taking.
   *
   * The scheduler benches by these queues and the referee checks the spread within them, and they
   * must agree or the generator would produce a session its own referee rejects — which is why
   * the split is answered here rather than worked out twice. Units rather than ids, because the
   * referee holds roster entries and the planner holds ids, and neither should have to map to the
   * other's shape to ask.
   */
  benchQueues<Unit>(
    units: readonly Unit[],
    idOf: (unit: Unit) => PlayerId,
  ): readonly (readonly Unit[])[];
}

const NEVER_MIXES: MixedPairing = {
  mixes: false,
  strict: false,
  sameGender: () => false,
  forcedSameGenderPairs: () => 0,
  mixedCourts: () => 0,
  benchQueues: (units) => [units],
};

/** How a set of players divides across the one axis Mixicano pairs on. */
export interface GenderSplit {
  readonly women: number;
  readonly men: number;
}

/**
 * The split, counted off whatever genders are handed over — a roster's, or a round's.
 *
 * Lives here because every question this module answers is this arithmetic read one way or
 * another, and the shape check asks it too: two of each gender is the smallest roster strict
 * mixing can play (ADR-0036 §5), which is the same count `mixedCourts` divides.
 *
 * Anything the roster has no gender for counts as neither. Only a session that never passed the
 * shape check can hold one, and a player the engine cannot classify is not evidence that a court
 * can be staffed.
 */
export function genderSplit(genders: readonly (Gender | undefined)[]): GenderSplit {
  return {
    women: genders.filter((gender) => gender === 'woman').length,
    men: genders.filter((gender) => gender === 'man').length,
  };
}

/** The rule this session pairs by, read off its mode and its roster. */
export function mixedPairingIn(session: Session): MixedPairing {
  if (session.mode !== 'mixicano') {
    return NEVER_MIXES;
  }

  const genders = new Map(session.roster.map((entry) => [entry.id, entry.gender]));

  const genderCounts = (playing: readonly PlayerId[]): GenderSplit =>
    genderSplit(playing.map((id) => genders.get(id)));

  return {
    mixes: true,
    strict: session.strictMixing === true,
    // Two players the roster has no gender for compare equal, and so read as a same-gender pair.
    // Only a session that never passed the shape check can hold one, and the cautious answer is
    // the right one there: a pair the engine cannot vouch for is shown as a compromise rather
    // than passed off as a mix.
    sameGender: (a, b) => genders.get(a) === genders.get(b),
    forcedSameGenderPairs: (playing) => {
      const { women, men } = genderCounts(playing);

      // Every man can partner a woman, so the surplus is what is left over on one side — and
      // being a surplus it is even, because the players on court come four to a court.
      return Math.floor(Math.abs(women - men) / 2);
    },
    mixedCourts: (playing) => {
      const { women, men } = genderCounts(playing);

      return Math.floor(Math.min(women, men) / PAIRS_PER_COURT);
    },
    // Hybrid fill benches the whole roster as one queue, exactly as Americano does: it puts four
    // of whoever is here onto each court, so whoever is here is the population the bench is
    // spread across. Only strictness makes the genders separate queues — and then every unit is
    // in exactly one of the two, because Mixicano refuses a roster entry it has no gender for
    // (`assertGenderSound`) before anything here is asked anything.
    benchQueues: (units, idOf) =>
      session.strictMixing === true
        ? (['woman', 'man'] as const).map((gender) =>
            units.filter((unit) => genders.get(idOf(unit)) === gender),
          )
        : [units],
  };
}

/**
 * Which sides of this match are same-gender pairs — the compromise hybrid fill forced.
 *
 * Exported from the library because the organizer has to be able to explain a pairing to the
 * player standing in front of them, and "the engine ran out of men" is only an answer if the
 * schedule says so. Empty for Americano, and for every mixed pair.
 */
export function sameGenderSides(session: Session, match: Match): readonly Side[] {
  const mixed = mixedPairingIn(session);

  return (['A', 'B'] as const).filter((side) => {
    const pair = side === 'A' ? match.sideA : match.sideB;

    return mixed.sameGender(pair[0], pair[1]);
  });
}

/** Two pairs to a court, one on each side of the net. */
const PAIRS_PER_COURT = 2;
