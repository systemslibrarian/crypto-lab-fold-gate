import { describe, expect, it } from 'vitest'
import { generator } from '../commit/pedersen'
import { step } from '../r1cs/relaxed'
import { instrumentPoint, summariseChainCost, unwrapPoint, verifierGroupOps, type Tally } from './cost'
import { proveFold, publicInstance } from './prove'
import { foldPublic } from './verify'

describe('verifier cost instrumentation', () => {
  it('leaves the arithmetic it measures unchanged', () => {
    const tally: Tally = { ops: 0 }
    const instrumented = instrumentPoint(generator(0), tally)
    const sum = instrumented.add(generator(1).multiply(7n))
    expect(unwrapPoint(sum).equals(generator(0).add(generator(1).multiply(7n)))).toBe(true)
    expect(tally.ops).toBe(1)
  })

  it('unwraps instrumented and plain points alike', () => {
    const tally: Tally = { ops: 0 }
    expect(unwrapPoint(instrumentPoint(generator(2), tally)).equals(generator(2))).toBe(true)
    expect(unwrapPoint(generator(3)).equals(generator(3))).toBe(true)
    expect(tally.ops).toBe(0)
  })

  it('counts every group operation the real foldPublic performs', () => {
    const left = step(2n)
    const right = step(5n)
    const result = proveFold(left, right)
    const publicLeft = publicInstance(left)
    const publicRight = publicInstance(right)
    const measured = verifierGroupOps(publicLeft, publicRight, result.proof.commitmentT, result.proof.challenge)

    // Independent count of the same code path: three scalar multiplications and three point
    // additions are visible in foldPublic. If that body changes, one of these two numbers moves
    // and this test says so rather than a constant quietly staying right.
    const source = foldPublic.toString()
    const written = (source.match(/\.multiply\(/g) ?? []).length + (source.match(/\.add\(/g) ?? []).length
    expect(measured).toBe(written)
    expect(measured).toBe(6)
  })

  it('reports the same cost for every fold of a chain, and the real total', () => {
    let current = step(1n)
    let folded = current
    let accumulated = publicInstance(current)
    const perFold: number[] = []

    for (let index = 2; index <= 8; index += 1) {
      current = step(current.x[1])
      const result = proveFold(folded, current)
      const publicStep = publicInstance(current)
      perFold.push(verifierGroupOps(accumulated, publicStep, result.proof.commitmentT, result.proof.challenge))
      accumulated = foldPublic(accumulated, publicStep, result.proof.commitmentT, result.proof.challenge)
      folded = result.folded
    }

    const summary = summariseChainCost(perFold)
    expect(perFold).toHaveLength(7)
    expect(summary.constant).toBe(true)
    expect(summary.distinct).toEqual([6])
    expect(summary.total).toBe(perFold.reduce((sum, ops) => sum + ops, 0))
    expect(summary.total).toBe(42)
  })

  it('refuses to call a varying cost constant', () => {
    expect(summariseChainCost([6, 6, 7])).toEqual({ constant: false, distinct: [6, 7], total: 19 })
  })
})
