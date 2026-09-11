import { sha512 } from '@noble/hashes/sha2.js'
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import type { Commitment } from '../commit/pedersen'
import { SCALAR_ORDER } from '../math/field'

const TRANSCRIPT_DST = utf8ToBytes('FoldGate/NovaNIFS/Transcript/v1')

function lengthPrefix(bytes: Uint8Array): Uint8Array {
  const length = new Uint8Array(4)
  new DataView(length.buffer).setUint32(0, bytes.length, false)
  return concatBytes(length, bytes)
}

function scalarBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32)
  let remaining = value
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  return bytes
}

function hashToNonzeroScalar(parts: Uint8Array[]): bigint {
  for (let retry = 0; retry < 256; retry += 1) {
    const digest = sha512(concatBytes(TRANSCRIPT_DST, Uint8Array.of(retry), ...parts.map(lengthPrefix)))
    const value = digest.reduceRight((sum, byte) => (sum << 8n) + BigInt(byte), 0n) % SCALAR_ORDER
    if (value !== 0n) return value
  }
  throw new Error('failed to derive a nonzero challenge')
}

export interface TranscriptInstance {
  u: bigint
  x: bigint[]
  commitmentE: Commitment
  commitmentW: Commitment
}

export function deriveChallenge(left: TranscriptInstance, right: TranscriptInstance, commitmentT: Commitment): bigint {
  return hashToNonzeroScalar([
    scalarBytes(left.u),
    scalarBytes(right.u),
    ...left.x.map(scalarBytes),
    ...right.x.map(scalarBytes),
    left.commitmentE.toBytes(),
    right.commitmentE.toBytes(),
    left.commitmentW.toBytes(),
    right.commitmentW.toBytes(),
    commitmentT.toBytes(),
  ])
}