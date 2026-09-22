import { expect, test } from '@playwright/test'
import { commit } from '../src/commit/pedersen'
import { openLab } from './gate'
import {
  MATRIX_A,
  MATRIX_B,
  MATRIX_C,
  claimValue,
  crossTermOf,
  expectClaim,
  foldChain,
  full,
  inverse,
  matrixValue,
  mod,
  parseVector,
  residualOf,
  stepOf,
  vadd,
  vscale,
} from './markers'

/**
 * Every rendered measurement this file owns is asserted against an oracle built here, from the
 * R1CS written out as a literal in markers.ts — never against the module that produced the number.
 * e2e/verdicts.spec.ts requires each recorded claim mutation to name a test here (or there) that
 * goes through expectClaim(page, '<id>', …), so a record cannot be evidence for a marker nothing
 * actually asserts.
 *
 * The challenge is the one value no oracle can derive from first principles cheaply, so it is
 * recovered from the OTHER rendered values instead: r = plain-residual / T, and inside the chain
 * opening each of W′ and E′ derives the r that predicts the other. A mutation to either one is
 * caught by the other's derivation.
 */

const LEFT = stepOf(2n)
const RIGHT = stepOf(5n)
const CROSS = crossTermOf(LEFT, RIGHT)

test.beforeEach(async ({ page }) => openLab(page))

test('the rendered instances are the R1CS this lab describes', async ({ page }) => {
  await expectClaim(page, 'A', { value: matrixValue(MATRIX_A), note: 'row one takes x on the left of both products' })
  await expectClaim(page, 'B', { value: matrixValue(MATRIX_B), note: 'row one squares x; row two multiplies by the witness x²' })
  await expectClaim(page, 'C', { value: matrixValue(MATRIX_C), note: 'row one outputs x²; row two outputs y − 3u' })

  await expectClaim(page, 'x1', { value: full(LEFT.x), note: 'instance 1 is the step x = 2, so y = 2³ + 3' })
  await expectClaim(page, 'W1', { value: full(LEFT.W), note: 'the private witness of instance 1 is x² = 4' })
  await expectClaim(page, 'x2', { value: full(RIGHT.x), note: 'instance 2 is the step x = 5, so y = 5³ + 3' })
  await expectClaim(page, 'W2', { value: full(RIGHT.W), note: 'the private witness of instance 2 is x² = 25' })

  // The FINAL OPEN meter states the size of the one opening the whole chain ends in, which is one
  // private W coordinate and a two-row error vector, whatever the chain length was.
  await expectClaim(page, 'final-open-shape', {
    value: `${stepOf(1n).W.length}W+${stepOf(1n).E.length}E`,
    note: 'the final open is one W coordinate and one E per constraint row',
  })
})

test('rendered T exactly matches the cross term, and r follows from it', async ({ page }) => {
  await page.getByRole('button', { name: 'Show plain fold' }).click()
  await page.getByRole('button', { name: 'Compute cross term T' }).click()
  await page.getByRole('button', { name: 'Derive r and relax' }).click()

  const renderedR = BigInt(await claimValue(page, 'r'))
  const plainResidual = parseVector(await claimValue(page, 'plain-residual'))

  await expectClaim(page, 'T', { value: full(CROSS), note: 'the cross term A z₁ ∘ B z₂ + A z₂ ∘ B z₁ − u₁ C z₂ − u₂ C z₁, recomputed here' })
  // r is not derived from the transcript here; it is recovered from the residual the page printed
  // and the cross term this suite computed, so the rendered challenge is never its own oracle.
  await expectClaim(page, 'r', {
    value: String(mod(plainResidual[0] * inverse(CROSS[0]))),
    note: 'the challenge the printed plain residual implies, given the recomputed T',
  })
  await expectClaim(page, 'plain-residual', { value: full(vscale(CROSS, renderedR)), note: 'the plain combination leaves exactly r · T behind' })
  await expectClaim(page, 'expected-residual', { value: full(vscale(CROSS, renderedR)), note: 'the equation beside it must print the same r · T' })
})

test('the folded instance is the linear combination the page claims', async ({ page }) => {
  await page.getByRole('button', { name: 'Show plain fold' }).click()
  await page.getByRole('button', { name: 'Compute cross term T' }).click()
  await page.getByRole('button', { name: 'Derive r and relax' }).click()

  const r = BigInt(await claimValue(page, 'r'))
  await expectClaim(page, 'ufold', { value: full([mod(LEFT.u + r * RIGHT.u)]), note: "u′ = u₁ + r·u₂" })
  await expectClaim(page, 'xfold', { value: full(vadd(LEFT.x, vscale(RIGHT.x, r))), note: "x′ = x₁ + r·x₂" })
  await expectClaim(page, 'Wfold', { value: full(vadd(LEFT.W, vscale(RIGHT.W, r))), note: "W′ = W₁ + r·W₂" })
  await expectClaim(page, 'Efold', { value: full(vscale(CROSS, r)), note: "E′ = E₁ + r·T + r²·E₂, and both inputs have E = 0" })

  // Recomputed from the four values the page just printed, with this suite's own arithmetic.
  const folded = {
    u: parseVector(await claimValue(page, 'ufold'))[0],
    x: parseVector(await claimValue(page, 'xfold')),
    W: parseVector(await claimValue(page, 'Wfold')),
    E: parseVector(await claimValue(page, 'Efold')),
  }
  await expectClaim(page, 'relaxed-residual', { value: full(residualOf(folded)), note: 'the printed folded instance must satisfy the relaxed constraints' })

  // The verifier reached Com(E′) homomorphically and never saw E′. Re-committing the printed
  // vector has to land on the same point.
  await expectClaim(page, 'pair-commitment-e', { value: commit(folded.E).toHex(), note: "the accumulated Com(E′) must reopen from the printed E′" })
})

test('the final opening reproduces the accumulated commitments', async ({ page }) => {
  // Two steps, because at two the whole chain is one fold of step(1) into step(4) and both opened
  // vectors are predictable from the other one. Longer chains are covered in verdicts.spec.ts.
  const first = stepOf(1n)
  const second = stepOf(first.x[1])
  const cross = crossTermOf(first, second)

  await foldChain(page, 2)
  await expect(page.locator('[data-verdict="chain"]')).toContainText('FOLDED 2 → 1, VALID')
  await page.getByRole('button', { name: 'Open final W′ and E′' }).click()

  const openedW = parseVector(await claimValue(page, 'opened-W'))
  const openedE = parseVector(await claimValue(page, 'opened-E'))
  // Each opened vector derives the challenge that predicts the other, so neither is its own oracle.
  const rFromW = mod((openedW[0] - first.W[0]) * inverse(second.W[0]))
  const rFromE = mod(openedE[0] * inverse(cross[0]))

  await expectClaim(page, 'opened-W', { value: full(vadd(first.W, vscale(second.W, rFromE))), note: "W′ = W₁ + r·W₂ for the r that E′ implies" })
  await expectClaim(page, 'opened-E', { value: full(vscale(cross, rFromW)), note: "E′ = r·T for the r that W′ implies" })
  await expectClaim(page, 'final-commitment-e', { value: commit(openedE).toHex(), note: "the verifier's accumulated Com(E′) must reopen from the printed E′ alone" })
  await expectClaim(page, 'open-length', { value: String(openedW.length + openedE.length), note: 'the opening is exactly the values it printed' })
  await expectClaim(page, 'folded-e-length', { value: String(openedE.length), note: 'one error coordinate per constraint row' })
  await expectClaim(page, 'negative-claim', {
    text: `neither zero-knowledge nor succinct on its own: the verifier’s accumulated commitments reopen from the ${openedW.length + openedE.length} values printed above`,
    note: 'the negative claim must name the same opening it is drawn from',
  })
})

test('each attack path names the real cause and the broken mode forges', async ({ page }) => {
  await page.getByRole('button', { name: 'Tamper W′' }).click()
  await expect(page.locator('#attack-result')).toContainText('the relaxed constraints and the witness commitment disagree')

  await page.getByRole('button', { name: 'Tamper Com(T)' }).click()
  await expect(page.locator('#attack-result')).toContainText('recomputed challenge no longer matches')

  await page.getByRole('button', { name: 'Reveal r before T' }).click()
  await expect(page.locator('#attack-result')).toContainText('unsatisfying')
  // The broken mode hides a step whose second public input was moved by 9, so its residual is
  // exactly −9 in the row that enforces y − 3u. If that were zero there would be nothing to forge.
  const hidden = { ...RIGHT, x: [RIGHT.x[0], mod(RIGHT.x[1] + 9n)] }
  await expectClaim(page, 'hidden-residual', { value: full(residualOf(hidden)), note: 'the forged step really has to be unsatisfying' })
})

test('[hidden] states do not paint', async ({ page }) => {
  const visibleHidden = await page.locator('[hidden]').evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).display !== 'none').length)
  expect(visibleHidden).toBe(0)
})
