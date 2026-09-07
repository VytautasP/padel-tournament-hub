/*
 * A startup that cannot reach the organizer's sessions (ADR-0025 §4).
 *
 * Two ways in — no uid, or no readable store — and one screen out. The first is the one the ADR
 * names, and the rest of this comment is about it; the second is the bug these tests were extended
 * for, found by opening the deployed app while a composite index was still building.
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
  /*
   * A device with no uid has nothing to attach an account to, and never reaches the front door
   * where it would be offered one. Both of these are here because the interface has them and
   * neither is reachable from the screen these tests are about (ADR-0028).
   */
  durability: () => ({ kind: 'browser' }),
  linkGoogle: () => Promise.resolve({ kind: 'unavailable' }),
};

/**
 * A store the app *can* sign in to and cannot read from: an outage, an exhausted quota, or a
 * composite index that is still building.
 *
 * ADR-0025 accepts that this stops an evening — "A Firestore outage, or an exhausted quota, stops
 * an evening… That is the price of one source of truth" — and says nothing about it being allowed
 * to stop the app *silently*, which is what these two cases are for.
 */
class UnreadableRepository extends InMemorySessionRepository {
  override async loadActive(): Promise<never> {
    throw new Error('the query requires an index');
  }
}

describe('opening the app when it cannot reach the organizer’s sessions', () => {
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
   * The same screen, reached the other way. This is the bug that shipped to Hosting and was found
   * by opening the deployed app while a composite index was still building: `restore` caught the
   * sign-in and not the reads, so a failed read threw its way out, `ready()` never became true,
   * and the app rendered nothing at all — for as long as the organizer cared to wait.
   */
  it('says so when it can sign in but cannot read, rather than rendering nothing', async () => {
    const app = await AppHarness.launch({ repository: new UnreadableRepository() });

    expect(app.shows(copy.connection.heading)).toBe(true);
  });

  it('never renders a blank page, whichever half of the startup failed', async () => {
    for (const app of [
      await AppHarness.launch({ identity: offline }),
      await AppHarness.launch({ repository: new UnreadableRepository() }),
    ]) {
      expect(app.text()).not.toBe('');
    }
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
