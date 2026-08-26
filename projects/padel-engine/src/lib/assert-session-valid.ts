/*
 * The engine's referee.
 *
 * `assertSessionValid` encodes the invariant list in `docs/DECISIONS.md` and ships as production
 * code, not as a test helper (decision #21): the app can hand it any session — one it built, one
 * it loaded from storage — and find out whether it is playable.
 *
 * Every *fairness* check runs at **every round prefix**, not only over the finished session,
 * because a session that is fair only after its last round is unfair to the evening that stops
 * early (decision #6). The prefix walk is what actually tests that. The structural checks —
 * unique ids, ordering, scores — are properties of the document rather than of a prefix, and run
 * once over the whole of it.
 *
 * It throws on the first violation with a message naming the round and the players involved,
 * because a fairness bug is only useful if you can see what it did.
 */
import type { Match, PlayerId, RosterEntry, Round, Session } from './model';
import { PairTally } from './pair-tally';
import { availableIn, joinedAtRound } from './roster-availability';
import { assertScorePairValid } from './score-rules';
import { assertSessionShape, courtsInPlay, PLAYERS_PER_COURT } from './session-shape';

export function assertSessionValid(session: Session): void {
  assertSessionShape(session);

  const names = new Map(session.roster.map((entry) => [entry.id, entry.name]));
  const nameOf = (id: PlayerId): string => names.get(id) ?? id;

  assertMatchIdsUnique(session);
  assertGeneratedRoundsComeFirst(session);
  assertScoresSumToTarget(session);

  const partnerCounts = new PairTally();
  const benchCounts = new Map<PlayerId, number>();

  for (const round of session.rounds) {
    if (round.matches.length === 0) {
      continue;
    }

    // The roster this round is answerable for. Someone who had not arrived yet, or who had
    // already gone home, is neither scheduled here nor benched here nor owed a partnership here.
    const available = availableIn(session, round.number);

    assertRoundStructure(round, session, available, nameOf);
    countBench(round, available, benchCounts);

    // Everything from here down is a prefix check: it holds after this round, given every
    // round before it, so a session truncated at any point is still valid.
    assertBenchSpread(round, available, benchCounts, nameOf);
    assertPartnerVariety(round, available, partnerCounts, nameOf);
  }
}

function assertMatchIdsUnique(session: Session): void {
  const seen = new Set<string>();
  for (const round of session.rounds) {
    for (const match of round.matches) {
      if (seen.has(match.id)) {
        throw new Error(`Duplicate match id "${match.id}".`);
      }
      seen.add(match.id);
    }
  }
}

/** An ungenerated round is a slot still to be filled, so nothing may be scheduled after one. */
function assertGeneratedRoundsComeFirst(session: Session): void {
  const firstUngenerated = session.rounds.findIndex((round) => round.matches.length === 0);
  if (firstUngenerated === -1) {
    return;
  }

  const laterGenerated = session.rounds
    .slice(firstUngenerated + 1)
    .find((round) => round.matches.length > 0);
  if (laterGenerated) {
    throw new Error(
      `Round ${laterGenerated.number} is scheduled while round ${firstUngenerated + 1} is ungenerated.`,
    );
  }
}

/**
 * Every recorded score pair sums to the session target.
 *
 * Unlike the fairness checks this is not a prefix property — a score is right or wrong on its
 * own — so it walks every match once, unscored ones included and skipped. A match with no score
 * is a court that has not finished, which is a normal state for a session to be in all evening.
 */
function assertScoresSumToTarget(session: Session): void {
  for (const round of session.rounds) {
    for (const match of round.matches) {
      if (match.score) {
        assertScorePairValid(
          match.score,
          session.targetScore,
          `Round ${round.number} court ${match.courtNumber}`,
        );
      }
    }
  }
}

function assertRoundStructure(
  round: Round,
  session: Session,
  available: readonly RosterEntry[],
  nameOf: (id: PlayerId) => string,
): void {
  // Courts in play, not courts booked: six players on two courts fill one court and bench two.
  const inPlay = courtsInPlay(session, round.number);
  if (round.matches.length !== inPlay) {
    throw new Error(
      `Round ${round.number} fills ${round.matches.length} of ${inPlay} court(s) — ` +
        'every court in play hosts a match.',
    );
  }

  const courtNumbers = round.matches.map((match) => match.courtNumber);
  const expectedCourts = Array.from({ length: inPlay }, (_, index) => index + 1);
  if (courtNumbers.join(',') !== expectedCourts.join(',')) {
    throw new Error(
      `Round ${round.number} uses court numbers ${courtNumbers.join(', ')} — expected ` +
        `${expectedCourts.join(', ')}.`,
    );
  }

  const rosterIds = new Set(session.roster.map((entry) => entry.id));
  const availableIds = new Set(available.map((entry) => entry.id));
  const playing = new Set<PlayerId>();

  for (const match of round.matches) {
    const players = playersOf(match);

    for (const id of players) {
      if (!rosterIds.has(id)) {
        throw new Error(`Match ${match.id} schedules "${id}", who is not on the roster.`);
      }
      if (!availableIds.has(id)) {
        throw new Error(
          `Match ${match.id} schedules ${nameOf(id)}, who is not in the session for round ` +
            `${round.number}.`,
        );
      }
    }

    if (new Set(players).size !== PLAYERS_PER_COURT) {
      throw new Error(`Match ${match.id} must have four distinct players.`);
    }

    for (const id of players) {
      if (playing.has(id)) {
        throw new Error(`Round ${round.number} schedules ${nameOf(id)} on two courts.`);
      }
      playing.add(id);
    }
  }
}

/**
 * Mark the bench for everyone available this round who is not on court.
 *
 * A player arriving mid-session starts at the floor of the counts already in play, not at zero.
 * The rounds before they got here are not rounds they sat out — but nor are they rounds they are
 * owed. Seeding them level with whoever has sat out least puts them at the front of the bench
 * queue alongside those players, which is the one seeding that leaves the spread rule below
 * meaning what it says.
 */
function countBench(
  round: Round,
  available: readonly RosterEntry[],
  benchCounts: Map<PlayerId, number>,
): void {
  const known = available
    .filter((entry) => benchCounts.has(entry.id))
    .map((entry) => benchCounts.get(entry.id) ?? 0);
  const floor = known.length > 0 ? Math.min(...known) : 0;

  const playing = new Set(round.matches.flatMap(playersOf));
  for (const entry of available) {
    const satOut = benchCounts.get(entry.id) ?? floor;
    benchCounts.set(entry.id, playing.has(entry.id) ? satOut : satOut + 1);
  }
}

/**
 * Bench counts never differ by more than one — at every prefix, across the players the round
 * could have put on court. Someone who has gone home stops accruing a bench and stops being
 * compared: their count is a record of the evening they played, not of the one still going.
 */
function assertBenchSpread(
  round: Round,
  available: readonly RosterEntry[],
  benchCounts: Map<PlayerId, number>,
  nameOf: (id: PlayerId) => string,
): void {
  const counts = available.map((entry) => benchCounts.get(entry.id) ?? 0);
  const spread = Math.max(...counts) - Math.min(...counts);
  if (spread <= 1) {
    return;
  }

  const most = available.reduce((a, b) =>
    (benchCounts.get(b.id) ?? 0) > (benchCounts.get(a.id) ?? 0) ? b : a,
  );
  throw new Error(
    `After round ${round.number} bench counts differ by ${spread} — ${nameOf(most.id)} has sat ` +
      `out ${benchCounts.get(most.id) ?? 0} time(s).`,
  );
}

/**
 * No partnership repeats while either player still has an unplayed partner. Generalised past the
 * first full rotation: a partnership played `n` times requires both players to have partnered
 * everyone else at least `n - 1` times.
 *
 * "Everyone else" is the players available this round who have been here at least as long as the
 * partner being repeated, and both halves of that matter once the roster moves. Someone who has
 * gone home can never be partnered again, so the empty column under their name is not a debt.
 * Someone who arrived two rounds ago has an empty column because they were not here — and since
 * one late arrival can absorb only one partnership a round, counting them would condemn every
 * other pairing on the court for a repeat there was no way to avoid.
 */
function assertPartnerVariety(
  round: Round,
  available: readonly RosterEntry[],
  partnerCounts: PairTally,
  nameOf: (id: PlayerId) => string,
): void {
  const repeated: Pairing[] = [];

  for (const match of round.matches) {
    for (const side of [match.sideA, match.sideB]) {
      const count = partnerCounts.increment(side[0], side[1]);
      if (count > 1) {
        repeated.push({ a: side[0], b: side[1], count });
      }
    }
  }

  const arrival = new Map(available.map((entry) => [entry.id, joinedAtRound(entry)]));

  for (const { a, b, count } of repeated) {
    for (const [player, partner] of [
      [a, b],
      [b, a],
    ]) {
      const unplayed = available.find(
        (entry) =>
          entry.id !== player &&
          joinedAtRound(entry) <= (arrival.get(partner) ?? 1) &&
          partnerCounts.count(entry.id, player) < count - 1,
      );

      if (unplayed) {
        throw new Error(
          `Round ${round.number} partners ${nameOf(a)} with ${nameOf(b)} for the ${count} time(s) ` +
            `while ${nameOf(player)} has partnered ${nameOf(unplayed.id)} fewer times than that.`,
        );
      }
    }
  }
}

interface Pairing {
  readonly a: PlayerId;
  readonly b: PlayerId;
  readonly count: number;
}

function playersOf(match: Match): PlayerId[] {
  return [...match.sideA, ...match.sideB];
}
