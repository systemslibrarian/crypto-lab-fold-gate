import { describe, expect, it } from 'vitest'
import { add, scale } from '../math/field'
import { commit, generator } from './pedersen'

describe('ristretto255 Pedersen vector commitments', () => {
  it('is homomorphic for vectors of the same length', () => {
    const left = [3n, 8n, 13n]
    const right = [5n, 2n, 21n]
    const r = 17n
    expect(commit(left).add(commit(right).multiply(r)).equals(commit(add(left, scale(right, r))))).toBe(true)
  })

  it('derives distinct non-identity generators deterministically', () => {
    const generators = Array.from({ length: 8 }, (_, index) => generator(index))
    expect(generators.every((point) => !point.is0())).toBe(true)
    expect(new Set(generators.map((point) => point.toHex())).size).toBe(generators.length)
    expect(generator(3).equals(generator(3))).toBe(true)
  })
})