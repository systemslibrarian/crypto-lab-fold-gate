import { startObservationRun } from './observed'

/**
 * Runs once, in the main process, before any worker exists. Clearing the sink here is what stops a
 * stale file from a previous run — or from a run of a different branch — from satisfying the
 * replay in e2e/coverage-replay.spec.ts.
 */
export default function globalSetup(): void {
  startObservationRun()
}
