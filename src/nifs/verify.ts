import type { Commitment } from '../commit/pedersen'
import { add, mod, scale } from '../math/field'
import { deriveChallenge } from './transcript'
import type { PublicInstance } from './prove'

export function verifyChallenge(
  left: PublicInstance,
  right: PublicInstance,
  commitmentT: Commitment,
  challenge: bigint,
): boolean {
  return deriveChallenge(left, right, commitmentT) === mod(challenge)
}

export function foldPublic(
  left: PublicInstance,
  right: PublicInstance,
  commitmentT: Commitment,
  challenge: bigint,
): PublicInstance {
  const r = mod(challenge)
  return {
    u: mod(left.u + r * right.u),
    x: add(left.x, scale(right.x, r)),
    commitmentE: left.commitmentE.add(commitmentT.multiply(r)).add(right.commitmentE.multiply(mod(r * r))),
    commitmentW: left.commitmentW.add(right.commitmentW.multiply(r)),
  }
}