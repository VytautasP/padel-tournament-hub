/*
 * What the running app is wired to, as opposed to what a test wires it to.
 *
 * The repository is the only choice made here, and it is the only one that differs between the
 * two: tests provide the in-memory implementation against the same token (decision #19). Nothing
 * else in the app knows which one it got.
 */
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { LocalStorageSessionRepository } from './session/local-storage-session-repository';
import { SESSION_REPOSITORY } from './session/session-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: SESSION_REPOSITORY, useClass: LocalStorageSessionRepository },
  ],
};
