import * as publicApi from './public-api';
import { assertSessionValid, createSession, formatSchedule, generateRemaining } from './public-api';
import { americanoConfig } from './test-support/session-fixtures';

describe('padel-engine public API', () => {
  it('exports the operations this ticket adds and nothing more', () => {
    // The bundler synthesises a `default` key on the namespace object for interop;
    // it is not something the library exports.
    const exported = Object.keys(publicApi)
      .filter((name) => name !== 'default')
      .sort();

    expect(exported).toEqual([
      'addPlayer',
      'addRound',
      'assertSessionValid',
      'computeStandings',
      'computeTeamStandings',
      'createSession',
      'finishSession',
      'formatSchedule',
      'generateRemaining',
      'recordScore',
      'removePlayer',
      'sameGenderSides',
    ]);

    const session = generateRemaining(createSession(americanoConfig()));
    assertSessionValid(session);
    expect(formatSchedule(session).length).toBeGreaterThan(0);
  });
});
