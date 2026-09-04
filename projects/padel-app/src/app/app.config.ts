/*
 * What the running app is wired to, as opposed to what a test wires it to.
 *
 * Two choices are made here, and both of them are vendor boundaries the tests replace: the
 * repository, where tests provide the in-memory implementation against the same token
 * (decision #19), and the layout, where tests state a tier instead of measuring a window
 * (ADR-0022). Nothing else in the app knows which implementation it got.
 */
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BreakpointLayout } from './layout/breakpoint-layout';
import { LAYOUT } from './layout/layout';
import { LocalStorageSessionRepository } from './session/local-storage-session-repository';
import { SESSION_REPOSITORY } from './session/session-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: SESSION_REPOSITORY, useClass: LocalStorageSessionRepository },
    { provide: LAYOUT, useClass: BreakpointLayout },
  ],
};
