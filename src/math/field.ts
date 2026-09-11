export const SCALAR_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed')

export function mod(value: bigint): bigint {
  const reduced = value % SCALAR_ORDER
  return reduced >= 0n ? reduced : reduced + SCALAR_ORDER
}

export function inverse(value: bigint): bigint {
  let base = mod(value)
  if (base === 0n) throw new Error('zero has no inverse')
  let exponent = SCALAR_ORDER - 2n
  let result = 1n
  while (exponent > 0n) {
    if (exponent & 1n) result = mod(result * base)
    base = mod(base * base)
    exponent >>= 1n
  }
  return result
}

export function add(left: bigint[], right: bigint[]): bigint[] {
  if (left.length !== right.length) throw new Error('vector length mismatch')
  return left.map((value, index) => mod(value + right[index]))
}

export function scale(values: bigint[], scalar: bigint): bigint[] {
  return values.map((value) => mod(value * scalar))
}

export function hadamard(left: bigint[], right: bigint[]): bigint[] {
  if (left.length !== right.length) throw new Error('vector length mismatch')
  return left.map((value, index) => mod(value * right[index]))
}