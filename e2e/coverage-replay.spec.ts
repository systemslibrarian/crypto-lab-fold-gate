import { expect, test } from '@playwright/test'
import { observationKey, readObservations } from './observed'
import { CLAIM_MUTATIONS, VERDICT_MUTATIONS } from './verdict-mutations'

/**
 * The rule the verdict gate's guarantee rests on: every recorded mutation's killing assertion ran.
 *
 * This file is its own Playwright project, declared in playwright.config.ts with
 * `dependencies: ['lab']`, so the whole suite has finished before a line of it executes. The
 * ordering is stated, not inherited from file order or worker scheduling — a check that has to
 * come last cannot be allowed to come last by luck.
 *
 * It replaces a source-text scan. `SPEC_SOURCE.includes("expectVerdict(page, 'chain'")` is true of
 * a call inside a comment, of a call in a branch that never runs, and of a call that belongs to a
 * different test in the same file. All three were demonstrated against this lab, and under the
 * first of them a live flip of the chain verdict's `data-result` shipped green: the page reading
 * `FOLDED 8 → 1, VALID` while its machine-readable result said `fail`, with the mutation record
 * asserting that exact case was covered.
 */

const FAMILIES = [
  { family: 'verdict', records: VERDICT_MUTATIONS, helper: 'expectVerdict' },
  { family: 'claim', records: CLAIM_MUTATIONS, helper: 'expectClaim' },
] as const

test('every recorded mutation was validated by an assertion that actually ran', () => {
  const log = readObservations()

  expect(log.started, 'no assertion recorded itself this run. Either globalSetup never ran, or e2e/markers.ts stopped calling recordObservation() — in which case the rules below would pass over an empty set and report a gate that checks nothing.').toBe(true)
  expect(log.foreign, 'the observation sink holds lines from another run. It is cleared in globalSetup precisely so a stale file cannot stand in for assertions this run never made.').toBe(0)
  expect(log.current.length, 'the observation sink is empty').toBeGreaterThan(0)

  const observed = new Set(log.current.map((entry) => observationKey(entry.family, entry.test, entry.id)))
  const unrun: string[] = []
  for (const { family, records, helper } of FAMILIES) {
    for (const [id, record] of Object.entries(records)) {
      if (observed.has(observationKey(family, record.killedBy, id))) continue
      unrun.push(`${id}: no ${helper}(page, '${id}', …) executed inside "${record.killedBy}"`)
    }
  }

  expect(unrun.sort(), `recorded mutations whose killing assertion never ran. The record in e2e/verdict-mutations.ts claims each of these markers was validated; this run says the assertion that would have validated it was never reached. A mention of the helper in the spec's source — commented out, unreachable, or belonging to another test — is not an assertion.`).toEqual([])
})

test('every marker the records name was asserted somewhere this run', () => {
  const log = readObservations()
  const asserted = new Set(log.current.map((entry) => JSON.stringify([entry.family, entry.id])))
  const silent: string[] = []
  for (const { family, records } of FAMILIES) {
    for (const id of Object.keys(records)) if (!asserted.has(JSON.stringify([family, id]))) silent.push(id)
  }
  expect(silent.sort(), 'markers with a recorded mutation that no assertion touched anywhere in the run').toEqual([])
})
