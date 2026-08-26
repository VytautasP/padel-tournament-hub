/*
 * What the session has already done to the people in it: who has partnered whom, who has faced
 * whom, and how often each player has sat out.
 *
 * The scheduler builds this up round by round as it walks the session — carried-through rounds
 * count exactly as much as ones it generates itself, which is what makes the search history-aware
 * rather than a function of the round number. Because it is accumulated in round order, every
 * question it answers is a question about the session *so far*, and that is what lets fairness be
 * decided at each prefix instead of only over a finished evening (decision #6).
 *
 * The roster moves while that walk is happening (decision #5), and both of the questions above
 * change shape when it does:
 *
 *   - **A late arrival's bench count starts at the current floor**, not at zero and not at the
 *     number of rounds they were absent for. Counting the rounds before they got here would make
 *     the planner see someone owed five matches and put them on court every remaining round; zero
 *     would make them the next in line for the bench they have not yet sat on. The floor is
 *     neither: they join the queue level with whoever is at the front of it, so the spread stays
 *     within one and nobody is compensated for an absence.
 *   - **A partnership is only a repeat against the players who were here as long.** Judging a
 *     repeat against someone who arrived two rounds ago would condemn every pairing on the court,
 *     since one late arrival can absorb only one partnership a round.
 *
 * The same walk carries the same two questions at team level, for the mode whose unit is a team
 * (decision #2c): which teams have met, and how often each has taken a bye. They are counted in
 * the same pass rather than by a second walk, because a session has one history and the level a
 * reader asks about is their business rather than the walk's.
 */
import type { MixedPairing } from './mixed-pairing';
import type { Match, PlayerId, RosterEntry, Round, TeamId } from './model';
import { PairTally } from './pair-tally';
import { everyone, seedAtFloor } from './queue-seed';
import { isAvailableIn, joinedAtRound } from './roster-availability';
import { teamsAvailableAmong } from './teams';
import type { TeamPlay } from './teams';

export class SessionHistory {
  private readonly partners = new PairTally();
  private readonly opponents = new PairTally();
  private readonly bench = new Map<PlayerId, number>();
  private readonly compromised = new Map<PlayerId, number>();
  private readonly teamBench = new Map<TeamId, number>();
  private readonly meetings = new PairTally();
  private readonly joinedAt: ReadonlyMap<PlayerId, number>;

  constructor(
    private readonly roster: readonly RosterEntry[],
    private readonly mixed: MixedPairing,
    private readonly play: TeamPlay,
  ) {
    this.joinedAt = new Map(roster.map((entry) => [entry.id, joinedAtRound(entry)]));
  }

  /** Fold one round in: its partnerships, its opponents, and a bench mark for everyone else. */
  record(round: Round): void {
    const available = this.roster.filter((entry) => isAvailableIn(entry, round.number));
    this.admit(available);

    const playing = new Set<PlayerId>();

    for (const match of round.matches) {
      for (const side of [match.sideA, match.sideB]) {
        this.partners.increment(side[0], side[1]);
        if (this.mixed.sameGender(side[0], side[1])) {
          for (const id of side) {
            this.compromised.set(id, this.sameGenderCount(id) + 1);
          }
        }
      }
      for (const a of match.sideA) {
        for (const b of match.sideB) {
          this.opponents.increment(a, b);
        }
      }
      for (const id of playersOf(match)) {
        playing.add(id);
      }
    }

    for (const entry of available) {
      if (!playing.has(entry.id)) {
        this.bench.set(entry.id, this.benchCount(entry.id) + 1);
      }
    }

    this.recordTeams(round);
  }

  benchCount(id: PlayerId): number {
    return this.bench.get(id) ?? 0;
  }

  /**
   * How often this player has been the one put in a same-gender pair.
   *
   * Hybrid fill compromises somebody every round an unequal roster plays, and this is the count
   * that stops it being the same somebody all evening (decision #7). It is a burden rather than
   * an achievement, so the planner spends it the way it spends the bench: on whoever carries
   * least of it.
   */
  sameGenderCount(id: PlayerId): number {
    return this.compromised.get(id) ?? 0;
  }

  /**
   * Each player's place in the queue to be compromised, within their own gender: 0 for whoever
   * has been in fewest same-gender pairs, ties by position in `order`.
   *
   * A rank rather than the count itself, for two reasons. It is bounded by the roster size, so
   * the planner's rotation term can never grow into the cost band above it however long the
   * evening runs. And it makes ties explicit — two players level on count are separated by roster
   * position, so the plan stays a function of the roster and the history alone (decision #6).
   *
   * Empty for a mode that does not pair across gender, which has no queue to be in.
   */
  compromiseRanks(order: readonly PlayerId[]): ReadonlyMap<PlayerId, number> {
    const ranks = new Map<PlayerId, number>();
    if (!this.mixed.mixes) {
      return ranks;
    }

    order.forEach((id, index) => {
      const carried = this.sameGenderCount(id);
      const ahead = order.filter((other, position) => {
        const theirs = this.sameGenderCount(other);

        return (
          position !== index &&
          this.mixed.sameGender(id, other) &&
          (theirs < carried || (theirs === carried && position < index))
        );
      });

      ranks.set(id, ahead.length);
    });

    return ranks;
  }

  partnerCount(a: PlayerId, b: PlayerId): number {
    return this.partners.count(a, b);
  }

  opponentCount(a: PlayerId, b: PlayerId): number {
    return this.opponents.count(a, b);
  }

  /** How often this team has sat a round out — the bench queue, at team level (decision #2c). */
  teamBenchCount(team: TeamId): number {
    return this.teamBench.get(team) ?? 0;
  }

  /** How often these two teams have faced each other. */
  teamsMetCount(a: TeamId, b: TeamId): number {
    return this.meetings.count(a, b);
  }

  /**
   * Would putting these two teams across the net again leave either of them with an opponent they
   * have never faced?
   *
   * `starvesAPartner` asked one level up, and for the same reason: it is the referee's variety
   * rule asked forwards, so the search can avoid a rematch that is unfair rather than be caught
   * making one. Teams have no arrival windows to allow for — a team is in the session from the
   * pairing screen — so the question is only about who is available this round.
   */
  starvesAnOpponent(a: TeamId, b: TeamId, available: readonly TeamId[]): boolean {
    const met = this.teamsMetCount(a, b);
    if (met === 0) {
      return false;
    }

    return [a, b].some((team) =>
      available.some((other) => other !== team && this.teamsMetCount(other, team) < met),
    );
  }

  /**
   * Would partnering these two starve someone of a partner they have never had?
   *
   * This is the referee's partner-variety rule (`assertSessionValid`) asked forwards instead of
   * backwards: pairing two players for the `k + 1`th time is only fair once both of them have
   * partnered everyone else at least `k` times. Answering it here — before the pair is committed
   * — is what lets the search treat "no partnership repeats while any player still has an
   * unplayed partner" as something to avoid rather than something to be caught doing.
   *
   * "Everyone else" is `available`, the players this round could schedule, and only those of them
   * who have been here at least as long as the partner in question. A player who arrived after
   * that partner did has had fewer rounds to be paired with, so their empty column is a fact
   * about when they turned up rather than evidence of an unfair pairing.
   */
  starvesAPartner(
    a: PlayerId,
    b: PlayerId,
    available: readonly PlayerId[],
    eligible: (player: PlayerId, other: PlayerId) => boolean,
  ): boolean {
    const played = this.partnerCount(a, b);
    if (played === 0) {
      return false;
    }

    return [
      [a, b],
      [b, a],
    ].some(([player, partner]) =>
      available.some(
        (other) =>
          other !== player &&
          eligible(player, other) &&
          this.joinedBy(other, partner) &&
          this.partnerCount(other, player) < played,
      ),
    );
  }

  /** Was `other` here by the time `partner` was — so did they have the same chance to be paired? */
  private joinedBy(other: PlayerId, partner: PlayerId): boolean {
    return (this.joinedAt.get(other) ?? 1) <= (this.joinedAt.get(partner) ?? 1);
  }

  /**
   * The same fold, one level up: which teams met, and which sat the round out.
   *
   * Read off `match.teams` rather than worked out from the players on court, because that is the
   * field that says who a side was playing *as* — the two are the same today and stop being the
   * same the moment decision #2b repairs a team with a new partner. Empty for a mode with no
   * teams, so the walk is unbranched.
   */
  private recordTeams(round: Round): void {
    if (!this.play.plays) {
      return;
    }

    const available = teamsAvailableAmong(this.play.teams, this.roster, round.number);
    seedAtFloor(this.teamBench, available, everyone);

    const playing = new Set<TeamId>();
    for (const match of round.matches) {
      if (!match.teams) {
        continue;
      }
      this.meetings.increment(match.teams.sideA, match.teams.sideB);
      playing.add(match.teams.sideA);
      playing.add(match.teams.sideB);
    }

    for (const team of available) {
      if (!playing.has(team.id)) {
        this.teamBench.set(team.id, this.teamBenchCount(team.id) + 1);
      }
    }
  }

  /**
   * Give anyone newly available a bench count, seeded at the floor of the players already here.
   *
   * Doing it as the round is folded in, rather than at construction, is what makes it the floor
   * *at the moment they arrived* — the one number that leaves the spread within one without
   * handing them a debt the schedule would have to pay off.
   */
  private admit(available: readonly RosterEntry[]): void {
    seedAtFloor(this.bench, available, everyone);

    // The same seeding, one gender at a time: a woman arriving into a roster whose women have
    // each been compromised twice is not owed two compromises, nor is she first in line for the
    // next one. Comparing her only against the players she could be compromised *with* is what
    // keeps the two genders' counts from being read as one queue.
    seedAtFloor(this.compromised, available, (a, b) => this.mixed.sameGender(a, b));
  }
}

function playersOf(match: Match): PlayerId[] {
  return [...match.sideA, ...match.sideB];
}
