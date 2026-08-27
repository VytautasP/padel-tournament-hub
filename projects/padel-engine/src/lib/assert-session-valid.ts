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
import { FixtureLedger } from './fixture-ledger';
import { mixedPairingIn } from './mixed-pairing';
import type { MixedPairing } from './mixed-pairing';
import type { Match, PlayerId, RosterEntry, Round, Session, Team, TeamId } from './model';
import { PairTally } from './pair-tally';
import { everyone, forgetAbsent, seedAtFloor } from './queue-seed';
import { availableIn, joinedAtRound } from './roster-availability';
import { assertScorePairValid } from './score-rules';
import { assertSessionShape, courtsInPlay, PLAYERS_PER_COURT } from './session-shape';
import { teamLineupIn, teamPlayIn, teamsAvailableIn } from './teams';
import type { TeamPlay } from './teams';

export function assertSessionValid(session: Session): void {
  assertSessionShape(session);

  const names = new Map(session.roster.map((entry) => [entry.id, entry.name]));
  const nameOf = (id: PlayerId): string => names.get(id) ?? id;

  assertMatchIdsUnique(session);
  assertGeneratedRoundsComeFirst(session);
  assertScoresSumToTarget(session);

  const mixed = mixedPairingIn(session);
  const play = teamPlayIn(session);
  const partnerCounts = new PairTally();
  const meetings = new FixtureLedger();
  const benchCounts = new Map<PlayerId, number>();
  const teamBenchCounts = new Map<TeamId, number>();
  const sameGenderCounts = new Map<PlayerId, number>();

  assertTeamsNamedOnlyWhereTheyExist(session, play);

  for (const round of session.rounds) {
    if (round.matches.length === 0) {
      continue;
    }

    // The roster this round is answerable for. Someone who had not arrived yet, or who had
    // already gone home, is neither scheduled here nor benched here nor owed a partnership here.
    const available = availableIn(session, round.number);

    assertRoundStructure(round, session, available, nameOf);

    // The teams this round could have scheduled, and the players they would have fielded. Empty
    // in the modes that rotate partners, which have neither.
    const availableTeams = play.plays ? teamsAvailableIn(session, round.number) : [];
    const onCall = new Set(
      availableTeams.flatMap((team) => teamLineupIn(team, session.roster, round.number)),
    );

    // Everything from here down is a prefix check: it holds after this round, given every
    // round before it, so a session truncated at any point is still valid.
    //
    // Which unit they are asked of is the whole of the difference between the modes (decision
    // #2c). Team Americano rotates a bye between teams and rotates opponents between teams; the
    // modes that rotate partners rotate a bench and a partnership between players. Asking both
    // sets of both would not be twice as strict, it would be wrong: a player of a team on a bye
    // has not been kept off a court by the scheduler, their team has, and a replacement who
    // joined in round 3 has sat out exactly as often as the team she plays for — which is not
    // what a count of her own rounds says, and never can be.
    if (play.plays) {
      // The `needs partner` check first: a stranded player on a court also makes the side wrong
      // for its team, and saying which of the two problems it actually is helps more.
      assertNobodyStrandedOnCourt(round, onCall, nameOf);
      assertTeamSides(round, session.roster, play, nameOf);
      meetings.openRound(availableTeams);
      countBench(teamsIn(round), availableTeams, teamBenchCounts);
      assertBenchSpread(round, availableTeams, teamBenchCounts, (id) => `team ${play.nameOf(id)}`);
      assertOpponentVariety(round, availableTeams, meetings, play);
    } else {
      countBench(playersIn(round), available, benchCounts);
      assertBenchSpread(round, available, benchCounts, nameOf);
      // Partner variety is asked of every mode but Team Americano, where the partnership is the
      // format rather than something the scheduler chose — exempt for the same reason a Mixicano
      // same-gender pair is (ADR-0010). What replaces it is `assertOpponentVariety` above.
      assertPartnerVariety(round, available, partnerCounts, mixed, nameOf);
    }

    assertMixedPairing(round, available, mixed, sameGenderCounts, nameOf);
  }
}

/** Only Team Americano's matches say which teams played them; the other modes have none to say. */
function assertTeamsNamedOnlyWhereTheyExist(session: Session, play: TeamPlay): void {
  if (play.plays) {
    return;
  }

  for (const round of session.rounds) {
    const named = round.matches.find((match) => match.teams !== undefined);
    if (named) {
      throw new Error(`Match ${named.id} names teams, but this session is ${session.mode}.`);
    }
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
function countBench<Id extends string>(
  playing: ReadonlySet<Id>,
  available: readonly Unit<Id>[],
  benchCounts: Map<Id, number>,
): void {
  // Seeded by the same code the scheduler seeds with, so the two cannot disagree about what a
  // newcomer — or a team back from being orphaned — starts on.
  forgetAbsent(benchCounts, available);
  seedAtFloor(benchCounts, available, everyone);

  for (const unit of available) {
    const satOut = benchCounts.get(unit.id) ?? 0;
    benchCounts.set(unit.id, playing.has(unit.id) ? satOut : satOut + 1);
  }
}

/**
 * Whatever the bench rotates: a player in Americano, a whole team in Team Americano.
 *
 * It is the same rule at either level (decision #2c), so the two checks around this take the
 * level as a parameter rather than existing twice.
 */
interface Unit<Id extends string> {
  readonly id: Id;
}

/**
 * Bench counts never differ by more than one — at every prefix, across the players the round
 * could have put on court. Someone who has gone home stops accruing a bench and stops being
 * compared: their count is a record of the evening they played, not of the one still going.
 */
function assertBenchSpread<Id extends string>(
  round: Round,
  available: readonly Unit<Id>[],
  benchCounts: Map<Id, number>,
  nameOf: (id: Id) => string,
): void {
  const counts = available.map((unit) => benchCounts.get(unit.id) ?? 0);
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
 * Mixicano's two rules, both consequences of same-gender pairing being a soft cost rather than a
 * hard constraint (decision #7).
 *
 *   - **Minimised.** A round forms exactly as many same-gender pairs as the players on court
 *     force and not one more: `|women - men| / 2`, since every man on court can partner a woman
 *     and only the surplus on one side is left over. Fewer is arithmetically impossible; more
 *     means the scheduler compromised somebody it did not have to.
 *   - **Rotated.** Which players carry that compromise is free, and it goes to whoever has
 *     carried it least. So nobody in a same-gender pair this round has been in more of them than
 *     a player of their gender who is on court and *not* in one — that player could have taken
 *     their place, because within a gender the surplus is interchangeable.
 *
 * Both are prefix checks, like the bench spread: an evening that stops after round four has to
 * have spread its compromises over those four rounds, not over the twelve it planned for.
 *
 * A mode that does not pair across gender skips the check, where every question it asks would
 * answer "none forced" and "nobody compromised".
 */
function assertMixedPairing(
  round: Round,
  available: readonly RosterEntry[],
  mixed: MixedPairing,
  sameGenderCounts: Map<PlayerId, number>,
  nameOf: (id: PlayerId) => string,
): void {
  if (!mixed.mixes) {
    return;
  }

  const playing = round.matches.flatMap(playersOf);
  const sides = round.matches.flatMap((match) => [match.sideA, match.sideB]);
  const compromised = sides.filter((side) => mixed.sameGender(side[0], side[1]));
  const forced = mixed.forcedSameGenderPairs(playing);

  if (compromised.length > forced) {
    const [a, b] = compromised[0];
    throw new Error(
      `Round ${round.number} makes ${compromised.length} same-gender pair(s) where ${forced} ` +
        `is forced — ${nameOf(a)} and ${nameOf(b)} could have been paired across.`,
    );
  }

  // Counts as they stood *before* this round: the question is who was owed the compromise when
  // the round was planned, not who is owed it now that it has been handed out.
  seedAtFloor(sameGenderCounts, available, (a, b) => mixed.sameGender(a, b));
  const carried = new Set(compromised.flat());
  const burden = (id: PlayerId): number => sameGenderCounts.get(id) ?? 0;

  for (const id of carried) {
    const spared = playing.find(
      (other) => !carried.has(other) && mixed.sameGender(id, other) && burden(other) < burden(id),
    );

    if (spared) {
      throw new Error(
        `Round ${round.number} puts ${nameOf(id)} in a same-gender pair for the ` +
          `${burden(id) + 1} time(s) while ${nameOf(spared)} has been in ${burden(spared)}.`,
      );
    }
  }

  for (const id of carried) {
    sameGenderCounts.set(id, burden(id) + 1);
  }
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
 *
 * In Mixicano it is also the players they could be partnered *with*. A woman's partners come from
 * the men, so the empty columns under the other women are not debts either — they are the format.
 * Counting them would make the fifth round of an eight-player Mixicano evening a violation: by the
 * fourth everyone has partnered every eligible player once, and the fifth has to repeat one of
 * them. Same-gender pairs answer to the rules above this one instead — minimised and rotated —
 * because they are the compromise hybrid fill forced rather than a partnership anyone chose.
 */
function assertPartnerVariety(
  round: Round,
  available: readonly RosterEntry[],
  partnerCounts: PairTally,
  mixed: MixedPairing,
  nameOf: (id: PlayerId) => string,
): void {
  const repeated: Pairing[] = [];

  for (const match of round.matches) {
    for (const side of [match.sideA, match.sideB]) {
      const count = partnerCounts.increment(side[0], side[1]);
      if (count > 1 && !mixed.sameGender(side[0], side[1])) {
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
          !mixed.sameGender(entry.id, player) &&
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

/**
 * Nobody flagged `needs partner` is on a court.
 *
 * The scheduler cannot produce one — a team a player short is not in the list it schedules from —
 * so this is here for the sessions the referee actually exists for: one edited by hand, one back
 * from storage, one written by an app that thought a lone player could be dropped into a gap.
 */
function assertNobodyStrandedOnCourt(
  round: Round,
  onCall: ReadonlySet<PlayerId>,
  nameOf: (id: PlayerId) => string,
): void {
  for (const match of round.matches) {
    for (const id of playersOf(match)) {
      if (!onCall.has(id)) {
        throw new Error(`Match ${match.id} schedules ${nameOf(id)}, who needs a partner.`);
      }
    }
  }
}

/**
 * Every side is a team, and it is the team the match fielded in that round.
 *
 * Both halves matter. A side holding two players who are not a pair would be Americano wearing
 * Team Americano's name; and a side whose players are not the team named on the match would make
 * every count that reads `match.teams` — the standings, the bench queue, the fixture list — a
 * count of something that did not happen.
 *
 * The team is who it was in *that round*, not who it is now. A team repaired mid-session
 * (decision #2b) keeps its id and its points, and the rounds it played before the repair are
 * still the rounds its old pair played: holding them to the pair it fields today would call every
 * one of them a forgery.
 */
function assertTeamSides(
  round: Round,
  roster: readonly RosterEntry[],
  play: TeamPlay,
  nameOf: (id: PlayerId) => string,
): void {
  for (const match of round.matches) {
    if (!match.teams) {
      throw new Error(`Match ${match.id} does not say which teams played it.`);
    }

    for (const side of ['sideA', 'sideB'] as const) {
      const teamId = match.teams[side];
      const team = play.byId(teamId);
      if (!team) {
        throw new Error(`Match ${match.id} names team "${teamId}", which this session has not.`);
      }

      const played = [...match[side]].sort();
      const lineup = teamLineupIn(team, roster, round.number).sort();
      if (played.join('|') !== lineup.join('|')) {
        throw new Error(
          `Match ${match.id} fields ${played.map(nameOf).join(' & ')} as team ` +
            `${play.nameOf(teamId)}, who are not that team.`,
        );
      }
    }
  }
}

/**
 * No fixture repeats while either team still has an opponent it has never faced. Generalised past
 * the first full rotation exactly as partner variety is: a fixture played `n` times requires both
 * teams to have met every other available team at least `n - 1` times.
 *
 * "Every other" is the teams this round could have scheduled. A team that can no longer take the
 * court will never be met again, so the empty column under its name is not a debt. And the count
 * itself runs from the last time the field changed rather than from round one, because a fixture
 * list is a rotation over a field — see `fixture-ledger.ts`, which is where both this rule and the
 * scheduler get the number from.
 */
function assertOpponentVariety(
  round: Round,
  available: readonly Team[],
  meetings: FixtureLedger,
  play: TeamPlay,
): void {
  const repeated: Meeting[] = [];

  for (const match of round.matches) {
    if (!match.teams) {
      continue;
    }

    const count = meetings.increment(match.teams.sideA, match.teams.sideB);
    if (count > 1) {
      repeated.push({ a: match.teams.sideA, b: match.teams.sideB, count });
    }
  }

  for (const { a, b, count } of repeated) {
    for (const team of [a, b]) {
      const unplayed = available.find(
        (other) => other.id !== team && meetings.count(other.id, team) < count - 1,
      );

      if (unplayed) {
        throw new Error(
          `Round ${round.number} puts ${play.nameOf(a)} against ${play.nameOf(b)} for the ` +
            `${count} time(s) while ${play.nameOf(team)} has met ${play.nameOf(unplayed.id)} ` +
            'fewer times than that.',
        );
      }
    }
  }
}

interface Meeting {
  readonly a: TeamId;
  readonly b: TeamId;
  readonly count: number;
}

/** Everyone on court this round. */
function playersIn(round: Round): Set<PlayerId> {
  return new Set(round.matches.flatMap(playersOf));
}

/** Every team on court this round, read off the matches rather than off the players. */
function teamsIn(round: Round): Set<TeamId> {
  return new Set(
    round.matches.flatMap((match) => (match.teams ? [match.teams.sideA, match.teams.sideB] : [])),
  );
}

function playersOf(match: Match): PlayerId[] {
  return [...match.sideA, ...match.sideB];
}
