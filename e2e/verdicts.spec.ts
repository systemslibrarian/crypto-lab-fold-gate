import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { commit } from '../src/commit/pedersen'
import { proveFold, publicInstance, type PublicInstance } from '../src/nifs/prove'
import { foldPublic } from '../src/nifs/verify'
import { step } from '../src/r1cs/relaxed'
import { openLab } from './gate'
import { VERDICT_MUTATIONS } from './verdict-mutations'

/**
 * Coverage is derived from the rendered page, never from a list anyone wrote by hand. These
 * tests walk the DOM through every state the lab can reach, collect the `data-verdict` markers
 * that actually render, and hold that set against the recorded mutations in
 * `verdict-mutations.ts`. A marker with no mutation fails; a mutation for a marker that no
 * longer renders fails; and any verdict word or verdict styling painted outside a marker fails,
 * which is what catches a raw banner added later by a careless hand.
 */

const SPEC_SOURCE = readFileSync(fileURLToPath(new URL('./verdicts.spec.ts', import.meta.url)), 'utf8')

const VERDICT_WORDS = '\\b(VALID|INVALID|ACCEPTED|REJECTED|REFUSED|FAILED|PASSED|SATISFIED|UNSATISFIED|FORGED|SECURE|INSECURE|VERIFIED|TAMPERED|SUCCESS|FAILURE|SAFE|UNSAFE|MISMATCH)\\b'

async function markersInDom(page: Page): Promise<string[]> {
  return page.locator('[data-verdict]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-verdict') ?? ''))
}

/** Drives every state the lab can reach, calling back after each one so markers can be collected. */
async function driveEveryState(page: Page, after: () => Promise<void>): Promise<void> {
  await after()
  for (const label of ['Show plain fold', 'Compute cross term T', 'Derive r and relax']) {
    await page.getByRole('button', { name: label }).click()
    await after()
  }
  await page.getByRole('button', { name: 'Fold 8 steps' }).click()
  await expect(page.locator('[data-verdict="chain"]')).toBeVisible()
  await after()
  await page.getByRole('button', { name: 'Open final W′ and E′' }).click()
  await expect(page.locator('[data-verdict="final-opening"]')).toBeVisible()
  await after()
  for (const label of ['Tamper W′', 'Tamper Com(T)', 'Reveal r before T']) {
    await page.getByRole('button', { name: label }).click()
    await expect(page.locator('#attack-result [data-verdict]')).toBeVisible()
    await after()
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

test.beforeEach(async ({ page }) => openLab(page))

test('every rendered verdict marker has a recorded mutation that kills it', async ({ page }) => {
  const rendered = new Set<string>()
  await driveEveryState(page, async () => {
    for (const id of await markersInDom(page)) rendered.add(id)
  })

  const recorded = Object.keys(VERDICT_MUTATIONS).sort()
  expect([...rendered].sort(), 'markers on the page without a recorded mutation, or mutations for markers that no longer render').toEqual(recorded)

  for (const [id, record] of Object.entries(VERDICT_MUTATIONS)) {
    for (const field of ['computes', 'file', 'mutation', 'baseline', 'failure', 'killedBy'] as const) {
      expect(record[field].trim(), `${id}.${field} is empty: a mutation is only recorded once it has actually been run`).not.toBe('')
    }
    expect(SPEC_SOURCE.includes(`data-verdict="${id}"`), `${id} has a recorded mutation but nothing in verdicts.spec.ts asserts its rendered text`).toBe(true)
    expect(SPEC_SOURCE.includes(record.killedBy), `${id}.killedBy names "${record.killedBy}", which is not a test in verdicts.spec.ts`).toBe(true)
  }
})

test('no verdict word or verdict styling renders outside a marker', async ({ page }) => {
  const offenders: string[] = []
  await driveEveryState(page, async () => {
    const found = await page.evaluate((wordSource) => {
      const words = new RegExp(wordSource)
      const bad: string[] = []
      for (const element of Array.from(document.querySelectorAll('*'))) {
        if (element.closest('[data-verdict]')) continue
        const styled = Array.from(element.classList).some((name) => name.includes('verdict'))
        const text = (element.textContent ?? '').trim()
        const shouted = element.children.length === 0
          && text.length > 0
          && text === text.toUpperCase()
          && /[A-Z]/.test(text)
          && words.test(text)
        if (styled || shouted) bad.push(`<${element.tagName.toLowerCase()} class="${element.className}"> ${text.slice(0, 80)}`)
      }
      return bad
    }, VERDICT_WORDS)
    offenders.push(...found)
  })
  expect([...new Set(offenders)], 'verdict styling or an uppercase verdict word rendered outside any data-verdict marker').toEqual([])
})

test('the walkthrough verdicts follow the residuals they print', async ({ page }) => {
  await page.getByRole('button', { name: 'Show plain fold' }).click()
  const plain = page.locator('[data-verdict="plain-fold"]')
  await expect(plain).toContainText('NOT SATISFIED')
  await expect(plain).toHaveClass(/verdict-bad/)
  const plainResidual = await page.locator('[data-claim="plain-residual"]').getAttribute('data-value')
  expect(plainResidual, 'plain-fold says NOT SATISFIED, so its residual must be nonzero').not.toBe('[0, 0]')

  await page.getByRole('button', { name: 'Compute cross term T' }).click()
  await page.getByRole('button', { name: 'Derive r and relax' }).click()
  const relaxed = page.locator('[data-verdict="relaxed-fold"]')
  await expect(relaxed).toContainText('SATISFIED')
  await expect(relaxed).toHaveClass(/verdict-good/)
  expect(await page.locator('[data-claim="relaxed-residual"]').getAttribute('data-value'), 'relaxed-fold says SATISFIED, so its residual must be zero').toBe('[0, 0]')
})

test('the chain verdict follows the final check', async ({ page }) => {
  await page.getByRole('button', { name: 'Fold 8 steps' }).click()
  const chain = page.locator('[data-verdict="chain"]')
  await expect(chain).toContainText('FOLDED 8 → 1, VALID')
  await expect(chain).toHaveClass(/verdict-good/)
  await expect(chain).toContainText('constraints and both accumulated commitments agree')
})

test('the chain cost verdict reports a measurement, not a constant', async ({ page }) => {
  await page.getByRole('button', { name: 'Fold 8 steps' }).click()
  const cost = page.locator('[data-verdict="chain-cost"]')
  await expect(cost).toContainText('PER-FOLD VERIFIER COST CONSTANT AT')
  await expect(cost).toContainText('measured across 7 folds')

  // The page must report what the verifier's own code path actually costs. Counted here with a
  // stand-in written for this test alone, so the number on the page is never compared to the
  // module that produced it.
  const counted = countRealFoldPublicOps()
  expect(await page.locator('[data-claim="chain-ops"]').getAttribute('data-value')).toBe(String(counted))
  expect(await page.locator('[data-claim="ops-per-fold"]').getAttribute('data-value')).toBe(String(counted))
  expect(await page.locator('[data-claim="chain-total-ops"]').getAttribute('data-value'), 'seven folds of measured cost, summed').toBe(String(counted * 7))
})

test('the final opening verdict follows the commitment check', async ({ page }) => {
  await page.getByRole('button', { name: 'Fold 8 steps' }).click()
  await page.getByRole('button', { name: 'Open final W′ and E′' }).click()
  const opening = page.locator('[data-verdict="final-opening"]')
  await expect(opening).toContainText('VALID — AND NOTHING HIDDEN')
  await expect(opening).toContainText('the printed values alone reopen both commitments')

  // "Nothing hidden" is a measurable claim: re-commit the values the page printed and check they
  // reproduce the commitment the verifier accumulated. A blinded commitment would not.
  const parse = (value: string): bigint[] => value.replace(/[\[\]]/g, '').split(',').filter(Boolean).map((entry) => BigInt(entry.trim()))
  const openedE = parse((await page.locator('[data-claim="opened-E"]').getAttribute('data-value'))!)
  expect(commit(openedE).toHex()).toBe(await page.locator('[data-claim="final-commitment-e"]').getAttribute('data-value'))
})

test('each attack verdict follows its own verifier result', async ({ page }) => {
  await page.getByRole('button', { name: 'Tamper W′' }).click()
  const witness = page.locator('[data-verdict="attack-witness"]')
  await expect(witness).toContainText('FINAL CHECK FAILED')
  await expect(witness).toContainText('the relaxed constraints and the witness commitment disagree')
  await expect(page.locator('#attack-result')).toContainText('Verifier returned false')

  await page.getByRole('button', { name: 'Tamper Com(T)' }).click()
  const commitment = page.locator('[data-verdict="attack-commitment"]')
  await expect(commitment).toContainText('TRANSCRIPT CHECK FAILED')
  await expect(commitment).toContainText('Com(T) changed after r')

  await page.getByRole('button', { name: 'Reveal r before T' }).click()
  const rFirst = page.locator('[data-verdict="attack-r-first"]')
  await expect(rFirst).toContainText('ACCEPTED — AND FORGED')
  await expect(rFirst).toContainText('an unsatisfying step passed the final check')
  const hidden = await page.locator('[data-claim="hidden-residual"]').getAttribute('data-value')
  expect(hidden, 'the forged step must genuinely be unsatisfying, or there is nothing to forge').not.toBe('[0, 0]')
})
