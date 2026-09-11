import { describe, expect, it } from 'vitest'
import { commit } from '../commit/pedersen'
import { mod } from '../math/field'
import { finalCheck } from '../open/final-check'
import { step } from '../r1cs/relaxed'
import { proveFold, publicInstance, tamperCommitment } from './prove'
import { deriveChallenge } from './transcript'
import { verifyChallenge } from './verify'

describe('Nova-style NIFS', () => {
  it('binds T before deriving r and opens the folded instance', () => {
    const left = step(2n)
    const right = step(5n)
    const result = proveFold(left, right)
    expect(verifyChallenge(publicInstance(left), publicInstance(right), result.proof.commitmentT, result.proof.challenge)).toBe(true)
    expect(finalCheck(result.publicFolded, result.folded).valid).toBe(true)
  })

  it('rejects witness and T-commitment tampering independently', () => {
    const left = step(2n)
    const right = step(5n)
    const result = proveFold(left, right)
    const badWitness = { ...result.folded, W: [...result.folded.W] }
    badWitness.W[0] = mod(badWitness.W[0] + 1n)
    expect(finalCheck(result.publicFolded, badWitness).valid).toBe(false)
    expect(verifyChallenge(publicInstance(left), publicInstance(right), tamperCommitment(result.proof.commitmentT), result.proof.challenge)).toBe(false)
  })

  it('changes the challenge when transcript order changes', () => {
    const left = publicInstance(step(2n))
    const right = publicInstance(step(5n))
    const commitmentT = commit([4n, 9n])
    expect(deriveChallenge(left, right, commitmentT)).not.toBe(deriveChallenge(right, left, commitmentT))
  })

  it('keeps private witness and error vectors outside verifier inputs', () => {
    const publicKeys = Object.keys(publicInstance(step(3n))).sort()
    expect(publicKeys).toEqual(['commitmentE', 'commitmentW', 'u', 'x'])
  })

  it('refuses the u = 0 edge case', () => {
    expect(() => proveFold({ ...step(1n), u: 0n }, step(2n))).toThrow('u = 0')
  })
})