/**
 * One record per rendered marker: `data-verdict="<id>"` below in VERDICT_MUTATIONS, and
 * `data-claim="<id>"` in CLAIM_MUTATIONS. A decision and a measurement are held to the same rule,
 * because a number painted with no mutation behind it is exactly as unchecked as a verdict word
 * would be, and it is the easier one to ship, since a number does not look like a claim.
 *
 * A marker earns a record only after the mutation below was actually applied, the suite was run
 * with `CI=1` so no stale preview server could be reused, the unmutated baseline was observed
 * PASSING in the same session, and the mutated run failed on THAT marker's own assertion rather
 * than on a build error, a blank page, or the whole suite going red. `baseline` and `failure`
 * are verbatim reporter lines from those runs.
 *
 * e2e/verdicts.spec.ts walks every option of every control that changes what renders, and fails if
 * any marker of either family has no record here, if any record names a marker the page no longer
 * renders, or if a record's `killedBy` test does not assert that marker through
 * expectVerdict(page, '<id>', …) / expectClaim(page, '<id>', …). A mention is not an assertion, and
 * a text-only assertion is not a kill: a marker's words, its data-result and its styling are ONE
 * claim, and the mutation has to flip all of it.
 *
 * Those four rules were themselves mutated, because a rule nobody has watched fail is a shape:
 *
 * - Flip ONLY `data-result` on the chain verdict, leaving its words and its styling correct.
 *   `chain says "FOLDED 8 → 1, VALID · constraints and both accumulated commitments agree" but its
 *   data-result disagrees | Expected: "pass" | Received: "fail"`. A text-only assertion passes this
 *   page. That is the gap this file's helper closes.
 * - Route one kill around the helper (`expectVerdict(page, ('chain'), …)`). Coverage fails:
 *   `chain's kill is validated somewhere other than expectVerdict(page, 'chain', …)`.
 * - Ship a measurement marker with no record. Coverage fails, naming `smuggled-measurement`.
 * - Paint `${count} folds` in the chain stats with no marker around it. The outside-marker rule
 *   fails with all six step counts listed: `"<strong class=\"\"> 2 folds"` … `"64 folds"`.
 *
 * And the walk itself is load-bearing, which is the one that cannot be fixed by writing the rules
 * more carefully. A marker rendered only at 64 steps fails coverage as `only-at-64`; the SAME page
 * mutation with driveEveryState narrowed to `[8]` reports **14 passed**. A coverage rule applied to
 * a set that was never fully walked is silent, not wrong.
 */
export interface VerdictMutation {
  /** What the marker reads, in one line. */
  computes: string
  /** File the mutation was applied to. */
  file: string
  /** The edit, precisely enough to redo it. */
  mutation: string
  /** Verbatim reporter line for the unmutated run, same session. */
  baseline: string
  /** Verbatim failure of this marker's own assertion under the mutation. */
  failure: string
  /** Test title, in verdicts.spec.ts or claims.spec.ts, that owns this marker. */
  killedBy: string
}

export const VERDICT_MUTATIONS: Record<string, VerdictMutation> = {
  'plain-fold': {
    computes: 'residual() of the folded instance with E zeroed out, i.e. the plain random combination',
    file: 'src/ui/app.ts',
    mutation: "template(): `const plain = { ...result.folded, E: [0n, 0n] }` -> `const plain = { ...result.folded }`, so the plain fold keeps E' and becomes satisfying",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:152:1 › the walkthrough verdicts follow the residuals they print — plain-fold does not say what it is expected to say | Expected substring: \"NOT SATISFIED\" | Received string: \"SATISFIED · no cross term left over\" ;; plain-fold does not say what it is expected to say | Expected substring: \"cross term remains\" | Received string: \"SATISFIED · no cross term left over\" ;; plain-fold says \"SATISFIED · no cross term left over\" but its data-result disagrees | Expected: \"fail\" | Received: \"pass\" ;; plain-fold says \"SATISFIED · no cross term left over\" but its styling disagrees | Expected pattern: /(?:^| )verdict-bad(?: |$)/ | Received string: \"verdict verdict-good\". Run: 2 failed, 12 passed (19.4s).",
    killedBy: 'the walkthrough verdicts follow the residuals they print',
  },
  'relaxed-fold': {
    computes: "residual() of the relaxed folded instance, which is zero only if E' absorbed r*T",
    file: 'src/ui/app.ts',
    mutation: 'template(): `const relaxedResidual = residual(result.folded)` -> `residual(plain)`, pointing the verdict at the unrelaxed combination',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:152:1 › the walkthrough verdicts follow the residuals they print — relaxed-fold does not say what it is expected to say | Expected substring: \"E′ absorbed exactly r · T\" | Received string: \"NOT SATISFIED · E′ did not absorb r · T\" ;; relaxed-fold says \"NOT SATISFIED · E′ did not absorb r · T\" but its data-result disagrees | Expected: \"pass\" | Received: \"fail\" ;; relaxed-fold says \"NOT SATISFIED · E′ did not absorb r · T\" but its styling disagrees | Expected pattern: /(?:^| )verdict-good(?: |$)/ | Received string: \"verdict verdict-bad\" ;; relaxed-fold says SATISFIED, so its residual must be zero | Expected: \"[0, 0]\" | Received: \"[5282759575807222947374653023385687205896353720872484347354863783219398920442, 794289143989249561756638348484839236988894249207852401474291791108521188149]\". Run: 2 failed, 12 passed (11.7s).",
    killedBy: 'the walkthrough verdicts follow the residuals they print',
  },
  chain: {
    computes: 'finalCheck of the opened witness against the commitments the verifier accumulated with foldPublic',
    file: 'src/open/final-check.ts',
    mutation: 'finalCheck(): `valid: constraintValid && ...` -> `valid: false && constraintValid && ...`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:164:1 › the chain verdict follows the final check — chain does not say what it is expected to say | Expected substring: \"FOLDED 8 → 1, VALID\" | Received string: \"FOLDED 8 → 1, INVALID · the composite final check did not pass\" ;; chain does not say what it is expected to say | Expected substring: \"constraints and both accumulated commitments agree\" | Received string: \"FOLDED 8 → 1, INVALID · the composite final check did not pass\" ;; chain says \"FOLDED 8 → 1, INVALID · the composite final check did not pass\" but its data-result disagrees | Expected: \"pass\" | Received: \"fail\" ;; chain says \"FOLDED 8 → 1, INVALID · the composite final check did not pass\" but its styling disagrees | Expected pattern: /(?:^| )verdict-good(?: |$)/ | Received string: \"chain-verdict verdict verdict-bad\". Run: 4 failed, 10 passed (16.2s).",
    killedBy: 'the chain verdict follows the final check',
  },
  'chain-cost': {
    computes: 'the per-fold group-operation counts measured by running the real foldPublic over instrumented points',
    file: 'src/nifs/cost.ts',
    mutation: 'CountingPoint.multiply(): `this.tally.ops += 1` -> `this.tally.ops += 0`, so scalar multiplications stop being counted',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — chain-cost does not say what it is expected to say | Expected substring: \"PER-FOLD VERIFIER COST CONSTANT AT 6\" | Received string: \"PER-FOLD VERIFIER COST CONSTANT AT 3 · measured across 7 folds · 21 group operations in total, plus one final check\" ;; chain-cost does not say what it is expected to say | Expected substring: \"PER-FOLD VERIFIER COST CONSTANT AT 6\" | Received string: \"PER-FOLD VERIFIER COST CONSTANT AT 3 · measured across 63 folds · 189 group operations in total, plus one final check\". Run: 1 failed, 13 passed (9.2s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'final-opening': {
    computes: "whether the printed W' and E' reopen the verifier's accumulated commitments, and whether the opened instance satisfies the constraints",
    file: 'src/nifs/verify.ts',
    mutation: 'foldPublic(): `commitmentW: left.commitmentW.add(right.commitmentW.multiply(r))` -> `.multiply(mod(r + 1n))`, breaking the witness-commitment homomorphism only',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:199:1 › the final opening verdict follows the commitment check — final-opening does not say what it is expected to say | Expected substring: \"VALID — AND NOTHING HIDDEN\" | Received string: \"OPENING REJECTED · the printed values do not reproduce the verifier’s commitments\" ;; final-opening does not say what it is expected to say | Expected substring: \"the printed values alone reopen both commitments\" | Received string: \"OPENING REJECTED · the printed values do not reproduce the verifier’s commitments\" ;; final-opening says \"OPENING REJECTED · the printed values do not reproduce the verifier’s commitments\" but its data-result disagrees | Expected: \"caution\" | Received: \"fail\" ;; final-opening says \"OPENING REJECTED · the printed values do not reproduce the verifier’s commitments\" but its styling disagrees | Expected pattern: /(?:^| )verdict-warning(?: |$)/ | Received string: \"verdict verdict-bad\". Run: 3 failed, 11 passed (13.8s).",
    killedBy: 'the final opening verdict follows the commitment check',
  },
  'attack-witness': {
    computes: 'finalCheck of a witness altered after the fold, against the original commitments',
    file: 'src/open/final-check.ts',
    mutation: 'finalCheck(): `valid: constraintValid && ...` -> `valid: true`, so the altered witness opens successfully',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:209:1 › each attack verdict follows its own verifier result — attack-witness does not say what it is expected to say | Expected substring: \"FINAL CHECK FAILED\" | Received string: \"TAMPER ACCEPTED · the altered witness opened against the original commitment\" ;; attack-witness does not say what it is expected to say | Expected substring: \"the relaxed constraints and the witness commitment disagree\" | Received string: \"TAMPER ACCEPTED · the altered witness opened against the original commitment\" ;; attack-witness says \"TAMPER ACCEPTED · the altered witness opened against the original commitment\" but its data-result disagrees | Expected: \"pass\" | Received: \"fail\" ;; attack-witness says \"TAMPER ACCEPTED · the altered witness opened against the original commitment\" but its styling disagrees | Expected pattern: /(?:^| )verdict-good(?: |$)/ | Received string: \"verdict verdict-alarm\". Run: 2 failed, 12 passed (18.2s).",
    killedBy: 'each attack verdict follows its own verifier result',
  },
  'attack-commitment': {
    computes: 'verifyChallenge() after Com(T) is substituted post-transcript',
    file: 'src/ui/app.ts',
    mutation: 'attack handler: `tamperCommitment(honest.proof.commitmentT)` -> `honest.proof.commitmentT`, so nothing is actually tampered',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:209:1 › each attack verdict follows its own verifier result — attack-commitment does not say what it is expected to say | Expected substring: \"TRANSCRIPT CHECK FAILED\" | Received string: \"TAMPERED Com(T) ACCEPTED · the transcript did not bind Com(T) to r\" ;; attack-commitment does not say what it is expected to say | Expected substring: \"Com(T) changed after r\" | Received string: \"TAMPERED Com(T) ACCEPTED · the transcript did not bind Com(T) to r\" ;; attack-commitment says \"TAMPERED Com(T) ACCEPTED · the transcript did not bind Com(T) to r\" but its data-result disagrees | Expected: \"pass\" | Received: \"fail\" ;; attack-commitment says \"TAMPERED Com(T) ACCEPTED · the transcript did not bind Com(T) to r\" but its styling disagrees | Expected pattern: /(?:^| )verdict-good(?: |$)/ | Received string: \"verdict verdict-alarm\". Run: 2 failed, 12 passed (13.3s).",
    killedBy: 'each attack verdict follows its own verifier result',
  },
  'attack-r-first': {
    computes: 'whether the hidden step really was unsatisfying AND the forged opening really passed finalCheck',
    file: 'src/attack/r-first.ts',
    mutation: 'forgeAfterChallenge(): `const folded = { ...shell, E: targetE }` -> `const folded = { ...shell }`, so the forged error vector is not installed and the forgery fails',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (26.8s)'.",
    failure:
      "e2e/verdicts.spec.ts:209:1 › each attack verdict follows its own verifier result — attack-r-first does not say what it is expected to say | Expected substring: \"ACCEPTED — AND FORGED\" | Received string: \"FORGERY REFUSED · the forged opening did not pass the final check\" ;; attack-r-first does not say what it is expected to say | Expected substring: \"an unsatisfying step passed the final check\" | Received string: \"FORGERY REFUSED · the forged opening did not pass the final check\" ;; attack-r-first says \"FORGERY REFUSED · the forged opening did not pass the final check\" but its data-result disagrees | Expected: \"fail\" | Received: \"pass\" ;; attack-r-first says \"FORGERY REFUSED · the forged opening did not pass the final check\" but its styling disagrees | Expected pattern: /(?:^| )verdict-alarm(?: |$)/ | Received string: \"verdict verdict-good\". Run: 1 failed, 13 passed (7.9s).",
    killedBy: 'each attack verdict follows its own verifier result',
  },
}

export const CLAIM_MUTATIONS: Record<string, VerdictMutation> = {
  A: {
    computes: 'the R1CS A matrix: row one and row two both take x on the left of their product',
    file: 'src/ui/app.ts',
    mutation: "template(): the A disclosure renders `JSON.stringify(A, …)` -> `JSON.stringify(B, …)` in its data-value",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — A: row one takes x on the left of both products | Expected: \"[[\\\"0\\\",\\\"1\\\",\\\"0\\\",\\\"0\\\"],[\\\"0\\\",\\\"1\\\",\\\"0\\\",\\\"0\\\"]]\" | Received: \"[[\\\"0\\\",\\\"1\\\",\\\"0\\\",\\\"0\\\"],[\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"1\\\"]]\". Run: 1 failed, 13 passed (7.1s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  B: {
    computes: 'the R1CS B matrix: row one squares x, row two multiplies by the private witness',
    file: 'src/ui/app.ts',
    mutation: "template(): the B disclosure renders `JSON.stringify(B, …)` -> `JSON.stringify(C, …)` in its data-value",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — B: row one squares x; row two multiplies by the witness x² | Expected: \"[[\\\"0\\\",\\\"1\\\",\\\"0\\\",\\\"0\\\"],[\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"1\\\"]]\" | Received: \"[[\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"1\\\"],[\\\"-3\\\",\\\"0\\\",\\\"1\\\",\\\"0\\\"]]\". Run: 1 failed, 13 passed (9.2s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  C: {
    computes: 'the R1CS C matrix: row one outputs x², row two outputs y − 3u',
    file: 'src/ui/app.ts',
    mutation: "template(): the C disclosure renders `JSON.stringify(C, …)` -> `JSON.stringify(A, …)` in its data-value",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — C: row one outputs x²; row two outputs y − 3u | Expected: \"[[\\\"0\\\",\\\"0\\\",\\\"0\\\",\\\"1\\\"],[\\\"-3\\\",\\\"0\\\",\\\"1\\\",\\\"0\\\"]]\" | Received: \"[[\\\"0\\\",\\\"1\\\",\\\"0\\\",\\\"0\\\"],[\\\"0\\\",\\\"1\\\",\\\"0\\\",\\\"0\\\"]]\". Run: 1 failed, 13 passed (14.8s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  x1: {
    computes: 'the public inputs of instance 1, the step x = 2',
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('x₁', left.x, 'x1')` -> `valueRow('x₁', right.x, 'x1')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — x1: instance 1 is the step x = 2, so y = 2³ + 3 | Expected: \"[2, 11]\" | Received: \"[5, 128]\". Run: 1 failed, 13 passed (12.6s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  W1: {
    computes: 'the private witness of instance 1, x² = 4',
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('W₁', left.W, 'W1')` -> `valueRow('W₁', right.W, 'W1')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — W1: the private witness of instance 1 is x² = 4 | Expected: \"[4]\" | Received: \"[25]\". Run: 1 failed, 13 passed (9.2s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  x2: {
    computes: 'the public inputs of instance 2, the step x = 5',
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('x₂', right.x, 'x2')` -> `valueRow('x₂', left.x, 'x2')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — x2: instance 2 is the step x = 5, so y = 5³ + 3 | Expected: \"[5, 128]\" | Received: \"[2, 11]\". Run: 1 failed, 13 passed (8.3s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  W2: {
    computes: 'the private witness of instance 2, x² = 25',
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('W₂', right.W, 'W2')` -> `valueRow('W₂', left.W, 'W2')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — W2: the private witness of instance 2 is x² = 25 | Expected: \"[25]\" | Received: \"[4]\". Run: 1 failed, 13 passed (7.2s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  'final-open-shape': {
    computes: 'the size of the one opening the whole chain ends in: one W coordinate and one E per constraint row',
    file: 'src/ui/app.ts',
    mutation: 'template(): the FINAL OPEN meter renders `${step(1n).E.length}E` -> `${step(1n).W.length}E`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.5s)'.",
    failure:
      "e2e/claims.spec.ts:42:1 › the rendered instances are the R1CS this lab describes — final-open-shape: the final open is one W coordinate and one E per constraint row | Expected: \"1W+2E\" | Received: \"1W+1E\". Run: 1 failed, 13 passed (7.5s).",
    killedBy: 'the rendered instances are the R1CS this lab describes',
  },
  T: {
    computes: 'the Nova cross term A z₁ ∘ B z₂ + A z₂ ∘ B z₁ − u₁ C z₂ − u₂ C z₁',
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('T', result.proof.T, 'T')` -> `valueRow('T', expectedResidual, 'T')`, so the correction renders as r · T instead of T",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:60:1 › rendered T exactly matches the cross term, and r follows from it — T: the cross term A z₁ ∘ B z₂ + A z₂ ∘ B z₁ − u₁ C z₂ − u₂ C z₁, recomputed here | Expected: \"[7237005577332262213973186563042994240857116359379907606001950938285454250980, 7237005577332262213973186563042994240857116359379907606001950938285454250926]\" | Received: \"[5282759575807222947374653023385687205896353720872484347354863783219398920442, 794289143989249561756638348484839236988894249207852401474291791108521188149]\". Run: 1 failed, 13 passed (7.2s).",
    killedBy: 'rendered T exactly matches the cross term, and r follows from it',
  },
  r: {
    computes: 'the SHA-512 Fiat-Shamir challenge the transcript derived',
    file: 'src/ui/app.ts',
    mutation: 'template(): the challenge stamp renders `data-value="${result.proof.challenge}"` -> `data-value="${mod(result.proof.challenge + 1n)}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:60:1 › rendered T exactly matches the cross term, and r follows from it — r: the challenge the printed plain residual implies, given the recomputed T | Expected: \"1825361906243284854949434073971477279630555039696359830072332114626329314725\" | Received: \"1825361906243284854949434073971477279630555039696359830072332114626329314726\". Run: 2 failed, 12 passed (7.8s).",
    killedBy: 'rendered T exactly matches the cross term, and r follows from it',
  },
  'plain-residual': {
    computes: 'what the plain random combination leaves behind, which must be exactly r · T',
    file: 'src/ui/app.ts',
    mutation: 'template(): the plain-residual code renders `data-value="${full(plainResidual)}"` -> `data-value="${full(relaxedResidual)}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:60:1 › rendered T exactly matches the cross term, and r follows from it — plain-residual: the plain combination leaves exactly r · T behind | Expected: \"[5282759575807222947374653023385687205896353720872484347354863783219398920442, 794289143989249561756638348484839236988894249207852401474291791108521188149]\" | Received: \"[0, 0]\". Run: 2 failed, 12 passed (8.6s).",
    killedBy: 'rendered T exactly matches the cross term, and r follows from it',
  },
  'expected-residual': {
    computes: 'r · T, the value the equation line claims the plain residual equals',
    file: 'src/ui/app.ts',
    mutation: 'template(): `const expectedResidual = scale(result.proof.T, result.proof.challenge)` -> `scale(result.proof.T, mod(result.proof.challenge + 1n))`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:60:1 › rendered T exactly matches the cross term, and r follows from it — expected-residual: the equation beside it must print the same r · T | Expected: \"[5282759575807222947374653023385687205896353720872484347354863783219398920442, 794289143989249561756638348484839236988894249207852401474291791108521188149]\" | Received: \"[5282759575807222947374653023385687205896353720872484347354863783219398920433, 794289143989249561756638348484839236988894249207852401474291791108521188086]\". Run: 1 failed, 13 passed (10.6s).",
    killedBy: 'rendered T exactly matches the cross term, and r follows from it',
  },
  ufold: {
    computes: "the folded relaxation scalar u′ = u₁ + r·u₂",
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('u′', result.folded.u, 'ufold')` -> `valueRow('u′', left.u, 'ufold')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:79:1 › the folded instance is the linear combination the page claims — ufold: u′ = u₁ + r·u₂ | Expected: \"[1825361906243284854949434073971477279630555039696359830072332114626329314726]\" | Received: \"[1]\". Run: 1 failed, 13 passed (9.3s).",
    killedBy: 'the folded instance is the linear combination the page claims',
  },
  xfold: {
    computes: "the folded public inputs x′ = x₁ + r·x₂",
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('x′', result.folded.x, 'xfold')` -> `valueRow('x′', left.x, 'xfold')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:79:1 › the folded instance is the linear combination the page claims — xfold: x′ = x₁ + r·x₂ | Expected: \"[1889803953884162060773983806814392157295658839101891544359709634846192322638, 2062145524508070586385591450973276085283321580977014857196080647035616253163]\" | Received: \"[2, 11]\". Run: 1 failed, 13 passed (7.3s).",
    killedBy: 'the folded instance is the linear combination the page claims',
  },
  Wfold: {
    computes: "the folded witness W′ = W₁ + r·W₂",
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('W′', result.folded.W, 'Wfold')` -> `valueRow('W′', left.W, 'Wfold')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:79:1 › the folded instance is the linear combination the page claims — Wfold: W′ = W₁ + r·W₂ | Expected: \"[2212014192088548089896732471028966545621177836129550115796597235945507362195]\" | Received: \"[4]\". Run: 1 failed, 13 passed (7.4s).",
    killedBy: 'the folded instance is the linear combination the page claims',
  },
  Efold: {
    computes: "the folded error vector E′ = E₁ + r·T + r²·E₂, which is r·T when both inputs are ordinary",
    file: 'src/ui/app.ts',
    mutation: "template(): `valueRow('E′', result.folded.E, 'Efold')` -> `valueRow('E′', left.E, 'Efold')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.2s)'.",
    failure:
      "e2e/claims.spec.ts:79:1 › the folded instance is the linear combination the page claims — Efold: E′ = E₁ + r·T + r²·E₂, and both inputs have E = 0 | Expected: \"[5282759575807222947374653023385687205896353720872484347354863783219398920442, 794289143989249561756638348484839236988894249207852401474291791108521188149]\" | Received: \"[0, 0]\". Run: 1 failed, 13 passed (7.0s).",
    killedBy: 'the folded instance is the linear combination the page claims',
  },
  'relaxed-residual': {
    computes: 'the residual of the relaxed folded instance, which is zero exactly when E′ absorbed r · T',
    file: 'src/ui/app.ts',
    mutation: 'template(): the relaxed-residual code renders `data-value="${full(relaxedResidual)}"` -> `data-value="${full(plainResidual)}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/claims.spec.ts:79:1 › the folded instance is the linear combination the page claims — relaxed-residual: the printed folded instance must satisfy the relaxed constraints | Expected: \"[0, 0]\" | Received: \"[5282759575807222947374653023385687205896353720872484347354863783219398920442, 794289143989249561756638348484839236988894249207852401474291791108521188149]\". Run: 2 failed, 12 passed (8.8s).",
    killedBy: 'the folded instance is the linear combination the page claims',
  },
  'pair-commitment-e': {
    computes: "Com(E′) as the verifier accumulated it homomorphically, without ever seeing E′",
    file: 'src/ui/app.ts',
    mutation: 'template(): the verifier lane renders `commitmentHex(result.publicFolded.commitmentE)` -> `commitmentHex(result.publicFolded.commitmentW)` in its data-value',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/claims.spec.ts:79:1 › the folded instance is the linear combination the page claims — pair-commitment-e: the accumulated Com(E′) must reopen from the printed E′ | Expected: \"a66b87bc543c54a4e5dd50274912b5e06d1c86a05ddc6b0a744c4a5c7291e64b\" | Received: \"06d02de06d5610384da4a4fd51fcbf98d2b21edb4ad296f92f92ac1029cb701d\". Run: 1 failed, 13 passed (7.8s).",
    killedBy: 'the folded instance is the linear combination the page claims',
  },
  'ops-per-fold': {
    computes: 'the group operations one real foldPublic costs, measured over instrumented points',
    file: 'src/ui/app.ts',
    mutation: 'template(): the verifier-lane meter renders `data-value="${pairOps}"` -> `data-value="${pairOps + 1}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — ops-per-fold: the verifier lane reports one measured fold | Expected: \"6\" | Received: \"7\". Run: 1 failed, 13 passed (8.1s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'meter-ops-per-fold': {
    computes: 'the same measured per-fold cost, as the PER FOLD work meter states it',
    file: 'src/ui/app.ts',
    mutation: 'template(): the PER FOLD meter renders `data-value="${pairOps}"` -> `data-value="${pairOps + 1}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — meter-ops-per-fold: the PER FOLD meter reports the same measured fold | Expected: \"6\" | Received: \"7\". Run: 1 failed, 13 passed (8.8s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'chain-ops': {
    computes: 'the distinct per-fold costs measured across the whole chain',
    file: 'src/ui/app.ts',
    mutation: 'run handler: the GROUP OPS / FOLD stat renders `data-value="${chain.cost.distinct.join(\',\')}"` -> `data-value="${chain.cost.total}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — chain-ops: the distinct per-fold costs this suite measured for itself | Expected: \"6\" | Received: \"42\" ;; chain-ops: the distinct per-fold costs this suite measured for itself | Expected: \"6\" | Received: \"378\". Run: 1 failed, 13 passed (8.4s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'chain-total-ops': {
    computes: 'the sum of every per-fold measurement in the chain, not one count multiplied out',
    file: 'src/ui/app.ts',
    mutation: 'foldChain(): `perFoldOps.push(verifierGroupOps(…))` -> `perFoldOps.push(verifierGroupOps(…) - (index === 2 ? 1 : 0))`, so the FIRST FOLD ALONE tallies one less. It is the only mutation in either set that can tell a summed total from a multiplied one; every other one moves all folds at once.',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — chain-total-ops: 7 measured per-fold costs, summed — never one count multiplied out | Expected: \"42\" | Received: \"41\" ;; chain-total-ops: 63 measured per-fold costs, summed — never one count multiplied out | Expected: \"378\" | Received: \"377\". Run: 1 failed, 13 passed (8.4s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'steps-absorbed': {
    computes: 'the chain length that was actually folded',
    file: 'src/ui/app.ts',
    mutation: 'run handler: the STEPS ABSORBED stat renders `data-value="${count}"` -> `data-value="${count - 1}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — steps-absorbed: the stats grid reports the chain length that was run | Expected: \"8\" | Received: \"7\" ;; steps-absorbed: the stats grid reports the chain length that was run | Expected: \"64\" | Received: \"63\". Run: 1 failed, 13 passed (7.9s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'chain-retirement': {
    computes: 'the chain length the live status line announces after a run',
    file: 'src/ui/app.ts',
    mutation: 'run handler: `retirement.dataset.value = String(count)` -> `String(count + 1)`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (7.0s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — chain-retirement: the status line reports the chain length that was run | Expected: \"8\" | Received: \"9\" ;; chain-retirement: the status line reports the chain length that was run | Expected: \"64\" | Received: \"65\". Run: 1 failed, 13 passed (7.9s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'folded-w-length': {
    computes: 'the width of the witness after folding, which stays one step wide however long the chain',
    file: 'src/ui/app.ts',
    mutation: 'run handler: the FOLDED W LENGTH stat renders `data-value="${chain.folded.W.length}"` -> `data-value="${count}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — folded-w-length: however many steps fold, the final witness stays one step wide | Expected: \"1\" | Received: \"8\" ;; folded-w-length: however many steps fold, the final witness stays one step wide | Expected: \"1\" | Received: \"64\". Run: 1 failed, 13 passed (8.2s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'step-w-length': {
    computes: 'the width of one unfolded step, the yardstick the folded width is read against',
    file: 'src/ui/app.ts',
    mutation: 'run handler: the ONE-STEP W LENGTH stat renders `data-value="${step(1n).W.length}"` -> `data-value="${step(1n).x.length}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/verdicts.spec.ts:175:1 › the chain cost verdict reports a measurement, not a constant — step-w-length: one step of this R1CS has exactly one private coordinate, x² | Expected: \"1\" | Received: \"2\". Run: 1 failed, 13 passed (7.9s).",
    killedBy: 'the chain cost verdict reports a measurement, not a constant',
  },
  'opened-W': {
    computes: "the private witness the final opening prints, W′ = W₁ + r·W₂",
    file: 'src/ui/app.ts',
    mutation: "open handler: `valueRow('Private W′', latestChain.folded.W, 'opened-W')` -> `valueRow('Private W′', latestChain.folded.E, 'opened-W')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/claims.spec.ts:104:1 › the final opening reproduces the accumulated commitments — opened-W: W′ = W₁ + r·W₂ for the r that E′ implies | Expected: \"[4700925569186064238035565226862127591031431725139942615552443492865771527892]\" | Received: \"[521919307415703584718263681221363210419808061837491856377604070762889750369, 2609596537078517923591318406106816052099040309187459281888020353814448751845]\". Run: 1 failed, 13 passed (8.6s).",
    killedBy: 'the final opening reproduces the accumulated commitments',
  },
  'opened-E': {
    computes: "the error vector the final opening prints, which must reopen the accumulated Com(E′)",
    file: 'src/ui/app.ts',
    mutation: "open handler: `valueRow('Error E′', latestChain.folded.E, 'opened-E')` -> `valueRow('Error E′', latestChain.folded.W, 'opened-E')`",
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/claims.spec.ts:104:1 › the final opening reproduces the accumulated commitments — opened-E: E′ = r·T for the r that W′ implies | Expected: \"[521919307415703584718263681221363210419808061837491856377604070762889750369, 2609596537078517923591318406106816052099040309187459281888020353814448751845]\" | Received: \"[4700925569186064238035565226862127591031431725139942615552443492865771527892]\". Run: 1 failed, 13 passed (7.5s).",
    killedBy: 'the final opening reproduces the accumulated commitments',
  },
  'final-commitment-e': {
    computes: "Com(E′) accumulated across the whole chain, which the printed E′ alone has to reopen",
    file: 'src/ui/app.ts',
    mutation: 'foldChain(): `finalCommitmentE: commitmentHex(publicFolded.commitmentE)` -> `commitmentHex(publicFolded.commitmentW)`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/claims.spec.ts:104:1 › the final opening reproduces the accumulated commitments — final-commitment-e: the verifier's accumulated Com(E′) must reopen from the printed E′ alone | Expected: \"dea80c6fe06e1152517fc592c8f06e9ae17de6ac002c430292fe62bf0236d67f\" | Received: \"049fad5fd004d4dcc1d158857f58598cf0c85916c8b291dd511cfa9985fe8217\". Run: 1 failed, 13 passed (6.5s).",
    killedBy: 'the final opening reproduces the accumulated commitments',
  },
  'open-length': {
    computes: 'how many field elements the final opening reveals in total',
    file: 'src/ui/app.ts',
    mutation: 'open handler: `data-claim="open-length" data-value="${openLength}"` -> `data-value="${latestChain.folded.W.length}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/claims.spec.ts:104:1 › the final opening reproduces the accumulated commitments — open-length: the opening is exactly the values it printed | Expected: \"3\" | Received: \"1\". Run: 1 failed, 13 passed (6.7s).",
    killedBy: 'the final opening reproduces the accumulated commitments',
  },
  'folded-e-length': {
    computes: 'how many error coordinates the opening reveals, one per constraint row',
    file: 'src/ui/app.ts',
    mutation: 'open handler: `data-claim="folded-e-length" data-value="${latestChain.folded.E.length}"` -> `data-value="${latestChain.folded.W.length}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/claims.spec.ts:104:1 › the final opening reproduces the accumulated commitments — folded-e-length: one error coordinate per constraint row | Expected: \"2\" | Received: \"1\". Run: 1 failed, 13 passed (6.8s).",
    killedBy: 'the final opening reproduces the accumulated commitments',
  },
  'negative-claim': {
    computes: 'the negative claim, which names the opening it is drawn from',
    file: 'src/ui/app.ts',
    mutation: 'open handler: `reopen from the ${openLength} values printed above` -> `${openLength + 1}`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.5s)'.",
    failure:
      "e2e/claims.spec.ts:104:1 › the final opening reproduces the accumulated commitments — negative-claim: the negative claim must name the same opening it is drawn from | Expected substring: \"neither zero-knowledge nor succinct on its own: the verifier’s accumulated commitments reopen from the 3 values printed above\" | Received string: \"The NIFS built here is neither zero-knowledge nor succinct on its own: the verifier’s accumulated commitments reopen from the 4 values printed above, so nothing stays hidden, and the final step is that witness opening rather than a short proof.\". Run: 1 failed, 13 passed (7.5s).",
    killedBy: 'the final opening reproduces the accumulated commitments',
  },
  'hidden-residual': {
    computes: 'the residual of the step the broken mode hides, which must be nonzero or there is nothing to forge',
    file: 'src/ui/app.ts',
    mutation: 'attack handler: `<span data-claim="hidden-residual" data-value="${full(before)}">` -> `data-value="${full(forgery.forgedT)}"`',
    baseline:
      "Unmutated run in the same session, bracketing this mutation: '14 passed (6.9s)'.",
    failure:
      "e2e/claims.spec.ts:132:1 › each attack path names the real cause and the broken mode forges — hidden-residual: the forged step really has to be unsatisfying | Expected: \"[0, 7237005577332262213973186563042994240857116359379907606001950938285454250980]\" | Received: \"[7237005577332262213973186563042994240857116359379907606001950938285454250980, 7237005577332262213973186563042994240857116359379907606001950938285454250764]\". Run: 1 failed, 13 passed (6.6s).",
    killedBy: 'each attack path names the real cause and the broken mode forges',
  },
}
