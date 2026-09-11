import { describe, expect, it } from 'vitest'
import { add, mod, scale } from '../math/field'
import { crossTerm, fold, residual, step } from './relaxed'

describe('relaxed R1CS folding', () => {
  it('absorbs the exact plain-fold cross term', () => {
    const left = step(2n)
    const right = step(5n)
    const challenge = 7n
    const T = crossTerm(left, right)
    const plain = { ...fold(left, right, challenge), E: [0n, 0n] }

    expect(residual(plain)).toEqual(scale(T, challenge))
    expect(residual(fold(left, right, challenge))).toEqual([0n, 0n])
  })

  it('keeps satisfying instances valid across repeated folds', () => {
    let folded = step(1n)
    for (let input = 2n; input <= 16n; input += 1n) folded = fold(folded, step(input), input + 11n)
    expect(residual(folded)).toEqual([0n, 0n])
  })

  it('preserves fold correctness across 64 deterministic field samples', () => {
    let sample = 0x5eedn
    const next = (): bigint => {
      sample = mod(sample * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n)
      return sample
    }

    for (let index = 0; index < 64; index += 1) {
      const left = step(next())
      const right = step(next())
      const challenge = next() || 1n
      const T = crossTerm(left, right)
      expect(residual(fold(left, right, challenge))).toEqual([0n, 0n])
      expect(residual({ ...fold(left, right, challenge), E: [0n, 0n] })).toEqual(scale(T, challenge))
    }
  })

  it('rejects malformed witness vectors', () => {
    expect(() => residual({ u: 1n, x: [1n], W: [], E: [0n, 0n] })).toThrow('witness length mismatch')
    expect(() => add([1n], [1n, 2n])).toThrow('vector length mismatch')
  })
})