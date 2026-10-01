#!/usr/bin/env node
/**
 * Replays every record in e2e/verdict-mutations.ts and JUDGES it against the four
 * rules a kill has to clear. Nothing below is typed by a person: every verdict is
 * produced by the run that earned it.
 *
 *   node scripts/mutation.mjs list
 *   node scripts/mutation.mjs verify            # all 41, both families
 *   node scripts/mutation.mjs verify <marker>   # just these
 *
 * WHAT CHANGED IN THE LEDGER TO MAKE THIS POSSIBLE
 *
 * Every record already described its edit as PROSE -- "template(): `const plain =
 * { ...result.folded, E: [0n, 0n] }` -> `const plain = { ...result.folded }`" --
 * which a person can redo and a script cannot. Each now also carries `patch`: the
 * file, an anchor that must occur exactly once, and its replacement.
 *
 * The prose stays, and not out of sentiment. It carries two things the patch does
 * not: WHICH FUNCTION the edit sits in (`template()`, `foldPublic()`,
 * `CountingPoint.multiply()`), which is how a reader finds it again when the line
 * moves; and WHY that edit and not another -- `chain-total-ops` records that it is
 * the only mutation in either set that can tell a summed total from a multiplied
 * one, because every other one moves all folds at once. A patch cannot hold that.
 *
 * Eight of the 41 could not be read straight out of the prose, because the prose
 * elided the part that does not matter to a person and does matter to a string
 * match: `JSON.stringify(A, …)`, `valid: constraintValid && ...`,
 * `verifierGroupOps(…)`. Those were expanded from the source, and the expansion is
 * recorded in the patch rather than left for the next reader to redo.
 *
 * THE FOUR RULES, each enforced rather than assumed:
 *
 *   1. The owning test PASSED UNMUTATED in this same run, checked per record from
 *      `killedBy`. A baseline green overall can still be green because the one test
 *      that matters never ran.
 *   2. The patch CHANGED THE FILE, and the file returns to its original md5. Both
 *      halves are checked for EVERY selected patch before any is applied, and the
 *      md5 is re-checked after each individual mutation. A restore that does not
 *      land aborts the whole run: every verdict after it would describe the file
 *      that stayed mutated rather than its own mutation.
 *   3. The run served the MUTATED CODE, proved two ways because one is not enough:
 *      the built bundle's hash must MOVE, and the failure must not match a shape
 *      meaning the code never ran at all. CI=1 turns off reuseExistingServer and
 *      the preview server is --strictPort on 4695, so a listener left by an earlier
 *      run cannot answer for an unmutated build.
 *   4. A patch that DOES NOT COMPILE is DOES NOT BUILD, never a kill. The build runs
 *      explicitly before the gate, so that answer arrives directly rather than as a
 *      webServer timeout.
 *
 * WHY THE GATE RUNS AS A PROJECT, NEVER -g
 *
 * playwright.config.ts gives `verdict-replay` a `dependencies: ['lab']`, and
 * e2e/coverage-replay.spec.ts fails the run when a recorded kill's assertion did
 * not ACTUALLY RUN -- the helpers write down the (test title, marker) pairs they
 * execute and that project reads them back once the suite is over. So the gate is
 * `--project=verdict-replay`, and a single-test run cannot exit 0 here: the named
 * test passes and the replay fails on the other forty.
 *
 * When a mutation does kill its owning test, the `lab` project goes red and the
 * dependent `verdict-replay` project is SKIPPED. That is expected, and it is why
 * the verdict below is read from the OWNING TEST's own result in the JSON report
 * rather than from the suite's exit code.
 *
 * `killedBy` names a test TITLE and not a file, so the title is looked up across
 * every spec the run reported. A title matching two specs is refused rather than
 * guessed at: that is an ambiguous record, not a kill.
 *
 * ON IMPORTING THE LEDGER. The records are a TypeScript module, so this script
 * imports it directly and relies on Node's type stripping (Node 23.6+; verified on
 * 26.9). Moving them to JSON was the alternative and was not taken: four files
 * import this module -- including src/ui/app.ts, which renders from it -- so the
 * records would have had to be duplicated or every importer rewritten, to make a
 * script's life easier. A failed import is reported as a failed import.
 *
 * Results are NOT written back into the ledger. coverage-replay.spec.ts already
 * fails the run when a recorded kill did not execute, so an archived `observed`
 * string would be a second copy of an enforced answer -- the choice
 * crypto-lab-hidden-bit and crypto-lab-pqxdh-wire both made, and §4.1c calls
 * writing back optional and enforcement the requirement.
 *
 * The `baseline` and `failure` fields each record carries ARE typed observations,
 * pasted reporter lines from the session that first ran them. They are left alone
 * here: they are historical evidence, this script now supersedes them as the live
 * answer, and deleting another author's recorded evidence is a maintainer's call
 * rather than a side effect of adding a runner.
 */
import { createHash } from 'node:crypto'
import { execFileSync, execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const GATE = ['--project=verdict-replay']

let LEDGER
try {
  LEDGER = await import(join(ROOT, 'e2e/verdict-mutations.ts'))
} catch (error) {
  console.error('Could not import e2e/verdict-mutations.ts, so there are no records to judge.')
  console.error(`  ${error.message.split('\n')[0]}`)
  console.error('\nThis script imports the TypeScript ledger directly and needs Node 23.6+ for')
  console.error(`type stripping. This is ${process.version}.`)
  process.exit(2)
}

const RECORDS = [
  ['verdict', LEDGER.VERDICT_MUTATIONS],
  ['claim', LEDGER.CLAIM_MUTATIONS],
].flatMap(([family, group]) => Object.entries(group).map(([marker, record]) => ({ family, marker, ...record })))

const [, , command, ...only] = process.argv

if (command === 'list') {
  for (const record of RECORDS) {
    console.log(`${record.marker}  [${record.family}]`)
    console.log(`  computes  ${record.computes}`)
    console.log(`  patch     ${record.patch ? `${record.patch.file}: ${record.patch.find.split('\n')[0].trim().slice(0, 90)}` : 'NOT ENCODED'}`)
    console.log(`  killed by ${record.killedBy}\n`)
  }
  process.exit(0)
}

if (command !== 'verify') {
  console.error('usage: mutation.mjs list | verify [marker...]')
  process.exit(1)
}

const selected = only.length === 0 ? RECORDS : RECORDS.filter((record) => only.includes(record.marker))
const unknown = only.filter((marker) => !RECORDS.some((record) => record.marker === marker))
if (unknown.length > 0) {
  console.error(`unknown marker(s): ${unknown.join(', ')}`)
  process.exit(1)
}
const unencoded = selected.filter((record) => !record.patch)
if (unencoded.length > 0) {
  console.error('Refusing to run: these records have only prose, no `patch`.\n')
  for (const record of unencoded) console.error(`  ${record.marker}: ${record.mutation}`)
  console.error('\nA sentence describing an edit cannot be replayed. Encode it as file/find/replace.')
  process.exit(2)
}

const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim()

/* The archive below is taken from HEAD, so uncommitted work would be absent from
   the tree every verdict describes. Commit first. */
const dirty = git('status', '--porcelain', '--untracked-files=no')
if (dirty && !process.env.MUTATION_ALLOW_DIRTY) {
  console.error('Refusing to run: uncommitted changes to tracked files.\n')
  console.error(dirty)
  console.error('\nThe isolated tree is archived from HEAD and would not contain them.')
  console.error('Commit first. MUTATION_ALLOW_DIRTY=1 overrides, knowing that.')
  process.exit(2)
}

/* Rule 2, for every selected patch, BEFORE any is applied, read from the TREE the
   patches are applied to rather than from the working copy. A patch that cannot make
   the round trip is a broken RECORD; discovering that halfway through leaves a
   mutated file behind and poisons every verdict after it. */
function preflight(tree) {
  const broken = []
  for (const record of selected) {
    const { file, find, replace } = record.patch
    const text = readFileSync(join(tree, file), 'utf8')
    const anchors = text.split(find).length - 1
    if (anchors !== 1) {
      broken.push(`${record.marker}: find occurs ${anchors}x in ${file}, expected exactly 1`)
      continue
    }
    const after = text.replace(find, replace)
    if (after === text) {
      broken.push(`${record.marker}: the patch is a no-op, it would not change ${file}`)
    } else if (after.split(replace).length - 1 !== 1) {
      broken.push(`${record.marker}: replace occurs ${after.split(replace).length - 1}x after applying, so it cannot be reverted`)
    }
  }
  if (broken.length > 0) {
    console.error('Refusing to run: these records cannot make the round trip.\n')
    for (const line of broken) console.error(`  ${line}`)
    rmSync(tree, { recursive: true, force: true })
    process.exit(2)
  }
}

const sha = git('rev-parse', 'HEAD').slice(0, 7)
const TREE = mkdtempSync(join(tmpdir(), 'fold-gate-mutation-'))
const SCRATCH = mkdtempSync(join(tmpdir(), 'fold-gate-reports-'))
execSync(`git -C ${ROOT} archive HEAD | tar -x -C ${TREE}`, { stdio: 'pipe' })
symlinkSync(join(ROOT, 'node_modules'), join(TREE, 'node_modules'))
console.log(`isolated tree: ${TREE}`)
console.log(`archived from: ${sha}`)
preflight(TREE)
console.log(`${selected.length} record(s) make the round trip\n`)

const digest = (rel) => createHash('md5').update(readFileSync(join(TREE, rel))).digest('hex').slice(0, 12)

const DIST = join(TREE, 'dist', 'assets')
function bundleHash() {
  if (!existsSync(DIST)) return null
  const h = createHash('sha256')
  for (const file of readdirSync(DIST).sort()) h.update(file).update(readFileSync(join(DIST, file)))
  return h.digest('hex').slice(0, 12)
}

/** Rule 4. Keeps the output so the reason is reportable. */
function build() {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: TREE,
    env: { ...process.env, CI: '1' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

const ESC = String.fromCharCode(27)
const strip = (text) => text.split(new RegExp(`${ESC}\\[[0-9;]*m`, 'g')).join('')

/* Rule 3's second half: red for one of these means the code never ran, so the red is
   about the harness and not about the verdict. */
const NOT_A_KILL = [
  { pattern: /error TS\d+|Build failed|Transform failed|Could not resolve/i, label: 'build error' },
  { pattern: /webServer.*did not start|Timed out waiting .* from config\.webServer/i, label: 'server never started' },
  { pattern: /net::ERR_CONNECTION_REFUSED/i, label: 'nothing served on the port' },
  { pattern: /is already (?:used|in use)|EADDRINUSE/i, label: 'port already held' },
]
const notAKill = (output) => NOT_A_KILL.find(({ pattern }) => pattern.test(strip(output)))?.label ?? null

function runGate(label) {
  const report = join(SCRATCH, `${label}.json`)
  const result = spawnSync('npx', ['playwright', 'test', ...GATE, '--reporter=json', '--retries=0'], {
    cwd: TREE,
    env: { ...process.env, CI: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: report },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  let parsed
  try {
    parsed = JSON.parse(readFileSync(report, 'utf8'))
  } catch {
    return { specs: null, exitCode: result.status, output }
  }
  const specs = []
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) specs.push(spec)
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of parsed.suites ?? []) walk(suite)
  return { specs, exitCode: result.status, output }
}

/** The record's own test, by TITLE. `killedBy` names no file, so an ambiguous
 *  title is refused rather than resolved by guessing which spec was meant. */
function outcome(specs, record) {
  const matches = specs?.filter((spec) => spec.title === record.killedBy) ?? []
  if (matches.length === 0) return { found: false, ok: false, detail: `no test titled "${record.killedBy}" ran` }
  if (matches.length > 1) {
    return { found: false, ok: false, detail: `"${record.killedBy}" matched ${matches.length} specs (${matches.map((s) => s.file).join(', ')}); the record is ambiguous` }
  }
  const spec = matches[0]
  const statuses = spec.tests.flatMap((test) => test.results.map((result) => result.status))
  return { found: true, ok: spec.ok === true, detail: statuses.join(', ') }
}

function apply(record, direction) {
  const { file, find, replace } = record.patch
  const path = join(TREE, file)
  const source = readFileSync(path, 'utf8')
  const [from, to] = direction === 'apply' ? [find, replace] : [replace, find]
  const occurrences = source.split(from).length - 1
  if (occurrences !== 1) {
    throw new Error(`${file}: ${direction} ${record.marker} expected exactly one occurrence, found ${occurrences}`)
  }
  const next = source.replace(from, to)
  if (next === source) throw new Error(`${file}: ${direction} ${record.marker} produced an identical file`)
  writeFileSync(path, next)
}

function abort(message) {
  console.error(`\n${message}`)
  rmSync(TREE, { recursive: true, force: true })
  rmSync(SCRATCH, { recursive: true, force: true })
  process.exit(2)
}

console.log('building the baseline in the isolated tree...')
const baselineBuild = build()
if (!baselineBuild.ok) {
  abort(`The baseline does not build in the isolated tree. Nothing below would mean anything.\n\n${strip(baselineBuild.output).split('\n').slice(-20).join('\n')}`)
}
const baselineHash = bundleHash()
console.log(`baseline bundle ${baselineHash}`)

console.log('running the gate unmutated (--project=verdict-replay, which pulls lab first)...')
const baseline = runGate('baseline')
const notGreen = selected.filter((record) => !outcome(baseline.specs, record).ok)
if (baseline.exitCode !== 0 || notGreen.length > 0) {
  for (const record of notGreen) console.error(`  ${record.marker}: ${outcome(baseline.specs, record).detail}`)
  abort(`The unmutated gate is not green (exit ${baseline.exitCode}); a kill read against it would prove nothing.\n\n${strip(baseline.output).split('\n').slice(-25).join('\n')}`)
}
console.log(`baseline green, ${baseline.specs.length} specs\n`)

const results = []
for (const [index, record] of selected.entries()) {
  const position = `${String(index + 1).padStart(2)}/${selected.length}`
  const before = digest(record.patch.file)
  let verdict
  let detail = ''
  let hashes = ''
  try {
    apply(record, 'apply')
    const built = build()
    if (!built.ok) {
      verdict = 'DOES NOT BUILD'
      detail = (strip(built.output).match(/error TS\d+[^\n]*/) ?? [''])[0]
    } else {
      const mutatedHash = bundleHash()
      if (mutatedHash === baselineHash) {
        verdict = 'BUNDLE UNCHANGED'
      } else {
        const mutated = runGate(record.marker)
        const shape = notAKill(mutated.output)
        const result = outcome(mutated.specs, record)
        verdict = shape
          ? `NOT A KILL (${shape})`
          : !result.found
            ? `NOT A KILL (${result.detail})`
            : result.ok
              ? 'SURVIVED'
              : 'KILLED'
        detail = result.detail
        hashes = `${baselineHash} -> ${mutatedHash}`
      }
    }
  } finally {
    apply(record, 'restore')
  }
  const rebuilt = build()
  const restoredHash = rebuilt.ok ? bundleHash() : null
  if (digest(record.patch.file) !== before) {
    abort(`${record.marker}: ${record.patch.file} did not return to md5 ${before}. Aborting: every verdict after this one would describe that file rather than its own mutation.`)
  }
  if (rebuilt.ok && restoredHash !== baselineHash) {
    abort(`${record.marker}: the bundle did not return to ${baselineHash} after restoring ${record.patch.file}. Aborting for the same reason.`)
  }
  results.push({ record, verdict, detail })
  console.log(`${position}  ${verdict.padEnd(18)} ${record.marker.padEnd(20)} ${hashes ? `${hashes} -> ${restoredHash}` : detail}`)
}

rmSync(TREE, { recursive: true, force: true })
rmSync(SCRATCH, { recursive: true, force: true })

const killed = results.filter((r) => r.verdict === 'KILLED')
const survived = results.filter((r) => r.verdict === 'SURVIVED')
const broken = results.filter((r) => r.verdict !== 'KILLED' && r.verdict !== 'SURVIVED')
console.log(`\n${killed.length}/${results.length} killed, ${survived.length} survived, ${broken.length} neither`)
for (const { record, detail } of survived) {
  console.log(`  SURVIVED ${record.marker}: "${record.killedBy}" stayed green under its own recorded mutation (${detail}). The record is not evidence.`)
}
for (const { record, verdict, detail } of broken) {
  console.log(`  ${verdict} ${record.marker}${detail ? `: ${detail}` : ''}`)
}
if (broken.length > 0) {
  console.log('\nDOES NOT BUILD is a broken PATCH, not a surviving mutation: fix the patch and re-run.')
  console.log('BUNDLE UNCHANGED means the edit never reached the browser.')
}
process.exit(killed.length === results.length ? 0 : 1)
