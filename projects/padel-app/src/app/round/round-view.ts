/*
 * One round, turned from ids into the words on the screen.
 *
 * The engine's document is all `PlayerId`s, because identity is by id and never by name
 * (decision #9). The screen is all names, because four people walking to a court do not know
 * their ids. This is that translation, and it is a plain function so the shape of a round can be
 * checked without rendering one.
 *
 * The bench is derived rather than read: the engine stores who is playing, and whoever the round
 * does not name is sitting out. Deriving it is what keeps it honest when a roster changes under
 * an already-generated round — and it is derived in `bench.ts` rather than here, so that the strip
 * under the courts and the badges on the Players tab cannot answer the question differently.
 *
 * The same-gender mark is derived here for the same reason, one level down: the engine answers
 * `sameGenderSides` from the roster and the pair on every read (ADR-0010), so correcting a gender
 * typo in round 6 re-marks round 1 rather than leaving it wrong. Nothing in this file stores it,
 * and there is nowhere it could be stored.
 */
import { sameGenderSides } from 'padel-engine';
import type { MatchId, MatchScore, PlayerId, Session } from 'padel-engine';
import { benchedIn } from '../session/bench';
import { courtNameFor } from '../session/court-names';

/** One half of a court: who is on it, and whether the roster forced them together. */
export interface SideView {
  readonly names: readonly string[];
  /**
   * A same-gender pair — the compromise hybrid fill forced (ADR-0010), and always false outside
   * Mixicano.
   *
   * It is on the side rather than on the court because it is a fact about one pair of two: the
   * other side of the same court may be perfectly mixed, and marking the court would accuse it.
   */
  readonly sameGender: boolean;
}

export interface CourtView {
  /** What a score is addressed to. Courts are scored by id and never by position (ADR-0007). */
  readonly matchId: MatchId;
  readonly courtNumber: number;
  /** What the organizer calls this court, or `Court N` where they named nothing (ADR-0017 §6). */
  readonly name: string;
  readonly sideA: SideView;
  readonly sideB: SideView;
  /** The result, or `undefined` while the court is still playing. */
  readonly score?: MatchScore;
}

export interface RoundView {
  readonly number: number;
  readonly courts: readonly CourtView[];
  /** The players this round does not put on a court. Empty when the roster fits exactly. */
  readonly bench: readonly string[];
  /**
   * Whether anything in this round carries the mark — which is whether the legend explaining it
   * is worth the line it takes.
   *
   * Asked of the round rather than of each court, because one legend under the courts is what
   * ADR-0010 asks for: a marker the organizer can point at, explained once, rather than a banner
   * repeated on every card that happens to hold one.
   */
  readonly hasSameGenderPair: boolean;
}

/**
 * The round as the Round tab renders it, or `null` if it has not been generated yet.
 *
 * `courtNames` arrives beside the session rather than inside it because the engine's document has
 * no idea a court can be called anything. Resolving it here, where ids already become names, is
 * what lets every screen holding a `CourtView` — the card, the sheet, the label read out loud —
 * say the same word without each one remembering the fallback rule.
 */
export function roundView(
  session: Session,
  roundNumber: number,
  courtNames: readonly string[],
): RoundView | null {
  const round = session.rounds.find((candidate) => candidate.number === roundNumber);
  if (round === undefined || round.matches.length === 0) {
    return null;
  }

  const nameOf = (id: PlayerId): string =>
    session.roster.find((entry) => entry.id === id)?.name ?? id;

  const courts = round.matches.map((match) => {
    const marked = new Set(sameGenderSides(session, match));

    return {
      matchId: match.id,
      courtNumber: match.courtNumber,
      name: courtNameFor(courtNames, match.courtNumber),
      sideA: { names: match.sideA.map(nameOf), sameGender: marked.has('A') },
      sideB: { names: match.sideB.map(nameOf), sameGender: marked.has('B') },
      score: match.score,
    };
  });

  return {
    number: round.number,
    courts,
    bench: benchedIn(session, roundNumber).map((entry) => entry.name),
    hasSameGenderPair: courts.some((court) => court.sideA.sameGender || court.sideB.sameGender),
  };
}
