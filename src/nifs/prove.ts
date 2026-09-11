import { commit, type Commitment } from '../commit/pedersen'
import { mod } from '../math/field'
import { crossTerm, fold, type RelaxedInstance } from '../r1cs/relaxed'
import { deriveChallenge } from './transcript'
import { foldPublic } from './verify'

export interface PublicInstance {
  u: bigint
  x: bigint[]
  commitmentE: Commitment
  commitmentW: Commitment
}

export interface FoldProof {
  T: bigint[]
  commitmentT: Commitment
  challenge: bigint
}

export function publicInstance(instance: RelaxedInstance): PublicInstance {
  return { u: instance.u, x: instance.x, commitmentE: commit(instance.E), commitmentW: commit(instance.W) }
}

export function proveFold(left: RelaxedInstance, right: RelaxedInstance): {
  folded: RelaxedInstance
  publicFolded: PublicInstance
  proof: FoldProof
} {
  if (left.u === 0n || right.u === 0n) throw new Error('u = 0 instances are refused by this teaching protocol')
  const T = crossTerm(left, right)
  const commitmentT = commit(T)
  const publicLeft = publicInstance(left)
  const publicRight = publicInstance(right)
  const challenge = deriveChallenge(publicLeft, publicRight, commitmentT)
  const proof = { T, commitmentT, challenge }
  return {
    folded: fold(left, right, challenge),
    publicFolded: foldPublic(publicLeft, publicRight, commitmentT, challenge),
    proof,
  }
}

export function tamperCommitment(commitment: Commitment): Commitment {
  return commitment.add(commit([mod(1n)]))
}