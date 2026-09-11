import { describe, expect, it } from 'vitest'
import { mod } from '../math/field'
import { residual, step } from '../r1cs/relaxed'
import { forgeAfterChallenge } from './r-first'

describe('challenge-first broken variant', () => {
  it('forges an accepted fold containing an unsatisfying step', () => {
    const honest = step(2n)
    const bad = step(5n)
    bad.x[1] = mod(bad.x[1] + 9n)
    expect(residual(bad)).not.toEqual([0n, 0n])

    const forged = forgeAfterChallenge(honest, bad, 17n)
    expect(forged.accepted).toBe(true)
    expect(residual(forged.folded)).toEqual([0n, 0n])
  })

  it('refuses the degenerate zero challenge', () => {
    expect(() => forgeAfterChallenge(step(1n), step(2n), 0n)).toThrow('challenge must be nonzero')
  })
})