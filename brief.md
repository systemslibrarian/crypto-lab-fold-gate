# Fold Gate — build brief for `crypto-lab-fold-gate`

Save this file as `brief.md` at the root of `crypto-lab-fold-gate`. The binding spec is `audits/_MASTER-TEMPLATE.md` in the catalog repo (`crypto-lab`) — read it there, not from a copy. A working copy may sit untracked at this repo's root for convenience; it is a snapshot and ages, so it is never the authority. This brief supplies only the demo-specific facts. Where the two touch, the template wins; where the template and the catalog `CLAUDE.md` touch, `CLAUDE.md` wins. If `audits/kickoff.md` is also present in this repo, it may be used instead of the prompt below — it reads `./brief.md` itself.

## Kickoff prompt — paste this, with the template in the repo

```text
Build a new Crypto Lab browser demo (Vite + TypeScript, static site, no backend).

Read audits/_MASTER-TEMPLATE.md in the crypto-lab catalog repo in full and treat it
as the BINDING spec (an untracked copy at this repo's root is a convenience snapshot,
not the authority). Build to every standard in it, in this order:

  1. §1 Build — real crypto only (WebCrypto or a named, justified library; hand-roll
     the inspectable teaching parts; NEVER simulate or fake math). Runnable tests that
     actually pass, including spec KATs (state the count). Mount content at id="app";
     define --accent on :root.
  2. §3 Look — add the standard top bar (copy the header from any existing lab and
     adapt it) and the standardized hero (short-name <h1> + spec subtitle + "Why it
     matters" box beside it; title size capped at clamp(1.6rem,3.8vw,2.7rem)); theme
     contract; scripture footer; head/favicon. Do NOT invent a new header design and do
     NOT add a theme toggle — match the fleet's cl-topbar.
  3. §2 Teach — SHOW the one headline mechanism (animate/step it, never assert it in
     prose or raw hex); add a plain-language "what is this / why it matters" intro and a
     break-it-yourself interaction against the real crypto; no decorative/idle animation;
     pitch to a college newcomer while rewarding an expert (progressive disclosure).
  4. §4 Accessibility — wire the WCAG 2.1 AA gate and author to its checklist.
     `npm run build` then `npm run test:a11y` MUST pass with zero violations.
  5. §5 README (the standard sections) and §6 Deploy (Actions-based Pages, a11y-gated).
  6. §6.1 + §6.2 Dependency automation — REQUIRED, not optional. Ship
     .github/dependabot.yml with the grouped config, add the dependabot-auto-merge job
     to whichever workflow runs the gate on pull_request, and have that job dispatch the
     deploy after it merges. Also: the workflow must trigger on pull_request as well as
     push, the deploy job must be gated to `github.event_name != 'pull_request'`, the concurrency
     group must include ${{ github.ref }}, and the deploy workflow must accept
     workflow_dispatch. Omitting any of these is how a lab starts opening one pull request
     per dependency with no CI signal on any of them.

Hard rules: do NOT dumb down the crypto to make a visual simpler; honest scoping in-page
and in the README ("not production", what's real vs simulated, what it does NOT prove).
Do NOT weaken a gate to get a green run — no skipped tests, no lowered coverage threshold,
no disabled lint rule, no re-recorded a11y baseline, no continue-on-error. If a bump or a
change cannot pass honestly, leave it failing and say so.
When done, report a one-line summary with the test count, and confirm all four of
grouping / auto-merge / PR gate / workflow_dispatch are present.

The rest of ./brief.md — the §1 sections, hero copy, claims suite, negative claim,
pre-build verification and citations below the DEMO BRIEF — is part of this brief.
Read it in full before building; run its pre-build checks first and report them.

DEMO BRIEF:
NEW DEMO BRIEF
- Repo name:         crypto-lab-fold-gate
- Short name (H1):   Fold Gate
- Subtitle:          Folding schemes · Nova NIFS · relaxed R1CS
- One-liner:         Folds two relaxed R1CS instances into one with Nova's non-interactive folding scheme over ristretto255 Pedersen commitments, then keeps folding step after step and shows the single final check costing the same as checking one step.
- Concept to teach:  A random combination of two satisfying instances of a quadratic constraint system is not satisfying — until you relax the system with a slack scalar and an error vector that absorb the cross term. Then one folded instance is as convincing as all of them, and the number of folded steps never reaches the verifier's cost.
- Primitives/spec:   Kothapalli, Setty, Tzialla, "Nova: Recursive Zero-Knowledge Arguments from Folding Schemes", CRYPTO 2022 (ePrint 2021/370) — relaxed R1CS and the NIFS with cross term T; Pedersen vector commitments over ristretto255 (@noble/curves) with generators derived by RFC 9380 hash-to-group under a stated DST; Fiat–Shamir challenge from a SHA-512 transcript; the field is the ristretto255 scalar field (a single curve, labelled as a simplification of Nova's curve cycle).
- Accent (--accent): #5E7CE2
- Favicon emoji:     🔁
- In scope:          An R1CS for one step of a small function with at least one multiplication (x_{i+1} = x_i^3 + c or similar) with A, B, C shown; witness generation. A "why plain combination fails" panel: fold two satisfying non-relaxed instances and show the constraint violated with the residual displayed as exactly the cross term. Relaxed R1CS (E, u). NIFS prover: T, the commitments to E1, E2, W1, W2, T, the challenge r from the transcript, the folded (E', u', W', x'). NIFS verifier: folds commitments and public inputs only. Final check: open the folded witness and verify. Multi-step: fold 2 … 64 steps with a verifier-work meter per fold (constant) and a final-check meter. Break-it-yourself: tamper one step's witness → final check fails; tamper the commitment to T → fails; "choose r first" (BROKEN): the prover learns r before committing T, computes the E' it needs, sets T = (E' − E1 − r^2 E2)/r and commits that — the folded instance verifies with an unsatisfying step inside.
- Non-goals:         The recursive verifier circuit (the augmented step function that verifies a fold in-circuit); the curve cycle; the final compressing SNARK (cross-link SNARK Arena and Polynomial Forge); zero-knowledge blinding; HyperNova, ProtoStar, CycleFold; lookups; performance claims against production provers.
```

## Rules this brief follows — keep them while building

This brief asserts no counts about the catalog. Every "the catalog has / lacks X" sentence is written as a grep to run, because the author could not run it. Run each pre-build check and report the result before writing code. If a grep shows the headline mechanism is already taught by a live card, stop and report; do not build a duplicate.

In addition to this lab's own sections below:

1. Port: `grep -rhoE "localhost:[0-9]+" ../crypto-lab-*/playwright.config.ts | sort -u`, pick an unused port in 4600–4700, commit it (template §4.1). Never the Vite default 4173.
2. Accessibility gate: copy `e2e/gate.ts`, `contrast.ts`, `nontext.ts`, `nontext-baseline.ts`, `a11y.spec.ts` from `crypto-lab-schnorr-forge` and rewrite every lab-specific passage (§4.1). Do not copy the gate from any other lab.
3. Claims suite in `e2e/claims.spec.ts` (§4.1b), mutation discipline (§4.1c), and the negative claim with its evidence fixture (§4.1d). The twin-verdict wording in this brief is a shape, not a string to hard-code.
4. README per §5; deploy per §6 with `.github/dependabot.yml`, the auto-merge job, the deploy dispatch, `timeout-minutes` on the job, `LICENSE`, `.gitignore`.
5. After the lab is live: the catalog card, then the five checkers run from the catalog repo (`readme-sync`, `corpus-sync`, `concept-sync`, `theme-sync`, `fleet-sync`). That step is done in `crypto-lab/`, not here; do not edit shared catalog files from this repo.
6. Category placement below is a proposal. Check the live chip list and section list before adding a chip; if a proposed chip does not exist, report the resulting chip-bar split rather than creating it silently. If the catalog keeps a concept-coverage document, the new concept boundary is added there in the same commit as the card.
7. Each non-goal in the SCOPE list gets its one-line "what this isn't" note in the UI (§1).
8. No emoji anywhere in content; the favicon data-URI is the only sanctioned use.
9. Every hard citation below was checked against its primary source on 2026-09-10 except where marked "verify" — resolve those before the README cites them. Do not cite anything the README cannot link.

**Accent.** This lab's `--accent` is ``#5E7CE2``, assigned centrally for the seven-lab batch of 2026-09-10. The other six batch accents are reserved — do not use them:

| Lab | Repo | `--accent` |
|---|---|---|
| Hidden Bit | crypto-lab-hidden-bit | ``#E4572E`` |
| Privacy Pass | crypto-lab-privacy-pass | ``#F2C14E`` |
| Order Leak | crypto-lab-order-leak | ``#A06CD5`` |
| Split Point | crypto-lab-split-point | ``#4CC9F0`` |
| Proof Tally | crypto-lab-proof-tally | ``#7BE495`` |
| PQXDH Wire | crypto-lab-pqxdh-wire | ``#FF7EB6`` |

If `theme-sync` reports an adjacent-card collision after the card is placed, change this lab's accent, never the neighbour's, and record the change in the batch document.

## Hero

- Title: `Fold Gate`
- Subtitle: `Folding schemes · Nova NIFS · relaxed R1CS`
- Description: Slide two instance cards into one, watch the cross term appear between them and the challenge stamp them together, fold sixty-four times, and check once at a cost that never moved.
- Why it matters: Proving a long computation used to mean a proof per step or a circuit for the whole thing. Folding is why today's recursive proof systems can run a virtual machine one step at a time and still hand the verifier one small check — and the ordering of one hash is all that keeps the prover honest.

## §1 sections

**SCOPE** — as in the brief.

**SECURITY / CORRECTNESS INVARIANTS**
1. Fold correctness: for satisfying relaxed instances the folded instance satisfies relaxed R1CS (property test over random instances), and the non-relaxed fold fails with a residual equal to the computed cross term (test asserts exact equality).
2. Commitment homomorphism: Com(W1) + r·Com(W2) = Com(W1 + r·W2) and the same for E with T (test).
3. r is derived from the transcript over the two instances and the commitments to E1, E2, W1, W2, T in that order. "Choose r first" is BROKEN, never default, and carries its "what this isn't" line.
4. The verifier module never receives W or E; module boundary plus a test on its inputs. The final open lives in `src/open/` and says on screen that it holds the witness.
5. Pedersen generators are derived deterministically from the DST, distinct, and not the identity (test).
6. No standard KATs exist to cite unless found: search first; if none, say so on the page and in Build & Verify and rely on the property tests plus the independent re-derivation below. Do not invent a "test vector".

**ARCHITECTURE** — `src/r1cs/{matrices,witness,relaxed}.ts`, `src/commit/pedersen.ts`, `src/nifs/{prove,verify,transcript}.ts`, `src/open/final-check.ts`, `src/attack/{tamper,r-first}.ts`, `src/ui/`.

**UI** — Central metaphor: two instance cards sliding into one. The fold animation computes the cross-term card T, inserts it between the two, and stamps the challenge r on the stack; the verifier lane holds only small opaque commitment cards and never the large witness cards. A step counter folds again up to 64 while the verifier-cost meter stays flat; "Final check" opens the folded witness. Break-it: tamper witness, tamper T's commitment, r-first.

**VISUAL SEMANTICS** — The residual panel shows a red non-zero residual vector labelled "NOT SATISFIED (cross term)" for the plain fold and a neutral E' absorbing it for the relaxed fold. Final-check pass is green (correctness). A caught tamper is green "FINAL CHECK FAILED" with cause — integrity, not the return value. The r-first cheat passing the final check is ALARM "ACCEPTED — AND FORGED". Icon + text + colour.

**EDGE CASES** — an instance with u = 0 (explain the relaxed-R1CS degenerate case; refuse); folding an instance with itself (allowed; shown); r = 0 from the transcript (reject and re-derive with a domain-separated retry, stated); witness of the wrong length; commitment of the wrong size; more than 64 steps (UI cap, stated).

**EXTENSION SEAMS** — the recursive-verifier boundary (the augmented function's interface) marked; the compressing SNARK hand-off; blinding factors in Pedersen for zero knowledge.

## Claims suite and negative claim

`e2e/claims.spec.ts`: parse A, B, C, z1, z2, r and the displayed E', u', W' and recompute the relaxed R1CS check in the test with BigInt mod p — assert satisfied; parse z1, z2 and recompute T from its definition (Az1∘Bz2 + Az2∘Bz1 − u1·Cz2 − u2·Cz1) and assert equality with the displayed T; assert the verifier's folded commitment to E equals the commitment recomputed from the opened E'; parse the verifier operation count per fold and assert it is constant across steps; parts-sum: folded-witness length = one step's witness length; retirement when a step is edited; no-op guard; `[hidden]` probe.

**Negative claim (§4.1d):** "The NIFS built here is neither zero-knowledge nor succinct on its own: the final check opens the full folded witness, and that witness is as long as one step's witness plus the error vector." **Fixture:** fold 8 steps; every check green ("FOLDED 8 → 1, VALID"); the opened witness on screen includes the private inputs and its displayed length equals one step's witness length plus |E| → "VALID — AND NOTHING HIDDEN". Say precisely that verifier work per fold is constant while the final open is linear in one step.

## Pre-build verification

- Grep card copy for `folding`, `Nova`, `IVC`, `relaxed R1CS`. Read SNARK Arena, STARK Tower and Polynomial Forge for field and commitment conventions; do not import their code.
- Confirm the single-curve simplification is labelled on the page and in the README, and that the recursive verifier circuit is named as the thing not built.
- Proposed section: Privacy & Advanced (wherever the ZK cards live). Proposed chip: ZERO-KNOWLEDGE. Verify.

## Citations (checked)

Kothapalli, Setty, Tzialla, "Nova: Recursive Zero-Knowledge Arguments from Folding Schemes", CRYPTO 2022; ePrint 2021/370. Valiant, "Incrementally Verifiable Computation or Proofs of Knowledge Imply Time/Space Efficiency", TCC 2008. Pedersen, "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing", CRYPTO 1991. RFC 9380.

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*