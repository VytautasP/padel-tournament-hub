/*
 * What the running app is wired to, as opposed to what a test wires it to.
 *
 * Every choice here is a vendor boundary the tests replace: the repository, where tests provide
 * the in-memory implementation against the same token (decision #19); the layout, where tests
 * state a tier instead of measuring a window (ADR-0022); the clipboard, which is a permission a
 * browser can refuse; the QR encoder, which is a lazily-fetched library and therefore the one
 * thing on the share sheet that can fail to arrive (ADR-0026 §4); the build reload, which is
 * how a tab that missed a deploy gets onto the current build instead of being told it is offline
 * (ADR-0030); the preference store, which is `localStorage` and is the one thing here a browser
 * can refuse outright; the reload, which is how the app starts itself again in a language the
 * organizer has just chosen (ADR-0032 §3); and the system theme, which is `prefers-color-scheme`
 * and is the OS the app is running on (ADR-0031). Nothing else in the app knows which
 * implementation it got.
 *
 * The repository is one object behind two tokens. `FirestoreSessionRepository` answers for both
 * `SESSION_REPOSITORY` and `IDENTITY` because it holds one Firebase app, one Firestore and one
 * `Auth` — and because decision #19 says one file imports the SDK, which two classes could not
 * honour. `useExisting` rather than two `useClass` entries, which would build it twice and sign
 * in twice.
 */
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { BrowserBuildReload, BUILD_RELOAD } from './share/build-reload';
import { BrowserClipboard, CLIPBOARD } from './share/clipboard';
import { BreakpointLayout } from './layout/breakpoint-layout';
import { BrowserPreferenceStorage, PREFERENCE_STORAGE } from './preference/preference-storage';
import { BrowserReload, RELOAD } from './preference/reload';
import { MediaSystemTheme, SYSTEM_THEME } from './preference/system-theme';
import { LAYOUT } from './layout/layout';
import { FirestoreSessionRepository } from './session/firestore-session-repository';
import { IDENTITY } from './session/identity';
import { qrEncoder, QR_ENCODER } from './share/qr-matrix';
import { SESSION_REPOSITORY } from './session/session-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    /*
     * The router ADR-0026 brought, and the one option it is configured with. Component input
     * binding is what hands `/s/:code` to the spectator page as an input, so the page is a
     * component with a share code rather than a component that knows it is being routed to.
     */
    provideRouter(routes, withComponentInputBinding()),
    FirestoreSessionRepository,
    { provide: SESSION_REPOSITORY, useExisting: FirestoreSessionRepository },
    { provide: IDENTITY, useExisting: FirestoreSessionRepository },
    { provide: LAYOUT, useClass: BreakpointLayout },
    { provide: CLIPBOARD, useClass: BrowserClipboard },
    { provide: QR_ENCODER, useValue: qrEncoder },
    { provide: BUILD_RELOAD, useClass: BrowserBuildReload },
    { provide: PREFERENCE_STORAGE, useClass: BrowserPreferenceStorage },
    { provide: RELOAD, useClass: BrowserReload },
    { provide: SYSTEM_THEME, useClass: MediaSystemTheme },
  ],
};
