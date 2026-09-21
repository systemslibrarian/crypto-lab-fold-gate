/**
 * One record per rendered verdict marker (`data-verdict="<id>"`).
 *
 * A marker earns a record only after the mutation below was actually applied, the suite was run
 * with `CI=1` so no stale preview server could be reused, the unmutated baseline was observed
 * PASSING in the same session, and the mutated run failed on THAT marker's own assertion rather
 * than on a build error, a blank page, or the whole suite going red. `baseline` and `failure`
 * are verbatim reporter lines from those runs.
 *
 * e2e/verdicts.spec.ts walks the rendered page and fails if any marker has no record here, or if
 * any record names a marker the page no longer renders, or if a record's `killedBy` marker is
 * not actually asserted in that spec. It also fails if verdict words or verdict styling appear
 * anywhere outside a marker.
 */
export interface VerdictMutation {
  /** What the verdict reads, in one line. */
  computes: string
  /** File the mutation was applied to. */
  file: string
  /** The edit, precisely enough to redo it. */
  mutation: string
  /** Verbatim reporter line for the unmutated run, same session. */
  baseline: string
  /** Verbatim failure of this marker's own assertion under the mutation. */
  failure: string
  /** Test title in verdicts.spec.ts that owns this marker. */
  killedBy: string
}

export const VERDICT_MUTATIONS: Record<string, VerdictMutation> = {
  'plain-fold': {
    computes: 'residual() of the folded instance with E zeroed out, i.e. the plain random combination',
    file: 'src/ui/app.ts',
    mutation: "template(): `const plain = { ...result.folded, E: [0n, 0n] }` -> `const plain = { ...result.folded }`, so the plain fold keeps E' and becomes satisfying",
    baseline:
      "PASS: '✓   8 e2e/verdicts.spec.ts:122:1 › the walkthrough verdicts follow the residuals they print (1.3s)' in a run reporting '15 passed (8.1s)'",
    failure:
      "e2e/verdicts.spec.ts:122 toContainText failed on locator('[data-verdict=\"plain-fold\"]'): expected substring \"NOT SATISFIED\", received \"SATISFIED · no cross term left over\". Run: 2 failed / 13 passed -- the second failure is claims.spec.ts:56, which independently recomputes r·T.",
    killedBy: 'the walkthrough verdicts follow the residuals they print',
  },
  'relaxed-fold': {
    computes: "residual() of the relaxed folded instance, which is zero only if E' absorbed r*T",
    file: 'src/ui/app.ts',
    mutation: "template(): `const relaxedResidual = residual(result.folded)` -> `residual(plain)`, pointing the verdict at the unrelaxed combination",
    baseline:
      "PASS: '✓   7 e2e/verdicts.spec.ts:122:1 › the walkthrough verdicts follow the residuals they print (689ms)' in a run reporting '15 passed (9.6s)'",
    failure:
      "e2e/verdicts.spec.ts:122 toHaveClass failed on locator('[data-verdict=\"relaxed-fold\"]'): expected /verdict-good/, received \"verdict verdict-bad\"; the headline flipped to NOT SATISFIED with it. Run: 1 failed / 14 passed.",
    killedBy: 'the walkthrough verdicts follow the residuals they print',
  },
  chain: {
    computes: "finalCheck of the opened witness against the commitments the verifier accumulated with foldPublic",
    file: 'src/open/final-check.ts',
    mutation: 'finalCheck(): `valid: constraintValid && ...` -> `valid: false && constraintValid && ...`',
    baseline:
      "PASS: '✓  10 e2e/verdicts.spec.ts:138:1 › the chain verdict follows the final check (1.1s)' in a run reporting '15 passed (17.2s)'",
    failure:
      "e2e/verdicts.spec.ts:138 toContainText failed on locator('[data-verdict=\"chain\"]'): expected \"FOLDED 8 → 1, VALID\", received \"FOLDED 8 → 1, INVALID · the composite final check did not pass\". Run: 6 failed / 9 passed -- final-opening and attack-r-first read the same finalCheck and flipped with it.",
    killedBy: 'the chain verdict follows the final check',
  },
  'chain-cost': {
    computes: 'the per-fold group-operation counts measured by running the real foldPublic over instrumented points',
    file: 'src/nifs/cost.ts',
    mutation: 'CountingPoint.multiply(): `this.tally.ops += 1` -> `this.tally.ops += 0`, so scalar multiplications stop being counted',
    baseline:
      "PASS: '✓  11 e2e/verdicts.spec.ts:146:1 › the chain cost verdict reports a measurement, not a constant (776ms)' in a run reporting '15 passed (18.9s)'",
    failure:
      "e2e/verdicts.spec.ts:156 toBe failed comparing the rendered chain-ops to a count made by this spec's own stand-in for foldPublic's points: expected \"6\", received \"3\". Run: 1 failed / 14 passed.",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'final-opening': {
    computes: "whether the printed W' and E' reopen the verifier's accumulated commitments, and whether the opened instance satisfies the constraints",
    file: 'src/nifs/verify.ts',
    mutation: 'foldPublic(): `commitmentW: left.commitmentW.add(right.commitmentW.multiply(r))` -> `.multiply(mod(r + 1n))`, breaking the witness-commitment homomorphism only',
    baseline:
      "PASS: '✓  13 e2e/verdicts.spec.ts:161:1 › the final opening verdict follows the commitment check (516ms)' in a run reporting '15 passed (11.1s)'",
    failure:
      "e2e/verdicts.spec.ts:161 toContainText failed on locator('[data-verdict=\"final-opening\"]'): expected \"VALID — AND NOTHING HIDDEN\", received \"OPENING REJECTED · the printed values do not reproduce the verifier’s commitments\". Run: 4 failed / 11 passed.",
    killedBy: 'the final opening verdict follows the commitment check',
  },
  'attack-witness': {
    computes: 'finalCheck of a witness altered after the fold, against the original commitments',
    file: 'src/open/final-check.ts',
    mutation: 'finalCheck(): `valid: constraintValid && ...` -> `valid: true`, so the altered witness opens successfully',
    baseline:
      "PASS: '✓  15 e2e/verdicts.spec.ts:175:1 › each attack verdict follows its own verifier result (587ms)' in a run reporting '15 passed (10.9s)'",
    failure:
      "e2e/verdicts.spec.ts:175 toContainText failed on locator('[data-verdict=\"attack-witness\"]'): expected \"FINAL CHECK FAILED\", received \"TAMPER ACCEPTED · the altered witness opened against the original commitment\". Run: 2 failed / 13 passed; chain and final-opening stayed green, so the mutation reached only this verdict.",
    killedBy: 'each attack verdict follows its own verifier result',
  },
  'attack-commitment': {
    computes: 'verifyChallenge() after Com(T) is substituted post-transcript',
    file: 'src/ui/app.ts',
    mutation: "attack handler: `tamperCommitment(honest.proof.commitmentT)` -> `honest.proof.commitmentT`, so nothing is actually tampered",
    baseline:
      "PASS: '✓  15 e2e/verdicts.spec.ts:175:1 › each attack verdict follows its own verifier result (426ms)' in a run reporting '15 passed (11.0s)'",
    failure:
      "e2e/verdicts.spec.ts:175 toContainText failed on locator('[data-verdict=\"attack-commitment\"]'): expected \"TRANSCRIPT CHECK FAILED\", received \"TAMPERED Com(T) ACCEPTED · the transcript did not bind Com(T) to r\". Run: 2 failed / 13 passed.",
    killedBy: 'each attack verdict follows its own verifier result',
  },
  'attack-r-first': {
    computes: 'whether the hidden step really was unsatisfying AND the forged opening really passed finalCheck',
    file: 'src/attack/r-first.ts',
    mutation: 'forgeAfterChallenge(): `const folded = { ...shell, E: targetE }` -> `const folded = { ...shell }`, so the forged error vector is not installed and the forgery fails',
    baseline:
      "PASS: '✓  15 e2e/verdicts.spec.ts:175:1 › each attack verdict follows its own verifier result (427ms)' in a run reporting '15 passed (8.2s)'",
    failure:
      "e2e/verdicts.spec.ts:175 toContainText failed on locator('[data-verdict=\"attack-r-first\"]'): expected \"ACCEPTED — AND FORGED\", received \"FORGERY REFUSED · the forged opening did not pass the final check\". Run: 2 failed / 13 passed.",
    killedBy: 'each attack verdict follows its own verifier result',
  },
}
