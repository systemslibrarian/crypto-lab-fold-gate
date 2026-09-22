# Fold Gate

An inspectable browser lab for Nova's non-interactive folding scheme, relaxed R1CS, and homomorphic Pedersen commitments over ristretto255.

[Live demo](https://systemslibrarian.github.io/crypto-lab-fold-gate/) · [Nova paper](https://eprint.iacr.org/2021/370) · [MIT license](LICENSE)

## What It Is

Fold Gate shows why a random linear combination of two satisfying quadratic constraint systems is not generally satisfying, then computes the exact cross term that Nova's relaxed R1CS absorbs. It implements a two-row R1CS for $y = x^3 + 3$, Nova's NIFS cross term, SHA-512 Fiat-Shamir transcripts, and homomorphic Pedersen vector commitments over ristretto255 using generators derived by RFC 9380 hash-to-group.

The arithmetic and group operations are real. The lab deliberately uses one curve instead of Nova's curve cycle and opens the final folded witness instead of proving it recursively. It is not production crypto, an audited prover, a recursive SNARK, or a zero-knowledge system.

## Exhibits

1. **Fold walkthrough** starts with two satisfying R1CS instances, demonstrates the failed plain combination, reveals $T$, derives $r$, and shows $E' = E_1 + rT + r^2E_2$ restoring satisfaction.
2. **Verifier lane** exposes only $u$, public inputs, and commitments to $E$, $W$, and $T$. Private witness and error vectors do not cross the NIFS verifier boundary.
3. **Multi-step fold** executes and folds 2, 4, 8, 16, 32, or 64 real $x^3 + 3$ steps, measuring the verifier's group-operation cost at each individual fold and reporting the measured per-fold figure, whether it stayed constant across the chain, and what the whole chain cost.
4. **Final opening** recomputes the folded residual and re-derives $Com(W')$ and $Com(E')$ from the values it prints, against the commitments the verifier accumulated with `foldPublic` and never saw a witness for. Because those printed values alone reopen both commitments, nothing is withheld: this NIFS alone is neither zero-knowledge nor a succinct final proof.
5. **Break it yourself** catches witness tampering and post-transcript $T$ tampering, then demonstrates a successful forgery when a broken verifier reveals $r$ before $T$ is committed.
6. **Inspectable internals** publish the matrices, witness layout, transcript order, generator DST, edge-case policy, and extension boundaries.

## When to Use It

Use this lab to learn relaxed R1CS folding, review the algebra behind Nova NIFS, or test an explanation of commitment-first Fiat-Shamir ordering. It is also a compact reference for separating public verifier inputs from the witness opened by a final check.

Do **not** use this code to prove production computations, benchmark production provers, claim zero knowledge, or replace a recursive verifier circuit and compressing SNARK.

## Live Demo

Open [Fold Gate on GitHub Pages](https://systemslibrarian.github.io/crypto-lab-fold-gate/). Step through the failed plain fold, run up to 64 folds, open the result, and launch each tampering mode against the real implementation.

## What Can Go Wrong

- Revealing the Fiat-Shamir challenge before committing $T$ lets a dishonest prover solve backward for a correction that hides an unsatisfying step.
- Changing $W'$ after folding breaks both the witness commitment and the relaxed constraints.
- Changing $Com(T)$ after deriving $r$ changes the transcript challenge and is rejected.
- A zero challenge is rejected and re-derived under a domain-separated retry byte.
- Instances with $u = 0$, malformed vectors, and mismatched witness sizes fail closed.
- The UI caps histories at 64 steps; that cap is a teaching and responsiveness choice, not a cryptographic bound.

## Real-World Usage

Folding schemes are a foundation for incrementally verifiable computation and recursive proof systems. Nova combines a folding scheme with an augmented step circuit and later compression; production descendants and related systems add curve-cycle engineering, recursive verification, zero knowledge, and efficient final proofs. This lab isolates the NIFS mechanism rather than claiming those surrounding properties.

## How to Run Locally

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Vite prints the local URL. For the exact production bundle:

```bash
npm run build
npm run preview
```

## Related Demos

- [SNARK Arena](https://systemslibrarian.github.io/crypto-lab-snark-arena/) for proof-system tradeoffs and final compression context.
- [Polynomial Forge](https://systemslibrarian.github.io/crypto-lab-polynomial-forge/) for polynomial commitment mechanics.
- [STARK Tower](https://systemslibrarian.github.io/crypto-lab-stark-tower/) for a contrasting transparent proof architecture.

## Build & Verify

```bash
npm test               # 18 unit/property tests
npm run test:coverage  # V8 statement/branch/function/line coverage
npm run build          # strict TypeScript + Vite production build
npm run test:a11y      # 17 production-browser verdict, claims, and accessibility tests
```

The 18 unit tests cover exact cross-term absorption, 64 deterministic field samples, repeated folds, malformed vectors, commitment homomorphism, generator derivation, transcript binding, verifier isolation, final opening, tampering, the challenge-first forgery, and the verifier cost instrumentation. Coverage is gated at 95% statements/lines, 85% branches, and 85% functions across the cryptographic modules. The 19 Playwright tests independently recompute displayed R1CS claims with `BigInt`, compare the rendered folded error commitment against a re-commitment of the opened values, count the real `foldPublic` group operations with a stand-in written for the test alone, exercise verdict retirement and its no-op guard, check real UI states with axe, compute text and control contrast, and check mobile overflow.

**KAT count: 0.** The supplied Nova construction does not publish a standardized NIFS known-answer vector for this toy R1CS. The lab does not invent one; it uses algebraic property tests, independent browser re-derivation, and deterministic RFC 9380 generator checks instead.

The accessibility gate runs against `vite preview` on the committed unique port `4695`. It is a real-state gate with reduced-motion emulation, axe A/AA plus incomplete-result rejection, arithmetic contrast oracles, and a `[hidden]` paint probe.

## Every Rendered Verdict And Every Rendered Number Is Computed, And Proved So

Each outcome this lab paints carries a `data-verdict` marker and each measurement carries a
`data-claim` marker, and every one of them branches on a value the page computed — nothing is
printed unconditionally. `e2e/verdict-mutations.ts` records, per marker of either family, the
mutation that makes it go red, the verbatim passing baseline from the unmutated run, and the
verbatim failure. `e2e/verdicts.spec.ts` derives coverage from the rendered page rather than from
any list, and fails if a marker has no recorded mutation, if a recorded mutation names a marker
that no longer renders, or if verdict words, verdict styling, or a bare rendered number are
painted in a result region outside any marker. That job — `verdict-coverage` — is a required check
and `deploy` depends on it, so it blocks a direct push to `main` as well as a pull request.

Five things make that a real gate rather than a shape:

- **A marker's words, its `data-result` and its styling are ONE claim**, asserted together by
  `expectVerdict()` in `e2e/markers.ts` (or `expectClaim()` for a measurement), so a mutation that
  flips the sentence while the marker keeps saying pass in every way a reader can see is a build
  failure, not a recorded kill.
- **The record is held against what RAN, not against what the spec says.** Both helpers append the
  `(test title, marker)` pair they are executing to a run-scoped sink, cleared in `globalSetup`,
  and `e2e/coverage-replay.spec.ts` — a second Playwright project that `dependencies:` on the
  first, so the ordering is declared rather than incidental — fails unless every recorded
  mutation's pair turns up in it. This replaced a scan of the spec's source text, which a comment,
  a branch that never runs, and a call belonging to another test all satisfied: under the first of
  those, a live flip of the chain verdict's `data-result` shipped green, the page reading
  `FOLDED 8 → 1, VALID` while its machine-readable result said `fail`. The source scan is still
  run, because it names a mistyped marker id at the line it was typed, but nothing rests on it.
- **A marker's oracle may not be the marker.** An assertion handed the marker's own rendered value
  executes, names the right helper, and passes on every page including a mutated one — so neither
  rule above can see it. `oracleDependenceFailures()` in `e2e/coverage-rules.ts` follows each local
  variable back to where it was assigned and fails a record whose expectation traces to a read of
  its own marker. It is per marker rather than per test, which is what lets this lab's deliberate
  cross-derivations stand: `r`'s oracle is built from the rendered `plain-residual` and
  `plain-residual`'s from the rendered `r`, and each opened vector predicts the other's challenge.
- **A number is a claim too, and an easier one to ship unchecked**, because a number does not look
  like a claim. Marking the measurements found four numbers the page painted with nothing behind
  them, one of which — the FINAL OPEN meter — was a hand-written `1 W + 1 E` that disagreed with
  the page's own opened length of one W and two E.
- **The walk is the denominator.** `driveEveryState` visits every option of every control that
  changes what renders — all six step counts, not just the default — each control on its own
  rather than the cross-product. A marker that renders only at 64 steps is outside the set the
  coverage rules judge unless the walk reaches it, however carefully those rules are written.

Two things this replaced are worth naming. The chain, final-opening and three attack verdicts used
to be fixed strings: forcing `finalCheck` to return `valid: false` left every browser test green
and the page still read "FOLDED 8 → 1, VALID". And the final check compared `commit(W')` against a
commitment derived from that same `W'`, so its commitment half could not fail; the verifier now
accumulates $Com(W')$ and $Com(E')$ homomorphically through the chain and the final check compares
against those.

## Performance

The verifier performs **six** ristretto255 group operations per fold in this teaching construction — three scalar multiplications and three point additions — measured by running the real `foldPublic` over instrumented points, not asserted by a constant. Earlier versions of this file said five; that figure was hard-coded and wrong, and the page now renders the measurement.

Per-fold cost is what stays constant. Total verifier work is not: this lab builds the NIFS only, so the verifier performs every fold itself, and folding eight steps means seven folds — 42 group operations — plus one final check. Collapsing a whole chain into a single verifier step is IVC's property, which needs the augmented recursive circuit this lab deliberately does not build. The final check commits and opens one step-width witness plus the error vector; that cost does not grow with the number of folded steps, but it is not a succinct proof. No comparison with production Nova implementations is claimed.

## References

- Kothapalli, Setty, and Tzialla, [Nova: Recursive Zero-Knowledge Arguments from Folding Schemes](https://eprint.iacr.org/2021/370), CRYPTO 2022.
- Valiant, [Incrementally Verifiable Computation or Proofs of Knowledge Imply Time/Space Efficiency](https://doi.org/10.1007/978-3-540-92600-6_1), TCC 2008.
- Pedersen, [Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing](https://doi.org/10.1007/3-540-46766-1_9), CRYPTO 1991.
- [RFC 9380: Hashing to Elliptic Curves](https://www.rfc-editor.org/rfc/rfc9380).

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*