import { expect, type Page } from '@playwright/test'

/**
 * The shared marker vocabulary for this lab's verdict gate.
 *
 * Two families of marker are held to one rule. `data-verdict="<id>"` is a rendered decision;
 * `data-claim="<id>"` is a rendered measurement. Both must have a recorded, actually-run mutation
 * in verdict-mutations.ts, and both are asserted through the helpers below so that the coverage
 * test can require a record's `killedBy` test to go through them rather than merely mention an id.
 *
 * `expectVerdict` exists because a marker's words, its `data-result` and its pass/fail styling are
 * ONE claim. Asserting the text alone accepts a mutation that flips the sentence while the marker
 * keeps saying pass in every way a reader can see.
 */

/** The ristretto255 scalar-field order, written here rather than imported, so the oracles below
 * are not the code they are judging. */
export const ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed')

export const mod = (value: bigint): bigint => ((value % ORDER) + ORDER) % ORDER
export const vadd = (left: bigint[], right: bigint[]): bigint[] => left.map((value, index) => mod(value + right[index]))
export const vscale = (values: bigint[], scalar: bigint): bigint[] => values.map((value) => mod(value * scalar))
export const hadamard = (left: bigint[], right: bigint[]): bigint[] => left.map((value, index) => mod(value * right[index]))
export const matmul = (matrix: bigint[][], vector: bigint[]): bigint[] => matrix.map((row) => mod(row.reduce((sum, value, index) => sum + value * vector[index], 0n)))

/** Fermat inverse, so a rendered challenge can be recovered from two other rendered vectors. */
export function inverse(value: bigint): bigint {
  let base = mod(value)
  let exponent = ORDER - 2n
  let result = 1n
  while (exponent > 0n) {
    if (exponent & 1n) result = mod(result * base)
    base = mod(base * base)
    exponent >>= 1n
  }
  return result
}

/** The R1CS this lab teaches, written as a literal: row one is x·x = x², row two is x·x² = y − 3u. */
export const MATRIX_A = [[0n, 1n, 0n, 0n], [0n, 1n, 0n, 0n]]
export const MATRIX_B = [[0n, 1n, 0n, 0n], [0n, 0n, 0n, 1n]]
export const MATRIX_C = [[0n, 0n, 0n, 1n], [-3n, 0n, 1n, 0n]]

export const matrixValue = (matrix: bigint[][]): string => JSON.stringify(matrix.map((row) => row.map(String)))

/** y = x³ + 3, with x² as the single private witness coordinate. */
export function stepOf(x: bigint): { u: bigint; x: bigint[]; W: bigint[]; E: bigint[] } {
  const square = mod(x * x)
  return { u: 1n, x: [mod(x), mod(square * x + 3n)], W: [square], E: [0n, 0n] }
}

export const witness = (instance: { u: bigint; x: bigint[]; W: bigint[] }): bigint[] => [instance.u, ...instance.x, ...instance.W]

export function residualOf(instance: { u: bigint; x: bigint[]; W: bigint[]; E: bigint[] }): bigint[] {
  const z = witness(instance)
  return vadd(hadamard(matmul(MATRIX_A, z), matmul(MATRIX_B, z)), vscale(matmul(MATRIX_C, z), -instance.u))
    .map((value, index) => mod(value - instance.E[index]))
}

export function crossTermOf(left: { u: bigint; x: bigint[]; W: bigint[] }, right: { u: bigint; x: bigint[]; W: bigint[] }): bigint[] {
  const leftZ = witness(left)
  const rightZ = witness(right)
  return vadd(
    vadd(hadamard(matmul(MATRIX_A, leftZ), matmul(MATRIX_B, rightZ)), hadamard(matmul(MATRIX_A, rightZ), matmul(MATRIX_B, leftZ))),
    vadd(vscale(matmul(MATRIX_C, rightZ), -left.u), vscale(matmul(MATRIX_C, leftZ), -right.u)),
  )
}

/** The exact string shape the page writes into data-value for a vector. */
export const full = (values: bigint[]): string => `[${values.map(String).join(', ')}]`
export const parseVector = (value: string): bigint[] => value.replace(/[\[\]]/g, '').split(',').filter(Boolean).map((entry) => BigInt(entry.trim()))

export const STEP_COUNTS = [2, 4, 8, 16, 32, 64] as const

/**
 * Selects a step count and folds that chain, returning only once the run has painted.
 *
 * The settle gate is the button's own label, never a marker, so waiting for the result cannot be
 * confused with asserting it. The label is also why the button is located by id: app.ts rewrites it
 * to `Fold <n> steps` on a select change and `Fold <n> steps again` after a run, so the 8-step name
 * the suite used to locate it by stops matching the moment the select moves.
 */
export async function foldChain(page: Page, count: number): Promise<void> {
  await page.selectOption('#step-count', String(count))
  await page.locator('#run-chain').click()
  await expect(page.locator('#run-chain'), `the ${count}-step chain did not finish folding`).toHaveText(`Fold ${count} steps again`)
}

export interface VerdictExpectation {
  /** Every fragment must appear in the marker's text. */
  text: string | string[]
  /** The marker's own data-result. */
  result: 'pass' | 'fail' | 'caution'
  /** The tone behind its verdict-<tone> class. */
  tone: 'good' | 'bad' | 'alarm' | 'warning'
}

/**
 * Asserts a verdict's text, its data-result and its pass/fail class in one call.
 *
 * Soft, so that every marker a test owns is actually evaluated. Under a hard assertion the first
 * failure aborts the test and a later marker's own assertion is never reached — which would make
 * a mutation unreadable as a kill for that marker through no fault of the mutation.
 *
 * The marker is waited for once, then its text, result and class are read in one pass and compared
 * without retrying. A retrying soft assertion spends its whole timeout on every failure, and five
 * of those in one test walk it into the test timeout — which is neither a kill nor a survivor.
 */
export async function expectVerdict(page: Page, id: string, expected: VerdictExpectation): Promise<void> {
  const marker = page.locator(`[data-verdict="${id}"]`)
  await expect(marker, `[data-verdict="${id}"] does not render`).toBeVisible()
  const seen = await marker.evaluate((element) => ({
    text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
    result: element.getAttribute('data-result'),
    className: element.className,
  }))
  for (const fragment of Array.isArray(expected.text) ? expected.text : [expected.text]) {
    expect.soft(seen.text, `${id} does not say what it is expected to say`).toContain(fragment)
  }
  expect.soft(seen.result, `${id} says "${seen.text}" but its data-result disagrees`).toBe(expected.result)
  expect.soft(seen.className, `${id} says "${seen.text}" but its styling disagrees`).toMatch(new RegExp(`(?:^| )verdict-${expected.tone}(?: |$)`))
}

export async function claimValue(page: Page, id: string): Promise<string> {
  const value = await page.locator(`[data-claim="${id}"]`).first().getAttribute('data-value')
  if (value === null) throw new Error(`[data-claim="${id}"] renders no data-value`)
  return value
}

export interface ClaimExpectation {
  /** The marker's data-value, compared exactly. */
  value?: string
  /** A fragment that must appear in the marker's rendered text. */
  text?: string
  /** Why that is the right answer, printed when it is not. */
  note: string
}

/** Asserts one rendered measurement against an oracle this suite computed for itself. */
export async function expectClaim(page: Page, id: string, expected: ClaimExpectation): Promise<void> {
  const marker = page.locator(`[data-claim="${id}"]`).first()
  await expect(marker, `[data-claim="${id}"] does not render`).toBeAttached()
  if (expected.value !== undefined) {
    expect.soft(await marker.getAttribute('data-value'), `${id}: ${expected.note}`).toBe(expected.value)
  }
  if (expected.text !== undefined) {
    const text = await marker.evaluate((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
    expect.soft(text, `${id}: ${expected.note}`).toContain(expected.text)
  }
}

/**
 * Walks every option of every control that changes what renders — each control on its own, never
 * the cross-product — calling back after each state so markers can be collected.
 *
 * This is the DENOMINATOR the marker-coverage test and the outside-marker test both enumerate
 * over, so a marker or a bare number that renders only at 2 steps or only at 64 is outside the
 * set those rules judge unless it is walked here.
 *
 * Controls in this lab: #advance-phase (three options), #reset-phase (one), #step-count (six),
 * #run-chain (one, per step count), #open-final (one, per run) and the three [data-attack]
 * buttons. The three <details> disclosures in section 05 are NOT walked: their content is in the
 * DOM whether or not they are open, so toggling one changes nothing that renders.
 */
export async function driveEveryState(page: Page, after: () => Promise<void>): Promise<void> {
  await after()

  for (const label of ['Show plain fold', 'Compute cross term T', 'Derive r and relax']) {
    await page.getByRole('button', { name: label }).click()
    await after()
  }
  await page.getByRole('button', { name: 'Reset walkthrough' }).click()
  await expect(page.locator('#advance-phase')).toHaveText('Show plain fold')
  await after()

  for (const count of STEP_COUNTS) {
    await foldChain(page, count)
    await after()
    await page.locator('#open-final').click()
    await expect(page.locator('#opening-result')).toBeVisible()
    await after()
  }

  for (const label of ['Tamper W′', 'Tamper Com(T)', 'Reveal r before T']) {
    await page.getByRole('button', { name: label }).click()
    await expect(page.locator('#attack-result [data-verdict]')).toBeVisible()
    await after()
  }
}
