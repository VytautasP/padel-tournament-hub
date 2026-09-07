/*
 * Which Firebase project the app talks to (decision #12).
 *
 * These values are public by design and are committed on purpose. A Firebase web config is not a
 * credential — it names a project, it does not authorize anything against it. The authorization
 * layer is `firestore.rules` and there is no second opinion behind it (decision #12), which is
 * why ADR-0024 is a document about rules rather than about secrets, and why the rules have a test
 * of their own (`npm run test:rules`).
 *
 * There is one project rather than a project per environment: decision #22 is a manual deploy of
 * one app, and preview channels (`firebase hosting:channel:deploy`) share this database on
 * purpose so that on-device testing is testing the real thing.
 *
 * No Firebase type is named here, so this file is not the one decision #19 is about — it is data
 * that `firestore-session-repository.ts` hands to the SDK.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyActlyRTMZnIWPxH1VcYDfyVt6F-A3Jd4I',
  authDomain: 'padel-tournament-hub.firebaseapp.com',
  projectId: 'padel-tournament-hub',
  storageBucket: 'padel-tournament-hub.firebasestorage.app',
  messagingSenderId: '510001990869',
  appId: '1:510001990869:web:50ac9508498987bef7e65c',
};

/** The one collection this app has. A session lives at `sessions/{shareCode}` (ADR-0024 §1). */
export const SESSIONS = 'sessions';
