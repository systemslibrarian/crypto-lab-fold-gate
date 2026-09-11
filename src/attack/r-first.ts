import { commit } from '../commit/pedersen'
import { add, inverse, mod, scale } from '../math/field'
import { finalCheck } from '../open/final-check'
import { fold, residual, type RelaxedInstance } from '../r1cs/relaxed'
import type { PublicInstance } from '../nifs/prove'

export interface Forgery {
  challenge: bigint
  forgedT: bigint[]
  folded: RelaxedInstance
  publicFolded: PublicInstance
  accepted: boolean
}

// BROKEN protocol variant: the verifier reveals r before the prover commits T.
export function forgeAfterChallenge(left: RelaxedInstance, unsatisfyingRight: RelaxedInstance, challenge: bigint): Forgery {
  const r = mod(challenge)
  if (r === 0n) throw new Error('challenge must be nonzero')
  const shell = fold(left, unsatisfyingRight, r)
  const targetE = residual({ ...shell, E: shell.E.map(() => 0n) })
  const forgedT = scale(add(add(targetE, scale(left.E, -1n)), scale(unsatisfyingRight.E, -(r * r))), inverse(r))
  const folded = { ...shell, E: targetE }
  const publicFolded = {
    u: folded.u,
    x: folded.x,
    commitmentE: commit(left.E).add(commit(forgedT).multiply(r)).add(commit(unsatisfyingRight.E).multiply(mod(r * r))),
    commitmentW: commit(left.W).add(commit(unsatisfyingRight.W).multiply(r)),
  }
  return { challenge: r, forgedT, folded, publicFolded, accepted: finalCheck(publicFolded, folded).valid }
}