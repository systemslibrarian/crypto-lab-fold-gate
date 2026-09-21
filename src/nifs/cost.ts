import type { Commitment } from '../commit/pedersen'
import type { PublicInstance } from './prove'
import { foldPublic } from './verify'

export interface Tally {
  ops: number
}

// A stand-in for a ristretto255 point that tallies every group operation performed on it and
// passes the tally down to whatever that operation produces. The verifier's cost is therefore
// whatever the real foldPublic code path executes; no constant asserts it anywhere.
class CountingPoint {
  constructor(readonly point: Commitment, readonly tally: Tally) {}

  add(other: CountingPoint | Commitment): CountingPoint {
    this.tally.ops += 1
    return new CountingPoint(this.point.add(unwrapPoint(other)), this.tally)
  }

  multiply(scalar: bigint): CountingPoint {
    this.tally.ops += 1
    return new CountingPoint(this.point.multiply(scalar), this.tally)
  }
}

/** Returns the underlying curve point, whether or not it is currently instrumented. */
export function unwrapPoint(value: CountingPoint | Commitment): Commitment {
  return value instanceof CountingPoint ? value.point : value
}

/** Wraps a point so that every add and multiply applied to it, or to its results, is tallied. */
export function instrumentPoint(point: Commitment, tally: Tally): Commitment {
  return new CountingPoint(point, tally) as unknown as Commitment
}

function instrumentInstance(instance: PublicInstance, tally: Tally): PublicInstance {
  return {
    ...instance,
    commitmentE: instrumentPoint(instance.commitmentE, tally),
    commitmentW: instrumentPoint(instance.commitmentW, tally),
  }
}

/**
 * Runs one real NIFS verifier fold over instrumented points and returns the number of
 * ristretto255 group operations it cost. Change foldPublic and this number changes with it.
 */
export function verifierGroupOps(
  left: PublicInstance,
  right: PublicInstance,
  commitmentT: Commitment,
  challenge: bigint,
): number {
  const tally: Tally = { ops: 0 }
  foldPublic(instrumentInstance(left, tally), instrumentInstance(right, tally), instrumentPoint(commitmentT, tally), challenge)
  return tally.ops
}

/**
 * Folds the measured per-fold costs of a chain into the shape the chain panel renders.
 * `constant` goes false the moment any fold costs a different amount than another, which is the
 * property that panel claims; `total` is the real sum, not a per-fold figure multiplied out.
 */
export function summariseChainCost(perFold: number[]): { constant: boolean; distinct: number[]; total: number } {
  const distinct = [...new Set(perFold)].sort((left, right) => left - right)
  return { constant: distinct.length === 1, distinct, total: perFold.reduce((sum, ops) => sum + ops, 0) }
}
