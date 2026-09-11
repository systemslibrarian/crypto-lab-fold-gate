export type Matrix = bigint[][]

// z = [u, x, y, x^2]. Public inputs are (x, y); the private witness is x^2.
export const A: Matrix = [
  [0n, 1n, 0n, 0n],
  [0n, 1n, 0n, 0n],
]
export const B: Matrix = [
  [0n, 1n, 0n, 0n],
  [0n, 0n, 0n, 1n],
]
export const C: Matrix = [
  [0n, 0n, 0n, 1n],
  [-3n, 0n, 1n, 0n],
]

export function multiply(matrix: Matrix, vector: bigint[]): bigint[] {
  if (matrix.some((row) => row.length !== vector.length)) throw new Error('witness length mismatch')
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0n))
}