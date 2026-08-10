/**
 * SPIKE — not wired into the app. Run with: npx tsx scripts/spike-answer-matching.ts
 *
 * The whole risk in a written-answer mode sits in one function: deciding
 * whether what the child typed means the same as the marked answer. Everything
 * else (a text box, a different feedback panel) is ordinary work.
 *
 * So this prototypes the matcher and runs it against real answers from the
 * bank, with the kinds of input a Year 5 pupil actually types. The point is to
 * find where pure normalisation is not enough — see docs/written-answers.md.
 */

/** Forms of the same answer that should all be accepted. */
function normalise(raw: string): string {
  return (
    raw
      .toLowerCase()
      .trim()
      // Unicode minus and dashes to ASCII.
      .replace(/[−–—]/g, '-')
      // "1 350" and "1,350" are both 1350.
      .replace(/(\d)[  ,](?=\d{3}\b)/g, '$1')
      // Currency and the trailing "p" of "50p" are noise once the value matches.
      .replace(/£/g, '')
      // "2 : 3" -> "2:3", "1 / 2" -> "1/2"
      .replace(/\s*([:/])\s*/g, '$1')
      // Degrees, squared and cubed markers.
      .replace(/°c\b/g, 'degc')
      .replace(/[°]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Trailing unit, if any: "350 cm" -> "cm". */
function unitOf(s: string): string {
  const m = normalise(s).match(/[a-z²³]+$/)
  return m ? m[0] : ''
}

/** Numeric value if the whole answer is a number: "43.20" -> 43.2. */
function numberOf(s: string): number | null {
  const cleaned = normalise(s).replace(/[a-z²³]+$/, '').trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

/**
 * Does `typed` mean the same as `expected`?
 *
 * Deliberately generous about presentation (spacing, £, trailing zeros, a
 * missing unit) and strict about substance (a different number, a wrong unit).
 */
export function matches(typed: string, expected: string, accept: string[] = []): boolean {
  const t = normalise(typed)
  if (t === '') return false
  for (const alt of [expected, ...accept]) {
    if (t === normalise(alt)) return true
  }

  const want = numberOf(expected)
  const got = numberOf(typed)
  if (want !== null && got !== null && Math.abs(want - got) < 1e-9) {
    // The value is right. A unit is optional, but a *wrong* one is not.
    const wantUnit = unitOf(expected)
    const gotUnit = unitOf(typed)
    return gotUnit === '' || gotUnit === wantUnit
  }
  return false
}

// ---------------------------------------------------------------------------

let pass = 0
let fail = 0
const failures: string[] = []

function expect(typed: string, expected: string, want: boolean, accept: string[] = []) {
  const got = matches(typed, expected, accept)
  if (got === want) pass += 1
  else {
    fail += 1
    failures.push(
      `  typed ${JSON.stringify(typed)} vs answer ${JSON.stringify(expected)} — expected ${want ? 'accept' : 'reject'}, got ${got ? 'accept' : 'reject'}`,
    )
  }
}

console.log('\n== presentation should not matter ==')
expect('35000', '35 000', true)
expect('35,000', '35 000', true)
expect('35 000', '35 000', true)
expect('£43.20', '£43.20', true)
expect('43.20', '£43.20', true)
expect('43.2', '£43.20', true)
expect('350cm', '350 cm', true)
expect('350', '350 cm', true)
expect('  24  ', '24', true)
expect('70', '70°', true)
expect('2:3', '2 : 3', true)
expect('1/2', '1/2', true)
expect('-8', '−8', true)

console.log('== substance should matter ==')
expect('3500', '35 000', false)
expect('43.02', '£43.20', false)
expect('350 mm', '350 cm', false) // right number, wrong unit
expect('', '24', false)
expect('3:2', '2 : 3', false)

console.log('== words ==')
expect('Sunday', 'Sunday', true)
expect('sunday', 'Sunday', true)
expect(' EPH ', 'EPH', true)
expect('shelves', 'shelves', true)
expect('shelfs', 'shelves', false)

console.log('== where pure normalisation is NOT enough ==')
// These are the cases that force a per-question `accept` list.
expect('two thirds', '2/3', true, ['two thirds']) // words for a fraction
expect('4/8', '1/2', false) // equivalent, but the question asked to simplify
expect('7:25am', '07:25', true, ['7:25', '7:25am', '7.25'])
expect('7.25', '07:25', true, ['7:25', '7:25am', '7.25'])
expect('25 past 7', '07:25', true, ['25 past 7'])
expect('half', '1/2', true, ['half', 'a half'])
expect('five', '5', true, ['five'])

// Prove the point: how many of those last cases fail without an accept list?
const needAccept: [string, string, string[]][] = [
  ['two thirds', '2/3', ['two thirds']],
  ['7:25am', '07:25', ['7:25', '7:25am', '7.25']],
  ['7.25', '07:25', ['7:25', '7:25am', '7.25']],
  ['25 past 7', '07:25', ['25 past 7']],
  ['half', '1/2', ['half', 'a half']],
  ['five', '5', ['five']],
]
const rescued = needAccept.filter(
  ([typed, expected, accept]) => !matches(typed, expected) && matches(typed, expected, accept),
)
console.log(
  `  ${rescued.length} of ${needAccept.length} of these are wrongly REJECTED without a per-question accept list`,
)

console.log(`\n${pass} passed, ${fail} failed`)
if (failures.length > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(f)
}

// ---------------------------------------------------------------------------
// How much of the bank could take a written answer as it stands?

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
interface Q {
  id: string
  subject: string
  question: string
  options: string[]
  answer: number
}
const bank: Q[] = ['maths', 'english', 'verbal-reasoning'].flatMap(
  (f) => JSON.parse(readFileSync(join(dataDir, `${f}.json`), 'utf8')) as Q[],
)

/** A stem that points at the options cannot be asked without them. */
const needsOptions = (q: Q) => /\b(which|these|the following|odd one out)\b/i.test(q.question)
/** Free text only works when there is one short, unambiguous string to type. */
const typeable = (q: Q) => {
  const a = q.options[q.answer]
  return a.length <= 24 && !/[.!?]$/.test(a) && a.split(/\s+/).length <= 3
}

console.log('\n== how much of the bank could convert ==')
for (const subject of ['maths', 'english', 'verbal-reasoning']) {
  const qs = bank.filter((q) => q.subject === subject)
  const ready = qs.filter((q) => !needsOptions(q) && typeable(q))
  console.log(
    `  ${subject.padEnd(17)} ${String(ready.length).padStart(3)} / ${qs.length} usable as written answers without rewriting`,
  )
}
const ready = bank.filter((q) => !needsOptions(q) && typeable(q))
console.log(`  ${'TOTAL'.padEnd(17)} ${ready.length} / ${bank.length}`)
