/*
 * The leaderboard, derived from the rounds and stored nowhere (decision #17).
 *
 * `computeStandings` reads the recorded scores every time it is asked. There is no standings
 * field on the session, so there is nothing to invalidate and nothing to drift: a score typed
 * into the wrong column and corrected a minute later recomputes for free, which is the whole
 * reason corrections are the ordinary path in `recordScore` rather than an exceptional one.
 *
 * Two rules decide the order, and both come from the same place — the bench.
 *
 *   - **Points per match played, not total points** (decision #4). A player who sat out a round
 *     scored nothing that round, and ranking on totals would charge them for it. Rate is what
 *     makes the bench free to rotate, which is what makes it possible to seat any roster at all.
 *   - **Ties are resolved on evidence and then stop** (decision #8). Total points, then
 *     head-to-head, and if two players are still level the standings say they are joint rather
 *     than inventing a separator. Roster order is not evidence.
 */
import { deepFreeze } from './freeze';
import type { Match, MatchScore, PlayerId, RosterEntry, Session } from './model';
import { assertSessionShape } from './session-shape';

/**
 * One player's line in the table.
 *
 * `position` is the place itself, so a joint second is `2` for both players and the next player
 * is `4` — the places a joint position occupies are used up, not reassigned. `joint` says the
 * position is shared, which is what stops a reader treating the order inside it as a result:
 * players level after every tier are listed in roster order, and that order means nothing.
 */
export interface Standing {
  readonly playerId: PlayerId;
  readonly name: string;
  /** 1-based place, shared by everyone in a joint position. */
  readonly position: number;
  /** Whether this place is shared with another player. */
  readonly joint: boolean;
  /** Matches with a recorded score. A court still playing counts for nothing. */
  readonly matchesPlayed: number;
  /** Points scored across those matches. */
  readonly points: number;
  /** `points / matchesPlayed`, or 0 for a player who has not been on court yet. */
  readonly pointsPerMatch: number;
}

/**
 * What a player has done across some set of matches: the raw pair every tier is computed from.
 *
 * The same shape answers two different questions — the whole session for the ranking, and the
 * matches inside a tied group for the head-to-head tier — which is why one fold builds both and
 * one comparison orders both.
 */
interface Tally {
  readonly playerId: PlayerId;
  readonly name: string;
  points: number;
  matchesPlayed: number;
}

/** A match that has been played, so its score is there to be read rather than checked for. */
type PlayedMatch = Match & { readonly score: MatchScore };

/** The standings, ranked, one line per roster entry. Frozen, like every other engine result. */
export function computeStandings(session: Session): readonly Standing[] {
  assertSessionShape(session);

  const played = playedMatches(session);
  const ranked = rank(tallyMatches(session.roster, played), played);

  return deepFreeze(
    ranked.flatMap((group, index) =>
      group.map((tally) => ({
        playerId: tally.playerId,
        name: tally.name,
        position: placeOf(ranked, index),
        joint: group.length > 1,
        matchesPlayed: tally.matchesPlayed,
        points: tally.points,
        pointsPerMatch: rateOf(tally),
      })),
    ),
  );
}

/**
 * Fold played matches into one tally per player, in the order the players were given.
 *
 * Seeded from a list of players rather than discovered from the matches, so a player who has not
 * been on court gets a line of zeroes instead of being missing, and an id that appears in a match
 * but not in the seed is ignored rather than conjuring a competitor. `counts` decides whether a
 * side's result belongs in the tally, which is the only thing the head-to-head tier needs to say
 * differently: it counts a side only where that side faced the tied group.
 */
function tallyMatches(
  players: readonly RosterEntry[],
  matches: readonly PlayedMatch[],
  counts: (opponents: readonly PlayerId[]) => boolean = () => true,
): Tally[] {
  const tallies = new Map<PlayerId, Tally>(
    players.map((entry) => [
      entry.id,
      { playerId: entry.id, name: entry.name, points: 0, matchesPlayed: 0 },
    ]),
  );

  for (const match of matches) {
    for (const [side, points, opponents] of sidesOf(match)) {
      if (!counts(opponents)) {
        continue;
      }
      for (const id of side) {
        const tally = tallies.get(id);
        if (tally) {
          tally.points += points;
          tally.matchesPlayed++;
        }
      }
    }
  }

  return [...tallies.values()];
}

/**
 * The tallies in ranked order, grouped: each group is a set of players nothing could separate.
 *
 * The tiers are applied in order and each one only ever splits a group further, so a group that
 * survives to the end is a genuine joint position rather than a tier that was skipped.
 */
function rank(tallies: readonly Tally[], played: readonly PlayedMatch[]): Tally[][] {
  const compare = (a: Tally, b: Tally): number => compareRate(a, b) || comparePoints(a, b);
  const byPoints = runsOf([...tallies].sort(compare), compare);

  return byPoints.flatMap((group) => splitByHeadToHead(group, played));
}

/**
 * A group tied on rate and on total points, split by what the players did to each other.
 *
 * Head-to-head only speaks where there is something to hear: every player in the group needs at
 * least one match against another member, or the tier would be ranking a record against no record
 * at all. A roster too big to fit a complete round-robin makes that ordinary rather than exotic,
 * so where one member never met the group the tier declines for the whole group and the tie
 * stands as joint — half a tier is not a tier.
 *
 * Where it does apply, a player's head-to-head standing is again a rate — points per meeting —
 * because members of the group need not have met the same number of times, and the same reasoning
 * that rules out total points at the top rules them out here. One number per player is also what
 * orders three players who beat each other in a circle, where comparing them in pairs would not.
 */
function splitByHeadToHead(group: readonly Tally[], played: readonly PlayedMatch[]): Tally[][] {
  if (group.length === 1) {
    return [[...group]];
  }

  const meetings = headToHead(group, played);
  if (meetings.some((player) => player.meeting.matchesPlayed === 0)) {
    return [[...group]];
  }

  const compare = (a: Meeting, b: Meeting): number => compareRate(a.meeting, b.meeting);

  return runsOf([...meetings].sort(compare), compare).map((run) =>
    run.map((player) => player.overall),
  );
}

/** A tied player's whole-session record, alongside what they did against the rest of the group. */
interface Meeting {
  readonly overall: Tally;
  readonly meeting: Tally;
}

/** Each member of the group, paired with their record from the matches where they faced another. */
function headToHead(group: readonly Tally[], played: readonly PlayedMatch[]): Meeting[] {
  const members = new Set(group.map((tally) => tally.playerId));
  const meetings = tallyMatches(
    group.map((tally) => ({ id: tally.playerId, name: tally.name })),
    played,
    (opponents) => opponents.some((id) => members.has(id)),
  );

  // `tallyMatches` returns one tally per player given, in the order given, so the lists line up.
  return group.map((overall, index) => ({ overall, meeting: meetings[index] }));
}

/** Higher rate first. Compared as a fraction, so two whole tallies never disagree by a rounding. */
function compareRate(a: Tally, b: Tally): number {
  if (a.matchesPlayed === 0 || b.matchesPlayed === 0) {
    return rateOf(b) - rateOf(a);
  }

  return b.points * a.matchesPlayed - a.points * b.matchesPlayed;
}

/** Higher total first. */
function comparePoints(a: Tally, b: Tally): number {
  return b.points - a.points;
}

function rateOf(tally: Tally): number {
  return tally.matchesPlayed === 0 ? 0 : tally.points / tally.matchesPlayed;
}

/**
 * Split a sorted list into runs: consecutive entries `compare` cannot tell apart.
 *
 * The list is already in order, so neighbours are all that need asking — everything that compares
 * equal to the entry that opened the run belongs in it.
 */
function runsOf<T>(sorted: readonly T[], compare: (a: T, b: T) => number): T[][] {
  const runs: T[][] = [];

  for (const entry of sorted) {
    const last = runs.at(-1);
    if (last && compare(last[0], entry) === 0) {
      last.push(entry);
    } else {
      runs.push([entry]);
    }
  }

  return runs;
}

/** The place a group occupies: one past everyone above it, so joint positions use their places up. */
function placeOf(groups: readonly Tally[][], index: number): number {
  return groups.slice(0, index).reduce((places, group) => places + group.length, 1);
}

/** Every match that has been played — a match without a score is a court that has not finished. */
function playedMatches(session: Session): PlayedMatch[] {
  return session.rounds
    .flatMap((round) => round.matches)
    .filter((match): match is PlayedMatch => match.score !== undefined);
}

/** Both sides of a played match: who was on it, what it scored, and who it was against. */
function sidesOf(
  match: PlayedMatch,
): readonly (readonly [readonly PlayerId[], number, readonly PlayerId[]])[] {
  return [
    [match.sideA, match.score.sideA, match.sideB],
    [match.sideB, match.score.sideB, match.sideA],
  ];
}
