/*
 * What the running app is wired to, as opposed to what a test wires it to.
 *
 * Two choices are made here, and both of them are vendor boundaries the tests replace: the
 * repository, where tests provide the in-memory implementation against the same token
 * (decision #19), and the layout, where tests state a tier instead of measuring a window
 * (ADR-0022). Nothing else in the app knows which implementation it got.
 *
 * The repository is one object behind two tokens. `FirestoreSessionRepository` answers for both
 * `SESSION_REPOSITORY` and `IDENTITY` because it holds one Firebase app, one Firestore and one
 * `Auth` — and because decision #19 says one file imports the SDK, which two classes could not
 * honour. `useExisting` rather than two `useClass` entries, which would build it twice and sign
 * in twice.
 */
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BreakpointLayout } from './layout/breakpoint-layout';
import { LAYOUT } from './layout/layout';
import { FirestoreSessionRepository } from './session/firestore-session-repository';
import { IDENTITY } from './session/identity';
import { SESSION_REPOSITORY } from './session/session-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    FirestoreSessionRepository,
    { provide: SESSION_REPOSITORY, useExisting: FirestoreSessionRepository },
    { provide: IDENTITY, useExisting: FirestoreSessionRepository },
    { provide: LAYOUT, useClass: BreakpointLayout },
  ],
};
