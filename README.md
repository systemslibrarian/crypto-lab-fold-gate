# Fold Gate

An inspectable browser lab for Nova's non-interactive folding scheme, relaxed R1CS, and homomorphic Pedersen commitments over ristretto255.

[Live demo](https://systemslibrarian.github.io/crypto-lab-fold-gate/) · [Nova paper](https://eprint.iacr.org/2021/370) · [MIT license](LICENSE)

## What It Is

Fold Gate shows why a random linear combination of two satisfying quadratic constraint systems is not generally satisfying, then computes the exact cross term that Nova's relaxed R1CS absorbs. It implements a two-row R1CS for $y = x^3 + 3$, Nova's NIFS cross term, SHA-512 Fiat-Shamir transcripts, and homomorphic Pedersen vector commitments over ristretto255 using generators derived by RFC 9380 hash-to-group.

The arithmetic and group operations are real. The lab deliberately uses one curve instead of Nova's curve cycle and opens the final folded witness instead of proving it recursively. It is not production crypto, an audited prover, a recursive SNARK, or a zero-knowledge system.

## Exhibits

1. **Fold walkthrough** starts with two satisfying R1CS instances, demonstrates the failed plain combination, reveals $T$, derives $r$, and shows $E' = E_1 + rT + r^2E_2$ restoring satisfaction.
2. **Verifier lane** exposes only $u$, public inputs, and commitments to $E$, $W$, and $T$. Private witness and error vectors do not cross the NIFS verifier boundary.
3. **Multi-step fold** executes and folds 2, 4, 8, 16, 32, or 64 real $x^3 + 3$ steps while the displayed group-operation count per fold stays fixed.
4. **Final opening** checks the folded constraints and both commitments, then demonstrates that this NIFS alone is neither zero-knowledge nor a succinct final proof.
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
npm test               # 13 unit/property tests
npm run test:coverage  # V8 statement/branch/function/line coverage
npm run build          # strict TypeScript + Vite production build
npm run test:a11y      # 8 production-browser accessibility and claims tests
```

The 13 unit tests cover exact cross-term absorption, 64 deterministic field samples, repeated folds, malformed vectors, commitment homomorphism, generator derivation, transcript binding, verifier isolation, final opening, tampering, and the challenge-first forgery. Coverage is gated at 95% statements/lines, 85% branches, and 85% functions across the cryptographic modules. The 8 Playwright tests independently recompute displayed R1CS claims with `BigInt`, compare the rendered folded error commitment, exercise verdict retirement and its no-op guard, prove the negative claim, check real UI states with axe, compute text and control contrast, and check mobile overflow.

**KAT count: 0.** The supplied Nova construction does not publish a standardized NIFS known-answer vector for this toy R1CS. The lab does not invent one; it uses algebraic property tests, independent browser re-derivation, and deterministic RFC 9380 generator checks instead.

The accessibility gate runs against `vite preview` on the committed unique port `4695`. It is a real-state gate with reduced-motion emulation, axe A/AA plus incomplete-result rejection, arithmetic contrast oracles, and a `[hidden]` paint probe.

## Performance

The verifier performs a fixed five group operations per fold in this teaching construction. The final check commits and opens one step-width witness plus the error vector; its cost does not grow with the number of folded steps, but it is not a succinct proof. No comparison with production Nova implementations is claimed.

## References

- Kothapalli, Setty, and Tzialla, [Nova: Recursive Zero-Knowledge Arguments from Folding Schemes](https://eprint.iacr.org/2021/370), CRYPTO 2022.
- Valiant, [Incrementally Verifiable Computation or Proofs of Knowledge Imply Time/Space Efficiency](https://doi.org/10.1007/978-3-540-92600-6_1), TCC 2008.
- Pedersen, [Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing](https://doi.org/10.1007/3-540-46766-1_9), CRYPTO 1991.
- [RFC 9380: Hashing to Elliptic Curves](https://www.rfc-editor.org/rfc/rfc9380).

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*