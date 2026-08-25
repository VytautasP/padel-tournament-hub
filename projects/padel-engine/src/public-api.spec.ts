import * as publicApi from './public-api';

describe('padel-engine public API', () => {
  it('exports nothing yet', () => {
    // The bundler synthesises a `default` key on the namespace object for interop;
    // it is not something the library exports.
    const exported = Object.keys(publicApi).filter((name) => name !== 'default');

    expect(exported).toEqual([]);
  });
});
