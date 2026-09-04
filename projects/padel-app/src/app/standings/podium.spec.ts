/*
 * The podium's two rules, at the seam where both are decided.
 *
 * Who is on it is a filter over the table; which metal each place carries is a function of the
 * position the engine printed and of nothing else. Both are here because both are the kind of
 * thing a screen would otherwise decide by accident — a template that took the first three rows,
 * or one that handed out gold, silver and bronze by the order they came out of the loop.
 *
 * A joint position is what separates the two readings. Two players tied at the top are both first
 * and both take gold, and the place behind them is third: the engine used up second on the tie
 * (decision #8), so nothing on this screen is silver.
 */
import { podiumOf } from './podium';
import type { Metal, PodiumPlace } from './podium';
import type { StandingRow } from './standing-row';

describe('the podium', () => {
  describe('who stands on it', () => {
    it('is everybody the engine placed third or better', () => {
      const podium = podiumOf(standingsOf([1, 2, 3, 4, 5]));

      expect(namesOn(podium)).toEqual(['P1', 'P2', 'P3']);
    });

    it('keeps a whole joint third rather than the first three rows', () => {
      const podium = podiumOf(standingsOf([1, 2, 3, 3, 5]));

      expect(namesOn(podium)).toEqual(['P1', 'P2', 'P3', 'P4']);
    });

    it('is empty before anybody has been on a scored court', () => {
      expect(podiumOf(standingsOf([1, 1, 1, 1], 0))).toEqual([]);
    });
  });

  describe('the metal a place carries', () => {
    it('is gold, silver and bronze down the three places', () => {
      expect(metalsOn(podiumOf(standingsOf([1, 2, 3])))).toEqual(['gold', 'silver', 'bronze']);
    });

    it('is gold twice for a joint first, and bronze for the place that follows', () => {
      // Second is used up by the tie, so no silver is awarded (decision #8).
      expect(metalsOn(podiumOf(standingsOf([1, 1, 3])))).toEqual(['gold', 'gold', 'bronze']);
    });

    it('is silver twice for a joint second', () => {
      expect(metalsOn(podiumOf(standingsOf([1, 2, 2])))).toEqual(['gold', 'silver', 'silver']);
    });
  });
});

/** Standings at the given positions, one row apiece, each named for where it sits. */
function standingsOf(positions: readonly number[], matchesPlayed = 4): readonly StandingRow[] {
  return positions.map((position, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    position,
    joint: positions.filter((other) => other === position).length > 1,
    matchesPlayed,
    points: 0,
    pointsPerMatch: 0,
  }));
}

function namesOn(podium: readonly PodiumPlace[]): string[] {
  return podium.map((place) => place.standing.name);
}

function metalsOn(podium: readonly PodiumPlace[]): Metal[] {
  return podium.map((place) => place.metal);
}
