import { commitmentHex } from '../commit/pedersen'
import { forgeAfterChallenge } from '../attack/r-first'
import { mod, scale } from '../math/field'
import { proveFold, publicInstance, tamperCommitment } from '../nifs/prove'
import { verifyChallenge } from '../nifs/verify'
import { finalCheck } from '../open/final-check'
import { A, B, C } from '../r1cs/matrices'
import { residual, step, witnessVector, type RelaxedInstance } from '../r1cs/relaxed'

const VERIFIER_GROUP_OPS = 5

function full(values: bigint[]): string {
  return `[${values.map(String).join(', ')}]`
}

function short(value: bigint, width = 10): string {
  const text = value.toString()
  return text.length <= width ? text : `${text.slice(0, width)}…`
}

function shortVector(values: bigint[]): string {
  return `[${values.map((value) => short(value, 7)).join(', ')}]`
}

function shortCommitment(hex: string): string {
  return `${hex.slice(0, 12)}…${hex.slice(-8)}`
}

function valueRow(label: string, value: bigint | bigint[], claim?: string): string {
  const values = Array.isArray(value) ? value : [value]
  const rendered = Array.isArray(value) ? shortVector(value) : short(value)
  return `<div class="value-row"${claim ? ` data-claim="${claim}" data-value="${full(values)}"` : ''}><span>${label}</span><output title="${full(values)}">${rendered}</output></div>`
}

interface ChainResult {
  count: number
  folded: RelaxedInstance
  valid: boolean
  finalCommitmentE: string
  challenges: bigint[]
}

function foldChain(count: number): ChainResult {
  let rawInput = 1n
  let currentStep = step(rawInput)
  let folded = currentStep
  const challenges: bigint[] = []

  for (let index = 2; index <= count; index += 1) {
    rawInput = currentStep.x[1]
    currentStep = step(rawInput)
    const result = proveFold(folded, currentStep)
    folded = result.folded
    challenges.push(result.proof.challenge)
  }

  const opened = finalCheck(publicInstance(folded), folded)
  return {
    count,
    folded,
    valid: opened.valid,
    finalCommitmentE: commitmentHex(publicInstance(folded).commitmentE),
    challenges,
  }
}

function template(): string {
  const left = step(2n)
  const right = step(5n)
  const result = proveFold(left, right)
  const plain = { ...result.folded, E: [0n, 0n] }
  const plainResidual = residual(plain)
  const expectedResidual = scale(result.proof.T, result.proof.challenge)
  const publicLeft = publicInstance(left)
  const publicRight = publicInstance(right)

  return `
    <div class="shell">
      <header class="cl-hero">
        <div class="cl-hero-main">
          <h1 class="cl-hero-title">Fold Gate</h1>
          <p class="cl-hero-sub">Folding schemes · Nova NIFS · relaxed R1CS</p>
          <p class="cl-hero-desc">Slide two instance cards into one, expose the cross term between them, fold up to sixty-four steps, and open one final witness.</p>
        </div>
        <aside class="cl-hero-why" aria-label="Why it matters">
          <span class="cl-hero-why-label">WHY IT MATTERS</span>
          <p class="cl-hero-why-text">Folding lets recursive proof systems advance a virtual machine one step at a time while retaining one compact instance. The ordering of one transcript hash is what prevents the prover from choosing the correction after seeing the challenge.</p>
        </aside>
      </header>

      <section class="intro" aria-labelledby="intro-title">
        <div>
          <p class="section-kicker">THE IDEA</p>
          <h2 id="intro-title">One constraint system, many steps, one final instance</h2>
        </div>
        <div class="intro-copy">
          <p>An R1CS is a list of multiplication rules. Combining two ordinary solutions creates unwanted cross terms, so Nova relaxes the rules with a scalar <var>u</var> and error vector <var>E</var> that can absorb exactly those terms.</p>
          <p>This lab computes that mechanism over the ristretto255 scalar field. Nothing below is staged: every commitment, challenge, fold, and final check runs in your browser.</p>
        </div>
      </section>

      <section class="mechanism" aria-labelledby="mechanism-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">01 · FOLD WALKTHROUGH</p>
            <h2 id="mechanism-title">Watch the missing term appear</h2>
          </div>
          <p>Advance one mathematical event at a time. The first attempt deliberately omits <var>E′</var>.</p>
        </div>

        <div class="phase-track" role="group" aria-label="Fold stages">
          <span class="phase-dot active" data-phase-dot="0">1 <span>Instances</span></span>
          <span class="phase-dot" data-phase-dot="1">2 <span>Plain fold</span></span>
          <span class="phase-dot" data-phase-dot="2">3 <span>Cross term</span></span>
          <span class="phase-dot" data-phase-dot="3">4 <span>Relaxed fold</span></span>
        </div>

        <div class="fold-stage" data-phase="0">
          <div class="instance-card instance-left">
            <div class="card-label">INSTANCE 1</div>
            <strong>Satisfying step</strong>
            ${valueRow('x₁', left.x, 'x1')}
            ${valueRow('W₁', left.W, 'W1')}
            ${valueRow('E₁', left.E)}
          </div>

          <div class="fold-operator" aria-hidden="true">+</div>

          <div class="instance-card instance-right">
            <div class="card-label">INSTANCE 2</div>
            <strong>Satisfying step</strong>
            ${valueRow('x₂', right.x, 'x2')}
            ${valueRow('W₂', right.W, 'W2')}
            ${valueRow('E₂', right.E)}
          </div>

          <div class="cross-card" data-stage-item="cross" hidden>
            <div class="card-label">CORRECTION T</div>
            <strong>Cross term committed before r</strong>
            ${valueRow('T', result.proof.T, 'T')}
            <code title="${commitmentHex(result.proof.commitmentT)}">${shortCommitment(commitmentHex(result.proof.commitmentT))}</code>
          </div>

          <div class="challenge-stamp" data-stage-item="challenge" data-claim="r" data-value="${result.proof.challenge}" hidden>
            <span>SHA-512 TRANSCRIPT</span>
            r = ${short(result.proof.challenge, 12)}
          </div>

          <div class="folded-card" data-stage-item="folded" hidden>
            <div class="card-label">FOLDED INSTANCE</div>
            <strong>Relaxed and satisfying</strong>
            ${valueRow('u′', result.folded.u, 'ufold')}
            ${valueRow('x′', result.folded.x, 'xfold')}
            ${valueRow('W′', result.folded.W, 'Wfold')}
            ${valueRow('E′', result.folded.E, 'Efold')}
          </div>
        </div>

        <div class="residual-panel" data-stage-item="plain" hidden>
          <div class="verdict verdict-bad"><span aria-hidden="true"></span><strong>NOT SATISFIED</strong> · cross term remains</div>
          <p>The plain random combination leaves <code data-claim="plain-residual" data-value="${full(plainResidual)}">residual = ${shortVector(plainResidual)}</code>.</p>
          <p class="equation">residual = r · T = <span data-claim="expected-residual" data-value="${full(expectedResidual)}">${shortVector(expectedResidual)}</span></p>
        </div>

        <div class="residual-panel residual-pass" data-stage-item="relaxed" hidden>
          <div class="verdict verdict-good"><span aria-hidden="true"></span><strong>SATISFIED</strong> · E′ absorbed exactly r · T</div>
          <p>The same combination now has residual <code>[0, 0]</code>. The mathematics did not disappear; it moved into the committed error vector.</p>
        </div>

        <div class="walk-controls">
          <button class="button button-primary" id="advance-phase" type="button">Show plain fold</button>
          <button class="button button-quiet" id="reset-phase" type="button" disabled>Reset walkthrough</button>
          <output id="phase-status" class="sr-status" role="status" aria-live="polite">Showing two satisfying instances.</output>
        </div>
      </section>

      <section class="verifier-section" aria-labelledby="verifier-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">02 · VERIFIER LANE</p>
            <h2 id="verifier-title">The large values stay out of this lane</h2>
          </div>
          <p>The NIFS verifier receives public inputs and opaque group elements. It never receives <var>W</var> or <var>E</var>.</p>
        </div>
        <div class="verifier-lane">
          <div class="commitment-stack" role="group" aria-label="Verifier inputs">
            <span class="commitment-token">Com(E₁) <code>${shortCommitment(commitmentHex(publicLeft.commitmentE))}</code></span>
            <span class="commitment-token">Com(E₂) <code>${shortCommitment(commitmentHex(publicRight.commitmentE))}</code></span>
            <span class="commitment-token">Com(W₁) <code>${shortCommitment(commitmentHex(publicLeft.commitmentW))}</code></span>
            <span class="commitment-token">Com(W₂) <code>${shortCommitment(commitmentHex(publicRight.commitmentW))}</code></span>
            <span class="commitment-token">Com(T) <code>${shortCommitment(commitmentHex(result.proof.commitmentT))}</code></span>
          </div>
          <div class="verifier-arrow" aria-hidden="true"></div>
          <div class="verifier-result">
            <span class="meter-number" data-claim="ops-per-fold" data-value="${VERIFIER_GROUP_OPS}">${VERIFIER_GROUP_OPS}</span>
            <span>group operations<br />per fold<br /><code data-claim="pair-commitment-e" data-value="${commitmentHex(result.publicFolded.commitmentE)}" title="${commitmentHex(result.publicFolded.commitmentE)}">Com(E′) ${shortCommitment(commitmentHex(result.publicFolded.commitmentE))}</code></span>
          </div>
        </div>
        <p class="boundary-note"><strong>Boundary:</strong> a recursive system would put this verifier inside an augmented step circuit. That circuit is deliberately not built here.</p>
      </section>

      <section class="chain-section" aria-labelledby="chain-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">03 · KEEP FOLDING</p>
            <h2 id="chain-title">Change the history, not the verifier’s per-fold work</h2>
          </div>
          <p>Each step is a real execution of <var>y = x³ + 3</var>. The final opening remains one step-wide.</p>
        </div>
        <div class="chain-tool">
          <div class="chain-controls">
            <label for="step-count">Steps to fold</label>
            <span class="select-wrap">
              <select id="step-count">
                <option value="2">2 steps</option>
                <option value="4">4 steps</option>
                <option value="8" selected>8 steps</option>
                <option value="16">16 steps</option>
                <option value="32">32 steps</option>
                <option value="64">64 steps</option>
              </select>
            </span>
            <button class="button button-primary" id="run-chain" type="button">Fold 8 steps</button>
          </div>
          <div class="work-meters" role="group" aria-label="Verifier work comparison">
            <div class="work-meter">
              <span>PER FOLD</span>
              <div class="meter-track"><i style="width:24%"></i></div>
              <strong>${VERIFIER_GROUP_OPS} group ops</strong>
            </div>
            <div class="work-meter">
              <span>FINAL OPEN</span>
              <div class="meter-track final"><i style="width:40%"></i></div>
              <strong>1 W + 1 E</strong>
            </div>
          </div>
        </div>
        <p id="chain-retirement" class="retirement" role="status" aria-live="polite">Choose a step count, then run the fold.</p>
        <div id="chain-result" class="chain-result" hidden></div>
      </section>

      <section class="break-section" aria-labelledby="break-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">04 · BREAK IT YOURSELF</p>
            <h2 id="break-title">Three attacks, one ordering mistake that wins</h2>
          </div>
          <p>The first two attacks are caught. The third changes the protocol so the prover sees <var>r</var> too early.</p>
        </div>
        <div class="attack-grid">
          <article class="attack-card">
            <span class="attack-index">A</span>
            <h3>Tamper the witness</h3>
            <p>Change one private coordinate after the fold, then open it against the original commitment.</p>
            <button class="button button-secondary" type="button" data-attack="witness">Tamper W′</button>
          </article>
          <article class="attack-card">
            <span class="attack-index">B</span>
            <h3>Tamper Com(T)</h3>
            <p>Change the correction commitment after the transcript fixed its challenge.</p>
            <button class="button button-secondary" type="button" data-attack="commitment">Tamper Com(T)</button>
          </article>
          <article class="attack-card attack-broken">
            <span class="attack-index">C · BROKEN MODE</span>
            <h3>Choose r first</h3>
            <p>Reveal the challenge before T is committed, then solve backward for the correction the verifier will accept.</p>
            <button class="button button-danger" type="button" data-attack="r-first">Reveal r before T</button>
          </article>
        </div>
        <div id="attack-result" class="attack-result" role="status" aria-live="polite">
          <p>Run an attack to see which invariant answers it.</p>
        </div>
      </section>

      <section class="internals" aria-labelledby="internals-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">05 · INSPECT THE MATH</p>
            <h2 id="internals-title">Nothing hidden behind the diagram</h2>
          </div>
          <p>The teaching implementation exposes every matrix and scalar. Open a layer when you need it.</p>
        </div>
        <div class="disclosures">
          <details>
            <summary>R1CS matrices and witness layout</summary>
            <div class="detail-body">
              <p><code>z = [u, x, y, x²]</code>. Row one enforces <code>x · x = x²</code>; row two enforces <code>x · x² = y − 3u</code>.</p>
              <div class="matrix-grid">
                <pre data-claim="A" data-value='${JSON.stringify(A, (_, value) => typeof value === 'bigint' ? value.toString() : value)}'>A = ${JSON.stringify(A, (_, value) => typeof value === 'bigint' ? value.toString() : value)}</pre>
                <pre data-claim="B" data-value='${JSON.stringify(B, (_, value) => typeof value === 'bigint' ? value.toString() : value)}'>B = ${JSON.stringify(B, (_, value) => typeof value === 'bigint' ? value.toString() : value)}</pre>
                <pre data-claim="C" data-value='${JSON.stringify(C, (_, value) => typeof value === 'bigint' ? value.toString() : value)}'>C = ${JSON.stringify(C, (_, value) => typeof value === 'bigint' ? value.toString() : value)}</pre>
              </div>
            </div>
          </details>
          <details>
            <summary>Transcript and commitment construction</summary>
            <div class="detail-body">
              <p>Pedersen generators are independently derived with RFC 9380 hash-to-group under <code>FOLD-GATE-RISTRETTO255_XMD:SHA-512_RFC9380_V1</code>. The SHA-512 transcript absorbs <code>u₁, u₂, x₁, x₂, Com(E₁), Com(E₂), Com(W₁), Com(W₂), Com(T)</code> in that order.</p>
              <p>A zero challenge is rejected and re-derived with a domain-separated retry byte. Commitments are binding for this teaching flow but are not blinded.</p>
            </div>
          </details>
          <details>
            <summary>Edge cases and extension boundaries</summary>
            <div class="detail-body scope-list">
              <p><strong>u = 0:</strong> refused as a degenerate relaxed instance.</p>
              <p><strong>Self-fold:</strong> allowed; both transcript positions remain explicit.</p>
              <p><strong>Wrong vector size:</strong> rejected before matrix multiplication or vector addition.</p>
              <p><strong>More than 64 steps:</strong> unavailable in the UI to keep inspection responsive.</p>
              <p><strong>Recursive verifier:</strong> extension point at the public verifier interface.</p>
              <p><strong>Compressing SNARK:</strong> hand-off begins after the folded public instance.</p>
              <p><strong>Zero knowledge:</strong> add Pedersen blinding and a proof of the final opening; neither exists here.</p>
            </div>
          </details>
        </div>
      </section>

      <section class="scope" aria-labelledby="scope-title">
        <div>
          <p class="section-kicker">HONEST SCOPE</p>
          <h2 id="scope-title">Real folding, deliberately incomplete proof system</h2>
        </div>
        <div class="scope-columns">
          <div>
            <h3>What is real</h3>
            <p>Relaxed R1CS arithmetic in the ristretto255 scalar field, RFC 9380 hash-derived group generators, ristretto255 Pedersen vector commitments, SHA-512 Fiat–Shamir challenges, and Nova’s NIFS cross term.</p>
            <p class="single-curve"><strong>Single-curve simplification:</strong> Nova normally uses a curve cycle for recursion. This lab uses one curve because it does not build the recursive verifier circuit.</p>
          </div>
          <div>
            <h3>What this is not</h3>
            <ul>
              <li>No augmented recursive-verifier circuit, so this is not IVC by itself.</li>
              <li>No curve cycle or CycleFold.</li>
              <li>No compressing SNARK; see <a href="https://crypto-lab.systemslibrarian.dev/">SNARK Arena and Polynomial Forge</a>.</li>
              <li>No zero-knowledge blinding: the final check opens the witness.</li>
              <li>No HyperNova, ProtoStar, lookups, or production performance claims.</li>
            </ul>
          </div>
        </div>
        <p class="teaching-warning"><strong>Not production crypto.</strong> This is an inspectable teaching implementation, not an audited prover, recursive proof, or deployment library.</p>
      </section>

      <section class="references" aria-labelledby="references-title">
        <p class="section-kicker">PRIMARY SOURCES</p>
        <h2 id="references-title">Read the construction</h2>
        <div class="reference-links">
          <a href="https://eprint.iacr.org/2021/370">Kothapalli, Setty, Tzialla · Nova · CRYPTO 2022</a>
          <a href="https://www.rfc-editor.org/rfc/rfc9380">RFC 9380 · Hashing to Elliptic Curves</a>
          <a href="https://doi.org/10.1007/3-540-46766-1_9">Pedersen · Verifiable Secret Sharing · CRYPTO 1991</a>
          <a href="https://doi.org/10.1007/978-3-540-92600-6_1">Valiant · Incrementally Verifiable Computation · TCC 2008</a>
        </div>
      </section>
    </div>
    <footer class="scripture-footer">
      <p>So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31</p>
    </footer>
  `
}

export function mountApp(root: HTMLElement | null): void {
  if (!root) throw new Error('Missing #app mount point')
  root.innerHTML = template()

  let phase = 0
  const advance = root.querySelector<HTMLButtonElement>('#advance-phase')!
  const reset = root.querySelector<HTMLButtonElement>('#reset-phase')!
  const phaseStatus = root.querySelector<HTMLOutputElement>('#phase-status')!
  const phaseLabels = ['Show plain fold', 'Compute cross term T', 'Derive r and relax', 'Fold complete']
  const statusLabels = [
    'Showing two satisfying instances.',
    'Plain combination fails with residual exactly r times T.',
    'Cross term T is committed before the challenge exists.',
    'Challenge derived. The relaxed folded instance is satisfied.',
  ]

  const paintPhase = (): void => {
    root.querySelectorAll<HTMLElement>('[data-phase-dot]').forEach((element) => {
      element.classList.toggle('active', Number(element.dataset.phaseDot) <= phase)
    })
    const show = (name: string, visible: boolean): void => {
      root.querySelectorAll<HTMLElement>(`[data-stage-item="${name}"]`).forEach((element) => { element.hidden = !visible })
    }
    show('plain', phase === 1)
    show('cross', phase === 2)
    show('challenge', phase >= 3)
    show('folded', phase >= 3)
    show('relaxed', phase >= 3)
    advance.textContent = phaseLabels[phase]
    advance.disabled = phase === 3
    reset.disabled = phase === 0
    phaseStatus.textContent = statusLabels[phase]
    root.querySelector('.fold-stage')?.setAttribute('data-phase', String(phase))
  }

  advance.addEventListener('click', () => {
    if (phase < 3) phase += 1
    paintPhase()
  })
  reset.addEventListener('click', () => {
    phase = 0
    paintPhase()
  })

  const countSelect = root.querySelector<HTMLSelectElement>('#step-count')!
  const runChain = root.querySelector<HTMLButtonElement>('#run-chain')!
  const chainResult = root.querySelector<HTMLElement>('#chain-result')!
  const retirement = root.querySelector<HTMLElement>('#chain-retirement')!
  let lastRunCount: number | null = null
  let latestChain: ChainResult | null = null

  countSelect.addEventListener('change', () => {
    const next = Number(countSelect.value)
    runChain.textContent = `Fold ${next} steps`
    if (lastRunCount !== null && next !== lastRunCount) {
      chainResult.hidden = true
      latestChain = null
      retirement.textContent = `Previous ${lastRunCount}-step verdict retired because the step count changed.`
    }
  })

  runChain.addEventListener('click', () => {
    const count = Number(countSelect.value)
    runChain.disabled = true
    runChain.textContent = 'Folding…'
    requestAnimationFrame(() => {
      latestChain = foldChain(count)
      lastRunCount = count
      chainResult.hidden = false
      chainResult.innerHTML = `
        <div class="chain-verdict verdict verdict-good" data-claim="chain-verdict"><span aria-hidden="true"></span><strong>FOLDED ${count} → 1, VALID</strong></div>
        <div class="chain-stats">
          <div><span>STEPS ABSORBED</span><strong>${count}</strong></div>
          <div><span>GROUP OPS / FOLD</span><strong data-claim="chain-ops" data-value="${VERIFIER_GROUP_OPS}">${VERIFIER_GROUP_OPS}</strong></div>
          <div><span>FOLDED W LENGTH</span><strong data-claim="folded-w-length" data-value="${latestChain.folded.W.length}">${latestChain.folded.W.length}</strong></div>
          <div><span>ONE-STEP W LENGTH</span><strong data-claim="step-w-length" data-value="${step(1n).W.length}">${step(1n).W.length}</strong></div>
        </div>
        <div class="history-bar" role="img" aria-label="${count} folded steps">${Array.from({ length: count }, (_, index) => `<i style="--i:${index}" title="Step ${index + 1}"></i>`).join('')}</div>
        <p class="commitment-line">Final Com(E′): <code data-claim="final-commitment-e" data-value="${latestChain.finalCommitmentE}">${shortCommitment(latestChain.finalCommitmentE)}</code></p>
        <button class="button button-secondary" id="open-final" type="button">Open final W′ and E′</button>
        <div id="opening-result" hidden></div>
      `
      retirement.textContent = `${count} real steps folded. The final witness remains one step wide.`
      runChain.disabled = false
      runChain.textContent = `Fold ${count} steps again`

      root.querySelector<HTMLButtonElement>('#open-final')?.addEventListener('click', (event) => {
        if (!latestChain) return
        const opening = root.querySelector<HTMLElement>('#opening-result')!
        const openLength = latestChain.folded.W.length + latestChain.folded.E.length
        opening.hidden = false
        opening.innerHTML = `
          <div class="opening-grid">
            ${valueRow('Private W′', latestChain.folded.W, 'opened-W')}
            ${valueRow('Error E′', latestChain.folded.E, 'opened-E')}
          </div>
          <div class="negative-fixture">
            <div class="verdict verdict-warning" data-claim="negative-verdict"><span aria-hidden="true"></span><strong>VALID — AND NOTHING HIDDEN</strong></div>
            <p data-claim="negative-claim">The NIFS built here is neither zero-knowledge nor succinct on its own: the final check opens the full folded witness, and that witness is as long as one step’s witness plus the error vector.</p>
            <p>Opened length: <strong data-claim="open-length" data-value="${openLength}">${openLength}</strong> = one-step W length <strong>${step(1n).W.length}</strong> + |E| <strong>${latestChain.folded.E.length}</strong>. Verifier work per fold is constant; this final open is linear in one step.</p>
          </div>
        `
        ;(event.currentTarget as HTMLButtonElement).disabled = true
      })
    })
  })

  root.querySelectorAll<HTMLButtonElement>('[data-attack]').forEach((button) => {
    button.addEventListener('click', () => {
      const attackResult = root.querySelector<HTMLElement>('#attack-result')!
      const left = step(2n)
      const right = step(5n)
      const honest = proveFold(left, right)

      if (button.dataset.attack === 'witness') {
        const changed = { ...honest.folded, W: [...honest.folded.W] }
        changed.W[0] = mod(changed.W[0] + 1n)
        const check = finalCheck(honest.publicFolded, changed)
        attackResult.innerHTML = `<div class="verdict verdict-good" data-claim="attack-verdict"><span aria-hidden="true"></span><strong>FINAL CHECK FAILED</strong> · witness commitment and constraints disagree</div><p>The tamper was caught. A failed adversarial attempt is an integrity success.</p><span class="visually-hidden">Verifier returned ${check.valid}.</span>`
      } else if (button.dataset.attack === 'commitment') {
        const accepted = verifyChallenge(publicInstance(left), publicInstance(right), tamperCommitment(honest.proof.commitmentT), honest.proof.challenge)
        attackResult.innerHTML = `<div class="verdict verdict-good" data-claim="attack-verdict"><span aria-hidden="true"></span><strong>TRANSCRIPT CHECK FAILED</strong> · Com(T) changed after r</div><p>The tamper was caught before folding because the recomputed challenge no longer matches.</p><span class="visually-hidden">Verifier returned ${accepted}.</span>`
      } else {
        const bad = step(5n)
        bad.x[1] = mod(bad.x[1] + 9n)
        const before = residual(bad)
        const forgery = forgeAfterChallenge(left, bad, 17n)
        attackResult.innerHTML = `<div class="verdict verdict-alarm" data-claim="attack-verdict"><span aria-hidden="true"></span><strong>ACCEPTED — AND FORGED</strong></div><p>The hidden step was unsatisfying with residual <code>${shortVector(before)}</code>, yet the folded instance passed. Learning r first let the prover solve backward for T. This broken mode is not Nova NIFS.</p><p class="equation">forged T = (E′ − E₁ − r²E₂) / r = ${shortVector(forgery.forgedT)}</p>`
      }
    })
  })
}