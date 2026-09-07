/*
 * What a fresh install with no network shows (ADR-0025 §4).
 *
 * Anonymous sign-in mints the uid on Firebase's servers, so until that has happened once there is
 * no uid, no owner and therefore no session to read. That is a state rather than an error, and it
 * has to be designed: the alternatives are a spinner that never resolves and an empty landing page
 * offering to start an evening the app cannot store, and both of them lie.
 *
 * It happens once per device. Every later launch restores the uid locally and reaches the landing
 * page in a basement, which is why this component has no retry: reopening the app *is* the retry,
 * and a button that quietly fails in place would teach an organizer that the app is broken rather
 * than that the signal is.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { copy } from '../copy/copy';

@Component({
  selector: 'app-connection-needed',
  templateUrl: './connection-needed.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionNeeded {
  protected readonly copy = copy;
}
