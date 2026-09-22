/**
 * Source-level rules about the spec files, kept apart from the runtime rule they support.
 *
 * The split matters. e2e/coverage-replay.spec.ts asserts that a recorded mutation's killing
 * assertion ACTUALLY RAN, and that is the rule the gate's guarantee rests on. Everything in this
 * file reads text instead, so none of it can establish execution — it is kept because it is cheap,
 * it names a typo at the point the typo was made, and it answers a question runtime cannot:
 * whether the expectation an assertion was handed came from the marker it is judging.
 */

/** Splits spec source into `test('<title>', …)` bodies, so a record's killedBy test can be read. */
export function testBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>()
  const heads = /\btest\('((?:[^'\\]|\\.)*)'/g
  let match: RegExpExecArray | null
  let title: string | null = null
  let start = 0
  while ((match = heads.exec(source)) !== null) {
    if (title !== null) bodies.set(title, source.slice(start, match.index))
    title = match[1]
    start = match.index
  }
  if (title !== null) bodies.set(title, source.slice(start))
  return bodies
}

/** Blanks comments, leaving every other byte in place so offsets stay meaningful enough to scan. */
export function withoutComments(source: string): string {
  let out = ''
  let index = 0
  while (index < source.length) {
    const here = source[index]
    if (here === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1
      continue
    }
    if (here === '/' && source[index + 1] === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1
      index += 2
      continue
    }
    if (here === "'" || here === '"' || here === '`') {
      const quote = here
      out += here
      index += 1
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') { out += source[index]; index += 1 }
        if (index < source.length) { out += source[index]; index += 1 }
      }
      out += quote
      index += 1
      continue
    }
    out += here
    index += 1
  }
  return out
}

/**
 * Blanks the TEXT of string literals while keeping `${…}` interpolations, which are code.
 *
 * Used only before looking for identifier references, so that prose in a `note:` cannot be read as
 * a reference to a variable that happens to share a word with it — and so that a name mentioned in
 * a message is not mistaken for the value being passed.
 */
export function withoutStringText(source: string): string {
  let out = ''
  let index = 0
  while (index < source.length) {
    const here = source[index]
    if (here === "'" || here === '"') {
      index += 1
      while (index < source.length && source[index] !== here) index += source[index] === '\\' ? 2 : 1
      index += 1
      out += '""'
      continue
    }
    if (here === '`') {
      index += 1
      out += '``'
      while (index < source.length && source[index] !== '`') {
        if (source[index] === '\\') { index += 2; continue }
        if (source[index] === '$' && source[index + 1] === '{') {
          index += 2
          const start = index
          let depth = 1
          while (index < source.length && depth > 0) {
            const character = source[index]
            if (character === '{') depth += 1
            else if (character === '}') depth -= 1
            if (depth > 0) index += 1
          }
          out += ` ${source.slice(start, index)} `
          index += 1
          continue
        }
        index += 1
      }
      index += 1
      continue
    }
    out += here
    index += 1
  }
  return out
}

const OPENERS = '([{'
const CLOSERS = ')]}'

/** Reads one balanced expression from `start`, ending at a newline or `;` outside every bracket. */
function balancedExpression(code: string, start: number): string {
  let depth = 0
  let index = start
  for (; index < code.length; index += 1) {
    const here = code[index]
    if (OPENERS.includes(here)) depth += 1
    else if (CLOSERS.includes(here)) {
      if (depth === 0) break
      depth -= 1
    } else if (depth === 0 && (here === '\n' || here === ';')) break
  }
  return code.slice(start, index)
}

interface Declaration {
  names: string[]
  value: string
}

const IDENTIFIER = /[A-Za-z_$][\w$]*/g

function declarations(code: string): Declaration[] {
  const found: Declaration[] = []
  const heads = /\b(?:const|let|var)\s+(\{[^}]*\}|\[[^\]]*\]|[A-Za-z_$][\w$]*)\s*=/g
  let match: RegExpExecArray | null
  while ((match = heads.exec(code)) !== null) {
    found.push({ names: match[1].match(IDENTIFIER) ?? [], value: balancedExpression(code, heads.lastIndex) })
  }
  return found
}

const READ_METHODS = /\.(?:getAttribute|textContent|innerText|innerHTML|inputValue|evaluate|evaluateAll|allTextContents|allInnerTexts|count|getAttributeNames)\s*\(/

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Does this fragment read the marker `id` off the page, by either route the specs use? */
function readsMarker(code: string, id: string): boolean {
  if (code.includes(`claimValue(page, '${id}')`)) return true
  if (!new RegExp(`\\[data-(?:verdict|claim)="${escape(id)}"\\]`).test(code)) return false
  return READ_METHODS.test(code)
}

const references = (code: string, names: Set<string>): string[] =>
  [...new Set((withoutStringText(code).match(IDENTIFIER) ?? []).filter((name) => names.has(name)))]

/** Every local name whose value came, directly or through other locals, from reading marker `id`. */
export function taintedBy(body: string, id: string): Set<string> {
  const code = withoutComments(body)
  const declared = declarations(code)
  const tainted = new Set<string>()
  for (const declaration of declared) if (readsMarker(declaration.value, id)) for (const name of declaration.names) tainted.add(name)
  for (let pass = 0; pass < declared.length; pass += 1) {
    let grew = false
    for (const declaration of declared) {
      if (declaration.names.every((name) => tainted.has(name))) continue
      if (references(declaration.value, tainted).length === 0) continue
      for (const name of declaration.names) if (!tainted.has(name)) { tainted.add(name); grew = true }
    }
    if (!grew) break
  }
  return tainted
}

/** Every `helper(page, '<id>', …)` call in this body, as the expectation text each one is handed. */
export function expectationArguments(body: string, helper: string, id: string): string[] {
  const code = withoutComments(body)
  const needle = `${helper}(page, '${id}'`
  const found: string[] = []
  for (let at = code.indexOf(needle); at !== -1; at = code.indexOf(needle, at + 1)) {
    const open = at + helper.length
    let depth = 0
    let index = open
    for (; index < code.length; index += 1) {
      if (OPENERS.includes(code[index])) depth += 1
      else if (CLOSERS.includes(code[index])) {
        depth -= 1
        if (depth === 0) break
      }
    }
    found.push(code.slice(open + 1, index))
  }
  return found
}

/**
 * Why the expectation handed to `helper(page, '<id>', …)` is not allowed to come from `<id>` itself.
 *
 * An assertion fed the marker's own rendered value passes on every page, including a mutated one.
 * It executes, so the runtime replay sees it; it names the right helper, so the source scan sees
 * it; and it proves nothing. Returns one message per offending call, empty when the oracle is
 * independent.
 *
 * The rule is per marker, not per test, and that distinction is the whole reason it is usable
 * here. This lab's specs deliberately cross-derive: `r`'s oracle is built from the rendered
 * `plain-residual`, `plain-residual`'s from the rendered `r`, and each opened vector predicts the
 * other's challenge. Those are independent checks and stay green. What fails is a marker whose
 * expectation traces back to a read of that same marker.
 *
 * Its reach: one identifier hop at a time, followed to a fixed point, over reads written as
 * `claimValue(page, '<id>')` or as a `[data-…="<id>"]` locator with a read method on it. A read
 * laundered through some new helper this file does not know is not followed, and that is the known
 * hole — closed only by keeping marker reads on the two routes above.
 */
export function oracleDependenceFailures(body: string, helper: string, id: string): string[] {
  const tainted = taintedBy(body, id)
  const failures: string[] = []
  for (const argument of expectationArguments(body, helper, id)) {
    if (readsMarker(argument, id)) {
      failures.push(`${helper}(page, '${id}', …) is handed an expectation read from [${id}] itself, so it would pass on any page, mutated or not`)
      continue
    }
    const borrowed = references(argument, tainted)
    if (borrowed.length > 0) {
      failures.push(`${helper}(page, '${id}', …) is handed an expectation built from ${borrowed.map((name) => `\`${name}\``).join(', ')}, which came from reading [${id}] itself, so it would pass on any page, mutated or not`)
    }
  }
  return failures
}
