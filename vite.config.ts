import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/crypto-lab-fold-gate/',
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/{attack,commit,math,nifs,open,r1cs}/**/*.ts'],
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 85,
        lines: 95,
      },
    },
  },
})