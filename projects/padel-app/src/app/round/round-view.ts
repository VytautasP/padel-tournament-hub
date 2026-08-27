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
 */
import type { MatchId, MatchScore, PlayerId, Session } from 'padel-engine';
import { benchedIn } from '../session/bench';
import { courtNameFor } from '../session/court-names';

export interface CourtView {
  /** What a score is addressed to. Courts are scored by id and never by position (ADR-0007). */
  readonly matchId: MatchId;
  readonly courtNumber: number;
  /** What the organizer calls this court, or `Court N` where they named nothing (ADR-0017 §6). */
  readonly name: string;
  readonly sideA: readonly string[];
  readonly sideB: readonly string[];
  /** The result, or `undefined` while the court is still playing. */
  readonly score?: MatchScore;
}

export interface RoundView {
  readonly number: number;
  readonly courts: readonly CourtView[];
  /** The players this round does not put on a court. Empty when the roster fits exactly. */
  readonly bench: readonly string[];
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

  return {
    number: round.number,
    courts: round.matches.map((match) => ({
      matchId: match.id,
      courtNumber: match.courtNumber,
      name: courtNameFor(courtNames, match.courtNumber),
      sideA: match.sideA.map(nameOf),
      sideB: match.sideB.map(nameOf),
      score: match.score,
    })),
    bench: benchedIn(session, roundNumber).map((entry) => entry.name),
  };
}
