import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { mod } from '../math/field'

export const GENERATOR_DST = 'FOLD-GATE-RISTRETTO255_XMD:SHA-512_RFC9380_V1'
export type Commitment = ReturnType<typeof ristretto255_hasher.hashToCurve>

export function generator(index: number): Commitment {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('generator index must be a non-negative integer')
  return ristretto255_hasher.hashToCurve(utf8ToBytes(`FoldGate/Pedersen/G/${index}`), { DST: GENERATOR_DST })
}

export function commit(values: bigint[]): Commitment {
  return values.reduce(
    (sum, value, index) => {
      const scalar = mod(value)
      return scalar === 0n ? sum : sum.add(generator(index).multiply(scalar))
    },
    ristretto255.Point.ZERO,
  )
}

export function commitmentHex(point: Commitment): string {
  return point.toHex()
}