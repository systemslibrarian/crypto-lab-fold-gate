import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { proveFold, publicInstance, type PublicInstance } from '../src/nifs/prove'
import { foldPublic } from '../src/nifs/verify'
import { step } from '../src/r1cs/relaxed'
import { openLab } from './gate'
import { driveEveryState, expectClaim, expectVerdict, foldChain, stepOf } from './markers'
import { CLAIM_MUTATIONS, VERDICT_MUTATIONS } from './verdict-mutations'

/**
 * Coverage is derived from the rendered page, never from a list anyone wrote by hand. These tests
 * walk the DOM through every state the lab can reach — every option of every control that changes
 * what renders — collect the `data-verdict` and `data-claim` markers that actually render, and
 * hold both sets against the recorded mutations in `verdict-mutations.ts`. A marker with no
 * mutation fails; a mutation for a marker that no longer renders fails; a record whose `killedBy`
 * test does not go through expectVerdict()/expectClaim() fails; and any verdict word, verdict
 * styling, or unmarked number painted in a result region fails.
 */

const SPEC_FILES = ['./verdicts.spec.ts', './claims.spec.ts']
const SPEC_SOURCE = SPEC_FILES.map((name) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8')).join('\n')

const VERDICT_WORDS = '\\b(VALID|INVALID|ACCEPTED|REJECTED|REFUSED|FAILED|PASSED|SATISFIED|UNSATISFIED|FORGED|SECURE|INSECURE|VERIFIED|TAMPERED|SUCCESS|FAILURE|SAFE|UNSAFE|MISMATCH)\\b'

/**
 * Regions where the page reports an outcome. A rendered number here is a claim exactly as much as
 * a rendered verdict word is, and is the easier thing to leave unmarked, because a number does not
 * look like a claim.
 */
const RESULT_REGIONS = ['.residual-panel', '.verifier-result', '.work-meters', '#chain-result', '#attack-result', '#chain-retirement']

/** Splits the spec files into `test('<title>', …)` bodies, so a record's killedBy test can be read. */
function testBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>()
  const heads = /\btest\('((?:[^'\\]|\\.)*)'/g
  let match: RegExpExecArray | null
  let title: string | null = null
  let start = 0
  while ((match = heads.exec(source)) !== null) {
    if (title !== null) bodies.set(title, source.slice(start, match.index))
    title = match[1]
    start = match.index
  }
  if (title !== null) bodies.set(title, source.slice(start))
  return bodies
}

const BODIES = testBodies(SPEC_SOURCE)

/** Asserts one family of markers is completely and honestly covered by recorded mutations. */
function assertCoverage(rendered: Set<string>, records: Record<string, { killedBy: string }>, helper: string, family: string): void {
  expect([...rendered].sort(), `${family} markers on the page without a recorded mutation, or mutations for ${family} markers that no longer render`).toEqual(Object.keys(records).sort())

  for (const [id, record] of Object.entries(records)) {
    for (const [field, value] of Object.entries(record)) {
      expect(String(value).trim(), `${id}.${field} is empty: a mutation is only recorded once it has actually been run`).not.toBe('')
    }
    const body = BODIES.get(record.killedBy)
    expect(body, `${id}.killedBy names "${record.killedBy}", which is not a test in ${SPEC_FILES.join(' or ')}`).toBeDefined()
    expect(body?.includes(`${helper}(page, '${id}'`), `${id}'s kill is validated somewhere other than ${helper}(page, '${id}', …) inside "${record.killedBy}". A marker's text and its state are one claim, so a mutation that flips only the words must not count as a kill.`).toBe(true)
  }
}

interface Countable {
  add(other: Countable): Countable
  multiply(scalar: bigint): Countable
}

/** Counts the ristretto255 group operations one real foldPublic performs, without src/nifs/cost.ts. */
function countRealFoldPublicOps(): number {
  let ops = 0
  const inner = new WeakMap<object, Countable>()
  const unwrap = (value: Countable): Countable => inner.get(value as object) ?? value
  const wrap = (point: Countable): Countable => {
    const counting: Countable = {
      add: (other: Countable) => { ops += 1; return wrap(point.add(unwrap(other))) },
      multiply: (scalar: bigint) => { ops += 1; return wrap(point.multiply(scalar)) },
    }
    inner.set(counting, point)
    return counting
  }
  const instrument = (instance: PublicInstance): PublicInstance => ({
    ...instance,
    commitmentE: wrap(instance.commitmentE as unknown as Countable) as never,
    commitmentW: wrap(instance.commitmentW as unknown as Countable) as never,
  })
  const left = step(2n)
  const right = step(5n)
  const proof = proveFold(left, right).proof
  foldPublic(instrument(publicInstance(left)), instrument(publicInstance(right)), wrap(proof.commitmentT as unknown as Countable) as never, proof.challenge)
  return ops
}

/**
 * The oracle for a chain of `stepCount` steps: one measured count PER FOLD, summed, with the fold
 * count derived from the chain length under test. It has to be built this way round. Multiplying
 * one measurement by a literal 7 cannot tell "summed seven measurements" apart from "multiplied
 * one measurement out", which is exactly the distinction the sentence beside it claims.
 */
function measuredChainCost(stepCount: number): { perFold: number[]; distinct: number[]; total: number } {
  const perFold = Array.from({ length: stepCount - 1 }, () => countRealFoldPublicOps())
  return { perFold, distinct: [...new Set(perFold)].sort((left, right) => left - right), total: perFold.reduce((sum, ops) => sum + ops, 0) }
}

test.beforeEach(async ({ page }) => openLab(page))

test('every rendered verdict marker has a recorded mutation that kills it', async ({ page }) => {
  const rendered = new Set<string>()
  await driveEveryState(page, async () => {
    for (const id of await page.locator('[data-verdict]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-verdict') ?? ''))) rendered.add(id)
  })
  assertCoverage(rendered, VERDICT_MUTATIONS, 'expectVerdict', 'verdict')
})

test('every rendered measurement marker has a recorded mutation that kills it', async ({ page }) => {
  const rendered = new Set<string>()
  await driveEveryState(page, async () => {
    // Markers that sit ON a verdict element are that verdict under another name and are covered by
    // its own record; everything else carrying data-claim is a measurement in its own right.
    for (const id of await page.locator('[data-claim]:not([data-verdict])').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-claim') ?? ''))) rendered.add(id)
  })
  assertCoverage(rendered, CLAIM_MUTATIONS, 'expectClaim', 'measurement')
})

test('no verdict word, verdict styling, or unmarked number renders outside a marker', async ({ page }) => {
  const offenders: string[] = []
  await driveEveryState(page, async () => {
    const found = await page.evaluate((options) => {
      const words = new RegExp(options.wordSource)
      // A number followed by a word: "6 group ops", "1,632 B", "42 group operations", "8 real steps".
      const numberWithUnit = /(?:^|[\s(])\d[\d,]*(?:\.\d+)?\s+[A-Za-z]/
      const bareNumber = /^\d[\d,]*(?:\.\d+)?$/
      const bad: string[] = []
      for (const element of Array.from(document.querySelectorAll('*'))) {
        if (element.closest('[data-verdict],[data-claim]')) continue
        const styled = Array.from(element.classList).some((name) => name.includes('verdict'))
        const text = (element.textContent ?? '').trim()
        const leaf = element.children.length === 0 && text.length > 0
        const shouted = leaf && text === text.toUpperCase() && /[A-Z]/.test(text) && words.test(text)
        const inResult = options.regions.some((selector) => element.closest(selector) !== null)
        const measured = leaf && inResult && (numberWithUnit.test(text) || bareNumber.test(text))
        if (styled || shouted || measured) bad.push(`<${element.tagName.toLowerCase()} class="${element.className}"> ${text.slice(0, 80)}`)
      }
      return bad
    }, { wordSource: VERDICT_WORDS, regions: RESULT_REGIONS })
    offenders.push(...found)
  })
  expect([...new Set(offenders)], 'verdict styling, an uppercase verdict word, or a rendered number in a result region, outside any marker').toEqual([])
})

test('the walkthrough verdicts follow the residuals they print', async ({ page }) => {
  await page.getByRole('button', { name: 'Show plain fold' }).click()
  await expectVerdict(page, 'plain-fold', { text: ['NOT SATISFIED', 'cross term remains'], result: 'fail', tone: 'bad' })
  const plainResidual = await page.locator('[data-claim="plain-residual"]').getAttribute('data-value')
  expect(plainResidual, 'plain-fold says NOT SATISFIED, so its residual must be nonzero').not.toBe('[0, 0]')

  await page.getByRole('button', { name: 'Compute cross term T' }).click()
  await page.getByRole('button', { name: 'Derive r and relax' }).click()
  await expectVerdict(page, 'relaxed-fold', { text: ['SATISFIED', 'E′ absorbed exactly r · T'], result: 'pass', tone: 'good' })
  expect(await page.locator('[data-claim="relaxed-residual"]').getAttribute('data-value'), 'relaxed-fold says SATISFIED, so its residual must be zero').toBe('[0, 0]')
})

test('the chain verdict follows the final check', async ({ page }) => {
  for (const count of [8, 64]) {
    await foldChain(page, count)
    await expectVerdict(page, 'chain', {
      text: [`FOLDED ${count} → 1, VALID`, 'constraints and both accumulated commitments agree'],
      result: 'pass',
      tone: 'good',
    })
  }
})

test('the chain cost verdict reports a measurement, not a constant', async ({ page }) => {
  // The page must report what the verifier's own code path actually costs. Counted here with a
  // stand-in written for this test alone, so the number on the page is never compared to the
  // module that produced it. Run at the default and at 64 because the fold count comes from
  // perFoldOps.length: at one step count a literal 7 would be indistinguishable from a measurement.
  for (const count of [8, 64]) {
    const measured = measuredChainCost(count)
    await foldChain(page, count)
    await expectVerdict(page, 'chain-cost', {
      text: [`PER-FOLD VERIFIER COST CONSTANT AT ${measured.distinct[0]}`, `measured across ${measured.perFold.length} folds`],
      result: 'pass',
      tone: 'good',
    })
    await expectClaim(page, 'chain-ops', { value: measured.distinct.join(','), note: 'the distinct per-fold costs this suite measured for itself' })
    await expectClaim(page, 'chain-total-ops', { value: String(measured.total), note: `${measured.perFold.length} measured per-fold costs, summed — never one count multiplied out` })
    await expectClaim(page, 'ops-per-fold', { value: String(measured.distinct[0]), note: 'the verifier lane reports one measured fold' })
    await expectClaim(page, 'meter-ops-per-fold', { value: String(measured.distinct[0]), note: 'the PER FOLD meter reports the same measured fold' })
    await expectClaim(page, 'steps-absorbed', { value: String(count), note: 'the stats grid reports the chain length that was run' })
    await expectClaim(page, 'chain-retirement', { value: String(count), note: 'the status line reports the chain length that was run' })
    await expectClaim(page, 'folded-w-length', { value: String(stepOf(1n).W.length), note: 'however many steps fold, the final witness stays one step wide' })
    await expectClaim(page, 'step-w-length', { value: String(stepOf(1n).W.length), note: 'one step of this R1CS has exactly one private coordinate, x²' })
  }
})

test('the final opening verdict follows the commitment check', async ({ page }) => {
  await foldChain(page, 8)
  await page.getByRole('button', { name: 'Open final W′ and E′' }).click()
  await expectVerdict(page, 'final-opening', {
    text: ['VALID — AND NOTHING HIDDEN', 'the printed values alone reopen both commitments'],
    result: 'caution',
    tone: 'warning',
  })
})

test('each attack verdict follows its own verifier result', async ({ page }) => {
  await page.getByRole('button', { name: 'Tamper W′' }).click()
  await expectVerdict(page, 'attack-witness', {
    text: ['FINAL CHECK FAILED', 'the relaxed constraints and the witness commitment disagree'],
    result: 'pass',
    tone: 'good',
  })
  await expect(page.locator('#attack-result')).toContainText('Verifier returned false')

  await page.getByRole('button', { name: 'Tamper Com(T)' }).click()
  await expectVerdict(page, 'attack-commitment', { text: ['TRANSCRIPT CHECK FAILED', 'Com(T) changed after r'], result: 'pass', tone: 'good' })

  await page.getByRole('button', { name: 'Reveal r before T' }).click()
  await expectVerdict(page, 'attack-r-first', {
    text: ['ACCEPTED — AND FORGED', 'an unsatisfying step passed the final check'],
    result: 'fail',
    tone: 'alarm',
  })
})
