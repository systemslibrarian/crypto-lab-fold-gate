import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The run-scoped record of which verdict and claim assertions ACTUALLY EXECUTED.
 *
 * The rule this file exists for: a recorded mutation is evidence only if the assertion that kills
 * it ran. Reading the spec's source text cannot establish that. `expectVerdict(page, 'chain'` is
 * still there when it sits inside a comment, when it sits in a branch that never runs, and when it
 * belongs to some other test in the same file — and in all three cases the marker is unasserted
 * while the coverage rule reports it covered. Each of those was demonstrated against this lab.
 *
 * So the helpers in markers.ts append the `(test title, marker)` pair they are executing, and
 * e2e/coverage-replay.spec.ts — a project that `dependencies:` on the main one, so it cannot run
 * first — requires every recorded mutation's pair to appear here. The denominator is what ran.
 *
 * Playwright runs tests in separate worker PROCESSES, so a module-level Set would be per worker
 * and aggregate nothing. The sink is therefore a file, appended to with O_APPEND (one short line
 * per call, well under the atomic-write size), and read back once the whole run is over.
 *
 * It lives outside `test-results/` on purpose: Playwright cleans its own output directory during a
 * run, and a sink the runner may delete underneath the workers would fail open.
 */

const RUN_DIR = fileURLToPath(new URL('../.verdict-run/', import.meta.url))
export const OBSERVATIONS_FILE = `${RUN_DIR}observations.jsonl`
export const RUN_TOKEN_FILE = `${RUN_DIR}token.txt`

export type MarkerFamily = 'verdict' | 'claim'

export interface Observation {
  token: string
  test: string
  family: MarkerFamily
  id: string
}

/**
 * Clears the sink and stamps a fresh token for this run. Called from globalSetup, before any
 * worker starts, so a leftover file from an earlier run cannot satisfy the replay — and so a run
 * whose helpers were never reached is distinguishable from a run that never started.
 */
export function startObservationRun(): string {
  mkdirSync(RUN_DIR, { recursive: true })
  rmSync(OBSERVATIONS_FILE, { force: true })
  const token = `${Date.now().toString(36)}-${randomUUID()}`
  writeFileSync(RUN_TOKEN_FILE, token)
  return token
}

let cachedToken: string | null = null

function runToken(): string {
  if (cachedToken === null) {
    if (!existsSync(RUN_TOKEN_FILE)) {
      throw new Error(`${RUN_TOKEN_FILE} does not exist: the verdict observation run was never started, so nothing can be recorded. playwright.config.ts must keep globalSetup pointed at e2e/observation-reset.ts.`)
    }
    cachedToken = readFileSync(RUN_TOKEN_FILE, 'utf8').trim()
  }
  return cachedToken
}

/** Appends one executed assertion. Called from the helpers themselves, never from a test. */
export function recordObservation(testTitle: string, family: MarkerFamily, id: string): void {
  appendFileSync(OBSERVATIONS_FILE, `${JSON.stringify({ token: runToken(), test: testTitle, family, id } satisfies Observation)}\n`)
}

export interface ObservationLog {
  /** Every line stamped with this run's token. */
  current: Observation[]
  /** Lines from some other run, which must be none, because the sink is cleared before workers start. */
  foreign: number
  /** Whether the sink file exists at all. */
  started: boolean
}

export function readObservations(): ObservationLog {
  if (!existsSync(OBSERVATIONS_FILE)) return { current: [], foreign: 0, started: false }
  const token = runToken()
  const current: Observation[] = []
  let foreign = 0
  for (const line of readFileSync(OBSERVATIONS_FILE, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    const entry = JSON.parse(line) as Observation
    if (entry.token === token) current.push(entry)
    else foreign += 1
  }
  return { current, foreign, started: true }
}

/** The key a recorded mutation is looked up by: one marker, asserted inside one named test. */
export const observationKey = (family: MarkerFamily, test: string, id: string): string => JSON.stringify([family, test, id])
