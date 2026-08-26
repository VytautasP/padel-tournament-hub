import { completeRotationRoundCount, MAX_SUGGESTED_ROUND_COUNT } from './round-defaults';

describe('the round count Review pre-fills', () => {
  it('is a complete rotation: every player has partnered every other one', () => {
    // Four players on one court hold six pairs, and a round consumes two of them.
    expect(completeRotationRoundCount(4, 1)).toBe(3);
    // Five players hold ten pairs; the fifth sits out one round each time round.
    expect(completeRotationRoundCount(5, 1)).toBe(5);
    // Eight on two courts: everybody plays every round, and everybody has seven partners.
    expect(completeRotationRoundCount(8, 2)).toBe(7);
  });

  it('counts only the courts the roster can actually staff', () => {
    // Six players booked onto three courts still play one court a round. A rotation computed as
    // though all three were in play would end the evening a third of the way through it.
    expect(completeRotationRoundCount(6, 3)).toBe(completeRotationRoundCount(6, 1));
  });

  it('stops at a number of rounds people will actually play', () => {
    // Eleven on two courts want fourteen rounds. Nobody is playing fourteen rounds (decision #6).
    expect(completeRotationRoundCount(11, 2)).toBe(MAX_SUGGESTED_ROUND_COUNT);
    expect(completeRotationRoundCount(16, 1)).toBe(MAX_SUGGESTED_ROUND_COUNT);
  });

  it('never suggests an evening with no rounds in it', () => {
    expect(completeRotationRoundCount(4, 99)).toBeGreaterThanOrEqual(1);
  });
});
