/*
 * The first launch of a device, in a basement (ADR-0025 §4).
 *
 * Anonymous sign-in mints the uid on Firebase's servers, so a device that has never had a network
 * has no owner and therefore nothing to read. ADR-0025 calls that a state to be designed rather
 * than a failure to be logged, and names the two wrong answers explicitly: a spinner that never
 * resolves, and an empty landing page offering to start an evening the app cannot store. This spec
 * is those two sentences.
 */
import { copy } from './copy/copy';
import { AppHarness } from './testing/app-harness';
import { InMemorySessionRepository } from './session/in-memory-session-repository';
import type { Identity } from './session/identity';

/** A device that has never reached Firebase: the sign-in that mints a uid cannot happen. */
const offline: Identity = {
  signIn: () => Promise.reject(new Error('offline')),
};

describe('opening the app on a device that has never had a connection', () => {
  it('says a connection is needed the first time', async () => {
    const app = await AppHarness.launch({ identity: offline });

    expect(app.shows(copy.connection.heading)).toBe(true);
    expect(app.shows(copy.connection.hint)).toBe(true);
  });

  /*
   * The landing page is the wrong answer, not merely a different one: New session is the whole of
   * what it offers, and an evening created without an owner has nowhere to be written.
   */
  it('does not offer to start an evening it could not store', async () => {
    const app = await AppHarness.launch({ identity: offline });

    expect(app.isOnScreen(copy.landing.newSession)).toBe(false);
  });

  /*
   * The other wrong answer. `ready` is what the app renders anything at all behind, and a restore
   * that gave up without settling it would leave the organizer looking at nothing for as long as
   * they cared to wait.
   */
  it('settles rather than hanging on a launch it cannot finish', async () => {
    const app = await AppHarness.launch({ identity: offline });

    expect(app.text()).not.toBe('');
  });

  /*
   * Reopening the app is the retry, which is why there is no button (ADR-0025 §4). Once a uid
   * exists the device is past this screen forever, and the evening it stored is on the front door
   * where it was left.
   */
  it('reaches the front door once the device can sign in', async () => {
    const repository = new InMemorySessionRepository();
    const stranded = await AppHarness.launch({ repository, identity: offline });
    expect(stranded.shows(copy.connection.heading)).toBe(true);

    const connected = await AppHarness.launch({ repository });

    expect(connected.shows(copy.connection.heading)).toBe(false);
    expect(connected.isOnScreen(copy.landing.newSession)).toBe(true);
  });
});
