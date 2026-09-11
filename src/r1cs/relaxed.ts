import { add, hadamard, mod, scale } from '../math/field'
import { A, B, C, multiply } from './matrices'

export interface RelaxedInstance {
  u: bigint
  x: bigint[]
  W: bigint[]
  E: bigint[]
}

export function step(x: bigint): RelaxedInstance {
  const square = mod(x * x)
  const y = mod(square * x + 3n)
  return { u: 1n, x: [mod(x), y], W: [square], E: [0n, 0n] }
}

export function witnessVector(instance: RelaxedInstance): bigint[] {
  return [instance.u, ...instance.x, ...instance.W]
}

export function residual(instance: RelaxedInstance): bigint[] {
  const z = witnessVector(instance)
  return add(hadamard(multiply(A, z), multiply(B, z)), scale(multiply(C, z), -instance.u))
    .map((value, index) => mod(value - instance.E[index]))
}

export function crossTerm(left: RelaxedInstance, right: RelaxedInstance): bigint[] {
  const leftZ = witnessVector(left)
  const rightZ = witnessVector(right)
  const crossProducts = add(
    hadamard(multiply(A, leftZ), multiply(B, rightZ)),
    hadamard(multiply(A, rightZ), multiply(B, leftZ)),
  )
  return add(crossProducts, add(scale(multiply(C, rightZ), -left.u), scale(multiply(C, leftZ), -right.u)))
}

export function fold(left: RelaxedInstance, right: RelaxedInstance, challenge: bigint): RelaxedInstance {
  const r = mod(challenge)
  const T = crossTerm(left, right)
  return {
    u: mod(left.u + r * right.u),
    x: add(left.x, scale(right.x, r)),
    W: add(left.W, scale(right.W, r)),
    E: add(add(left.E, scale(T, r)), scale(right.E, r * r)),
  }
}