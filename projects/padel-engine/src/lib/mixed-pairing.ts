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
 * A same-gender pair is **derived, never stored** (ADR-0010): it is a fact about the roster's
 * genders and the pair, so a corrected gender re-marks the schedule rather than leaving a stale
 * flag behind. `sameGenderSides` is the public form of that derivation.
 */
import type { Match, PlayerId, Session, Side } from './model';

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
  /** Are these two the same gender — the pair Mixicano forms only when it must? */
  sameGender(a: PlayerId, b: PlayerId): boolean;
  /** The fewest same-gender pairs these players, split onto courts, can be paired into. */
  forcedSameGenderPairs(playing: readonly PlayerId[]): number;
}

const NEVER_MIXES: MixedPairing = {
  mixes: false,
  sameGender: () => false,
  forcedSameGenderPairs: () => 0,
};

/** The rule this session pairs by, read off its mode and its roster. */
export function mixedPairingIn(session: Session): MixedPairing {
  if (session.mode !== 'mixicano') {
    return NEVER_MIXES;
  }

  const genders = new Map(session.roster.map((entry) => [entry.id, entry.gender]));

  return {
    mixes: true,
    // Two players the roster has no gender for compare equal, and so read as a same-gender pair.
    // Only a session that never passed the shape check can hold one, and the cautious answer is
    // the right one there: a pair the engine cannot vouch for is shown as a compromise rather
    // than passed off as a mix.
    sameGender: (a, b) => genders.get(a) === genders.get(b),
    forcedSameGenderPairs: (playing) => {
      const women = playing.filter((id) => genders.get(id) === 'woman').length;
      const men = playing.filter((id) => genders.get(id) === 'man').length;

      // Every man can partner a woman, so the surplus is what is left over on one side — and
      // being a surplus it is even, because the players on court come four to a court.
      return Math.floor(Math.abs(women - men) / 2);
    },
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
