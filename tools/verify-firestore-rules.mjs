/**
 * Proves `firestore.rules` says what ADR-0024 says it says.
 *
 * The rules *are* the authorization layer (decision #12) — there is no server holding a second
 * opinion — so this is not a nice-to-have test of a defence in depth. It is the only test of the
 * only defence. The first case it must cover, and the case the ADR exists because of, is a
 * signed-in organizer listing `sessions` and getting back only their own: `allow read: if true`
 * would have made every session in the project enumerable, share codes included, and it would
 * have looked completely correct in a diff.
 *
 * It runs against the Firestore emulator and is deliberately **not** part of `npm run verify`
 * (ADR-0024 §6): the emulator needs a Java runtime, and `verify` keeps its promise of running
 * anywhere Node runs. `npm run test:rules` starts the emulator around this script.
 *
 * Like the other two checkers in this directory, it also proves the rules bite: every case below
 * is a pair — the thing that must be allowed, and the neighbouring thing that must not.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ORGANIZER = 'organizer-uid';
const STRANGER = 'stranger-uid';

const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const [host, port] = emulator.split(':');

const environment = await initializeTestEnvironment({
  projectId: 'padel-tournament-hub-rules',
  firestore: {
    host,
    port: Number(port),
    rules: fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8'),
  },
});

const failures = [];

/** One case: a name, and the thing the rules are being asked to do. */
async function allowed(label, act) {
  try {
    await assertSucceeds(act());
    console.log(`  ok      ${label}`);
  } catch (error) {
    failures.push(`${label} — refused, and it should not be. ${error}`);
  }
}

async function refused(label, act) {
  try {
    await assertFails(act());
    console.log(`  ok      ${label}`);
  } catch (error) {
    failures.push(`${label} — allowed, and it must not be. ${error}`);
  }
}

/** A session document as the app writes one: the two fields the rules read, and nothing else. */
function session(ownerUid, status = 'in-progress') {
  return { ownerUid, status, courtNames: [], createdAt: '2026-09-07T18:00:00.000Z' };
}

/** Put documents in place with the rules off, so a test starts from a state rather than a write. */
async function given(documents) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [code, data] of Object.entries(documents)) {
      await setDoc(doc(db, 'sessions', code), data);
    }
  });
}

const asOrganizer = () => environment.authenticatedContext(ORGANIZER).firestore();
const asStranger = () => environment.authenticatedContext(STRANGER).firestore();
const asNobody = () => environment.unauthenticatedContext().firestore();

await environment.clearFirestore();
await given({
  MINE0AB1CD: session(ORGANIZER),
  MINE2EF3GH: session(ORGANIZER, 'finished'),
  THEIRS45JK: session(STRANGER),
});

console.log('\nHolding the code is the credential (ADR-0024 §4):');

await allowed('a stranger with the code reads the session', () =>
  getDoc(doc(asStranger(), 'sessions', 'MINE0AB1CD')),
);
await allowed('a spectator who has never signed in reads it too', () =>
  getDoc(doc(asNobody(), 'sessions', 'MINE0AB1CD')),
);

console.log('\nOnly the organizer enumerates, and only their own (ADR-0024 §3):');

/*
 * The case the ADR was written for. The query below is the one the app actually makes — owner and
 * status, limit one (ADR-0025 §2) — and the two after it are the ways `allow read: if true` would
 * have leaked every share code in the project.
 */
await allowed('the organizer queries their own sessions in progress', async () => {
  const found = await getDocs(
    query(
      collection(asOrganizer(), 'sessions'),
      where('ownerUid', '==', ORGANIZER),
      where('status', '==', 'in-progress'),
      limit(1),
    ),
  );
  if (found.docs.length !== 1 || found.docs[0].id !== 'MINE0AB1CD') {
    throw new Error(`the active query returned ${found.docs.map((held) => held.id).join(', ')}`);
  }
});
await allowed('the organizer queries their own ended sessions', () =>
  getDocs(
    query(
      collection(asOrganizer(), 'sessions'),
      where('ownerUid', '==', ORGANIZER),
      where('status', '==', 'finished'),
    ),
  ),
);
await refused('the organizer lists the collection unscoped', () =>
  getDocs(collection(asOrganizer(), 'sessions')),
);
await refused("the organizer lists somebody else's sessions", () =>
  getDocs(query(collection(asOrganizer(), 'sessions'), where('ownerUid', '==', STRANGER))),
);
await refused('a signed-out spectator lists the collection', () =>
  getDocs(collection(asNobody(), 'sessions')),
);

console.log('\nOwnership is claimed once and never moves (ADR-0024 §2):');

await allowed('the organizer creates a session carrying their own uid', () =>
  setDoc(doc(asOrganizer(), 'sessions', 'NEW6MNPQRS'), session(ORGANIZER)),
);
await refused("the organizer creates one carrying somebody else's uid", () =>
  setDoc(doc(asOrganizer(), 'sessions', 'FAKE7TVWXY'), session(STRANGER)),
);
await refused('a signed-out visitor creates a session at all', () =>
  setDoc(doc(asNobody(), 'sessions', 'ANON8Z0123'), session(ORGANIZER)),
);

await allowed('the organizer writes a score to their own evening', () =>
  updateDoc(doc(asOrganizer(), 'sessions', 'MINE0AB1CD'), { courtNames: ['Centre'] }),
);
await refused("a stranger holding the code writes to somebody else's evening", () =>
  updateDoc(doc(asStranger(), 'sessions', 'MINE0AB1CD'), { courtNames: ['Centre'] }),
);
await refused('the organizer hands their session to another uid', () =>
  updateDoc(doc(asOrganizer(), 'sessions', 'MINE0AB1CD'), { ownerUid: STRANGER }),
);
await refused('the organizer drops the ownership field', () =>
  setDoc(doc(asOrganizer(), 'sessions', 'MINE0AB1CD'), { status: 'in-progress' }),
);

console.log('\nThe hard delete decision #10 promises:');

await refused('a stranger deletes an evening they only hold the code for', () =>
  deleteDoc(doc(asStranger(), 'sessions', 'MINE0AB1CD')),
);
await allowed('the organizer deletes their own', () =>
  deleteDoc(doc(asOrganizer(), 'sessions', 'MINE0AB1CD')),
);

/*
 * ADR-0024 §5, stated as a test so that nobody adds the rule later thinking it was an oversight.
 * The engine refuses to operate past `finished` (ADR-0009); the rules have no opinion about it.
 */
console.log('\nFinishing is the engine’s business, not the rules’ (ADR-0024 §5):');

await allowed('the organizer writes to an evening they have already ended', () =>
  updateDoc(doc(asOrganizer(), 'sessions', 'MINE2EF3GH'), { courtNames: ['Centre'] }),
);

await environment.cleanup();

if (failures.length > 0) {
  console.error('\nfirestore.rules check FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  '\nfirestore.rules holds: reads are public, listing is owner-only, and ownership cannot move.',
);
