import { expect, test } from '@playwright/test'
import { commit } from '../src/commit/pedersen'
import { SCALAR_ORDER } from '../src/math/field'
import { openLab } from './gate'

const mod = (value: bigint): bigint => ((value % SCALAR_ORDER) + SCALAR_ORDER) % SCALAR_ORDER
const add = (left: bigint[], right: bigint[]): bigint[] => left.map((value, index) => mod(value + right[index]))
const scale = (values: bigint[], scalar: bigint): bigint[] => values.map((value) => mod(value * scalar))
const hadamard = (left: bigint[], right: bigint[]): bigint[] => left.map((value, index) => mod(value * right[index]))
const multiply = (matrix: bigint[][], vector: bigint[]): bigint[] => matrix.map((row) => mod(row.reduce((sum, value, index) => sum + value * vector[index], 0n)))

function parseVector(value: string): bigint[] {
  return value.replace(/[\[\]]/g, '').split(',').filter(Boolean).map((entry) => BigInt(entry.trim()))
}

async function claim(page: import('@playwright/test').Page, name: string): Promise<string> {
  return page.locator(`[data-claim="${name}"]`).first().getAttribute('data-value').then((value) => {
    if (value === null) throw new Error(`missing data-value for ${name}`)
    return value
  })
}

test.beforeEach(async ({ page }) => openLab(page))

test('rendered fold satisfies relaxed R1CS by independent recomputation', async ({ page }) => {
  const A = JSON.parse(await claim(page, 'A')).map((row: string[]) => row.map(BigInt))
  const B = JSON.parse(await claim(page, 'B')).map((row: string[]) => row.map(BigInt))
  const C = JSON.parse(await claim(page, 'C')).map((row: string[]) => row.map(BigInt))
  const u = BigInt((await claim(page, 'ufold')).replace(/[\[\]]/g, ''))
  const x = parseVector(await claim(page, 'xfold'))
  const W = parseVector(await claim(page, 'Wfold'))
  const E = parseVector(await claim(page, 'Efold'))
  const z = [u, ...x, ...W]
  const check = add(hadamard(multiply(A, z), multiply(B, z)), scale(multiply(C, z), -u)).map((value, index) => mod(value - E[index]))
  expect(check).toEqual([0n, 0n])
  expect(commit(E).toHex()).toBe(await claim(page, 'pair-commitment-e'))
})

test('rendered T exactly matches the cross term and plain residual', async ({ page }) => {
  const A = JSON.parse(await claim(page, 'A')).map((row: string[]) => row.map(BigInt))
  const B = JSON.parse(await claim(page, 'B')).map((row: string[]) => row.map(BigInt))
  const C = JSON.parse(await claim(page, 'C')).map((row: string[]) => row.map(BigInt))
  const x1 = parseVector(await claim(page, 'x1'))
  const x2 = parseVector(await claim(page, 'x2'))
  const W1 = parseVector(await claim(page, 'W1'))
  const W2 = parseVector(await claim(page, 'W2'))
  const z1 = [1n, ...x1, ...W1]
  const z2 = [1n, ...x2, ...W2]
  const recomputed = add(
    add(hadamard(multiply(A, z1), multiply(B, z2)), hadamard(multiply(A, z2), multiply(B, z1))),
    add(scale(multiply(C, z2), -1n), scale(multiply(C, z1), -1n)),
  )
  const T = parseVector(await claim(page, 'T'))
  const r = BigInt(await claim(page, 'r'))
  expect(T).toEqual(recomputed)
  expect(parseVector(await claim(page, 'plain-residual'))).toEqual(scale(T, r))
})

test('per-fold work stays constant and the final opening proves the negative claim', async ({ page }) => {
  await page.getByRole('button', { name: 'Fold 8 steps' }).click()
  await expect(page.getByText('FOLDED 8 → 1, VALID')).toBeVisible()
  expect(await claim(page, 'chain-ops')).toBe(await claim(page, 'ops-per-fold'))
  expect(await claim(page, 'folded-w-length')).toBe(await claim(page, 'step-w-length'))
  await page.getByRole('button', { name: 'Open final W′ and E′' }).click()
  await expect(page.getByText('VALID — AND NOTHING HIDDEN')).toBeVisible()
  await expect(page.locator('[data-claim="negative-claim"]')).toContainText('neither zero-knowledge nor succinct')
  const openedW = parseVector(await claim(page, 'opened-W')).length
  const openedE = parseVector(await claim(page, 'opened-E')).length
  expect(Number(await claim(page, 'open-length'))).toBe(openedW + openedE)

  await page.selectOption('#step-count', '64')
  await expect(page.locator('#chain-result')).toBeHidden()
  await expect(page.locator('#chain-retirement')).toContainText('verdict retired')
  await page.getByRole('button', { name: 'Fold 64 steps' }).click()
  await expect(page.getByText('FOLDED 64 → 1, VALID')).toBeVisible()
  expect(await claim(page, 'chain-ops')).toBe(await claim(page, 'ops-per-fold'))

  await page.selectOption('#step-count', '64')
  await expect(page.getByText('FOLDED 64 → 1, VALID')).toBeVisible()
})

test('each attack path names the real cause and the broken mode forges', async ({ page }) => {
  await page.getByRole('button', { name: 'Tamper W′' }).click()
  await expect(page.locator('[data-claim="attack-verdict"]')).toContainText('FINAL CHECK FAILED')
  await expect(page.locator('#attack-result')).toContainText('witness commitment and constraints disagree')

  await page.getByRole('button', { name: 'Tamper Com(T)' }).click()
  await expect(page.locator('[data-claim="attack-verdict"]')).toContainText('TRANSCRIPT CHECK FAILED')
  await expect(page.locator('#attack-result')).toContainText('recomputed challenge no longer matches')

  await page.getByRole('button', { name: 'Reveal r before T' }).click()
  await expect(page.locator('[data-claim="attack-verdict"]')).toContainText('ACCEPTED — AND FORGED')
  await expect(page.locator('#attack-result')).toContainText('unsatisfying')
})

test('[hidden] states do not paint', async ({ page }) => {
  const visibleHidden = await page.locator('[hidden]').evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).display !== 'none').length)
  expect(visibleHidden).toBe(0)
})