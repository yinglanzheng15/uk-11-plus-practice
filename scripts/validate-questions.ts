/**
 * Question-bank validator.
 *
 *   npm run validate
 *
 * Runs as the first step of `npm run build`, so a broken bank can never be
 * deployed. Errors fail the build; warnings are printed but do not.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shuffleOptions } from '../src/data/shuffle'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')

const VALID_SUBJECTS = ['maths', 'english', 'verbal-reasoning']
/** Matched to the papers these schools actually set — see docs/question-format.md. */
const OPTIONS_PER_QUESTION = 5
const REQUIRED_FIELDS = [
  'id',
  'subject',
  'topic',
  'skill',
  'type',
  'difficulty',
  'question',
  'options',
  'answer',
  'explanation',
  'learningPoint',
  'tags',
] as const

interface Question {
  id: string
  subject: string
  topic: string
  skill: string
  type: string
  difficulty: number
  passageId?: string
  question: string
  options: string[]
  answer: number
  explanation: string
  distractorNotes?: string[]
  learningPoint: string
  followUpIds?: string[]
  tags: string[]
  /**
   * Optional arithmetic expression that must evaluate to the correct option.
   * Lets the validator independently prove a maths answer rather than trusting
   * the author. E.g. "96 / 8 * 5" for "5/8 of 96".
   */
  verify?: string
}

/** Americanisms the spec explicitly rules out, plus common US spellings. */
const US_USAGE: [RegExp, string][] = [
  [/\bmath\b/i, 'use "maths"'],
  [/\bsoccer\b/i, 'use "football"'],
  [/\b(\d+(st|nd|rd|th)\s+)?grade\b/i, 'use "year group" / "Year 6"'],
  [/\bcolor(s|ed|ing)?\b/i, 'use "colour"'],
  [/\bfavorite\b/i, 'use "favourite"'],
  [/\bneighbor(s|hood)?\b/i, 'use "neighbour"'],
  [/\bcenter(s|ed)?\b/i, 'use "centre"'],
  [/\bmeter(s)?\b/i, 'use "metre"'],
  [/\bliter(s)?\b/i, 'use "litre"'],
  [/\bgray\b/i, 'use "grey"'],
  [/\bpractic(e|ing)\b(?=\s+(the|your|a)\b)/i, 'check practise (verb) vs practice (noun)'],
  [/\brecogniz|organiz|realiz|apologiz/i, 'use -ise spelling'],
  [/\$\d/, 'use £ for money'],
  [/\bcell phone\b/i, 'use "mobile phone"'],
  [/\bvacation\b/i, 'use "holiday"'],
  [/\bfall\b(?=\s+(season|term))/i, 'use "autumn"'],
]

/**
 * Evaluate a restricted arithmetic expression. Only digits and the four
 * operations are permitted, so there is no code-execution surface even though
 * this is a build-time-only script.
 */
function evaluateArithmetic(expr: string): number | null {
  if (!/^[\d\s+\-*/().]+$/.test(expr)) return null
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${expr});`)() as unknown
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Pull a number out of an option such as "£1 350.50", "36 cm²" or "−7 °C".
 * Returns null when the option isn't a plain number (e.g. a fraction "5/8").
 */
function numericValue(option: string): number | null {
  const cleaned = option
    .replace(/[£%,]/g, '')
    .replace(/[−–—]/g, '-') // unicode minus / dashes
    .replace(/(\d)\s+(?=\d{3}\b)/g, '$1') // "1 350" -> "1350"
    .replace(/[^\d.\-]/g, '')
    .trim()
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** The trailing unit of an option, e.g. "cm²" from "54 cm²". */
function unitOf(option: string): string {
  const m = option.trim().match(/[a-zA-Z°²³]+$/)
  return m ? m[0].toLowerCase() : ''
}

const errors: string[] = []
const warnings: string[] = []

/**
 * Loose normalisation for spotting near-duplicate question stems. Deliberately
 * NOT used for comparing options: punctuation, minus signs and decimal points
 * are exactly what distinguishes options in punctuation and number questions.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim()
}

/**
 * Options are compared almost exactly. Case is significant: punctuation
 * questions often distinguish options by a single capital letter.
 */
function normaliseOption(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

// ---- Load ----------------------------------------------------------------

const bankFiles = readdirSync(dataDir).filter(
  (f) => f.endsWith('.json') && f !== 'passages.json',
)

const questions: Question[] = []
for (const file of bankFiles) {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
  } catch (e) {
    errors.push(`${file}: not valid JSON — ${(e as Error).message}`)
    continue
  }
  if (!Array.isArray(parsed)) {
    errors.push(`${file}: expected an array of questions`)
    continue
  }
  questions.push(...(parsed as Question[]))
}

let passageIds = new Set<string>()
try {
  const passages = JSON.parse(
    readFileSync(join(dataDir, 'passages.json'), 'utf8'),
  ) as { id: string }[]
  passageIds = new Set(passages.map((p) => p.id))
} catch (e) {
  errors.push(`passages.json: could not be read — ${(e as Error).message}`)
}

// ---- Per-question checks -------------------------------------------------

const seenIds = new Set<string>()
const seenText = new Map<string, string>()
const allIds = new Set(questions.map((q) => q.id))

for (const q of questions) {
  const label = q.id ?? '(question with no id)'

  for (const field of REQUIRED_FIELDS) {
    const value = q[field]
    if (value === undefined || value === null || value === '') {
      errors.push(`${label}: missing required field "${field}"`)
    }
  }

  if (q.id) {
    if (seenIds.has(q.id)) errors.push(`${q.id}: duplicate id`)
    seenIds.add(q.id)
  }

  if (q.subject && !VALID_SUBJECTS.includes(q.subject)) {
    errors.push(`${label}: invalid subject "${q.subject}"`)
  }

  if (![1, 2, 3, 4].includes(q.difficulty)) {
    errors.push(`${label}: difficulty must be 1, 2, 3 or 4 (found ${q.difficulty})`)
  }

  if (Array.isArray(q.options)) {
    // Real 11+ papers offer five answers, not four. A guess is then worth 20%
    // rather than 25%, and eliminating two still leaves three to choose from.
    if (q.options.length !== OPTIONS_PER_QUESTION) {
      errors.push(
        `${label}: has ${q.options.length} options — every question needs exactly ${OPTIONS_PER_QUESTION}`,
      )
    }
    const lowered = q.options.map((o) => normaliseOption(String(o)))
    if (new Set(lowered).size !== lowered.length) {
      errors.push(`${label}: duplicate options`)
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
      errors.push(`${label}: answer index ${q.answer} is out of range`)
    }
    // An answer far longer than every distractor is a giveaway.
    const lengths = q.options.map((o) => String(o).length)
    const correctLength = lengths[q.answer] ?? 0
    const longestOther = Math.max(
      ...lengths.filter((_, i) => i !== q.answer),
      0,
    )
    if (correctLength > longestOther * 1.8 && correctLength - longestOther > 12) {
      warnings.push(
        `${label}: the correct option is much longer than the others — this can give the answer away`,
      )
    }
  } else if (q.options !== undefined) {
    errors.push(`${label}: options must be an array`)
  }

  if (q.distractorNotes && Array.isArray(q.options)) {
    if (q.distractorNotes.length !== q.options.length) {
      errors.push(
        `${label}: distractorNotes has ${q.distractorNotes.length} entries but there are ${q.options.length} options`,
      )
    }
  }

  if (q.explanation && q.explanation.trim().length < 20) {
    warnings.push(`${label}: explanation looks too short to be useful`)
  }

  // --- Machine-verified arithmetic ------------------------------------------
  if (q.verify) {
    const expected = evaluateArithmetic(q.verify)
    if (expected === null) {
      errors.push(`${label}: verify "${q.verify}" is not a valid arithmetic expression`)
    } else if (Array.isArray(q.options) && q.options[q.answer] !== undefined) {
      const actual = numericValue(String(q.options[q.answer]))
      if (actual === null) {
        errors.push(
          `${label}: verify is set but the correct option "${q.options[q.answer]}" is not numeric`,
        )
      } else if (Math.abs(actual - expected) > 1e-6) {
        errors.push(
          `${label}: verify "${q.verify}" = ${expected}, but the marked answer is ${actual}`,
        )
      }
    }
  }

  // --- Option consistency ---------------------------------------------------
  if (Array.isArray(q.options) && q.options.length > 0) {
    const numeric = q.options.map((o) => numericValue(String(o)))
    const numericCount = numeric.filter((n) => n !== null).length
    // A lone number among words (or vice versa) stands out and gives the game away.
    if (numericCount > 0 && numericCount < q.options.length) {
      const oddOnesOut = numericCount === 1 || numericCount === q.options.length - 1
      if (oddOnesOut && !q.passageId) {
        warnings.push(
          `${label}: options mix numeric and non-numeric values, which can make one stand out`,
        )
      }
    }
    // Units should match across options: "36 cm" vs "36 cm²" is a real distinction,
    // but only one option carrying a unit is a giveaway.
    const units = q.options.map((o) => unitOf(String(o))).filter((u) => u !== '')
    if (units.length > 0 && units.length < q.options.length && numericCount > 1) {
      warnings.push(
        `${label}: some options carry a unit and others do not — check for an accidental clue`,
      )
    }
  }

  // --- Distractor notes -----------------------------------------------------
  if (q.distractorNotes) {
    const filled = q.distractorNotes.filter((n) => n && n.trim() !== '')
    if (new Set(filled.map(normalise)).size !== filled.length) {
      warnings.push(`${label}: two distractor notes are identical`)
    }
    if (q.distractorNotes[q.answer] && q.distractorNotes[q.answer].trim() !== '') {
      warnings.push(
        `${label}: the correct option has a distractor note; it should be an empty string`,
      )
    }
  }

  // --- UK English -----------------------------------------------------------
  const prose = [q.question, q.explanation, q.learningPoint, ...(q.options ?? [])]
    .filter(Boolean)
    .join(' ')
  for (const [pattern, advice] of US_USAGE) {
    if (pattern.test(prose)) {
      // "fall" and "grade" have innocent uses; those patterns are already narrowed.
      errors.push(`${label}: American usage found (${pattern.source}) — ${advice}`)
    }
  }

  if (q.passageId && !passageIds.has(q.passageId)) {
    errors.push(`${label}: passageId "${q.passageId}" does not exist`)
  }

  for (const id of q.followUpIds ?? []) {
    if (!allIds.has(id)) errors.push(`${label}: followUpIds references unknown id "${id}"`)
    if (id === q.id) errors.push(`${label}: followUpIds references itself`)
  }

  if (q.question) {
    // Stems such as "Which word is the odd one out?" are legitimately reused,
    // so a duplicate only counts when the options match as well.
    const key = `${normalise(q.question)}|${(q.options ?? [])
      .map((o) => normaliseOption(String(o)))
      .sort()
      .join('~')}`
    const previous = seenText.get(key)
    if (previous) {
      errors.push(`${label}: question and options duplicate ${previous}`)
    } else {
      seenText.set(key, label)
    }
  }

  if (Array.isArray(q.tags) && q.tags.length === 0) {
    warnings.push(`${label}: has no tags`)
  }
}

// ---- Bank-level checks ---------------------------------------------------

// Questions are authored with the correct answer first and permuted at load
// time, so this checks the distribution the child actually sees.
const answerCounts = new Map<number, number>()
for (const q of questions) {
  if (!Number.isInteger(q.answer) || !Array.isArray(q.options)) continue
  const served = shuffleOptions(q)
  answerCounts.set(served.answer, (answerCounts.get(served.answer) ?? 0) + 1)
}
for (const [index, count] of answerCounts) {
  const share = count / questions.length
  if (share > 0.6) {
    warnings.push(
      `Answer position ${index} is correct for ${Math.round(share * 100)}% of questions — consider varying it`,
    )
  }
}

// Foundation questions matter: the difficulty ceiling drops when a child is
// struggling, and the learning loop prefers an easier follow-up after a
// mistake. Without difficulty-1 questions there is nothing to drop to.
const MIN_FOUNDATION_SHARE = 0.12
for (const subject of VALID_SUBJECTS) {
  const inSubject = questions.filter((q) => q.subject === subject)
  if (inSubject.length === 0) continue
  const foundation = inSubject.filter((q) => q.difficulty === 1).length
  const share = foundation / inSubject.length
  if (share < MIN_FOUNDATION_SHARE) {
    warnings.push(
      `${subject}: only ${foundation}/${inSubject.length} questions are difficulty 1 ` +
        `(${Math.round(share * 100)}%) — aim for at least ${Math.round(MIN_FOUNDATION_SHARE * 100)}%`,
    )
  }
}

// Thin topics recycle quickly in topic practice and weak-area sessions.
const MIN_PER_TOPIC = 4
const topicCounts = new Map<string, number>()
for (const q of questions) {
  const key = `${q.subject} · ${q.topic}`
  topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1)
}
for (const [key, count] of [...topicCounts].sort((a, b) => a[1] - b[1])) {
  if (count < MIN_PER_TOPIC) {
    warnings.push(`${key}: only ${count} question(s) — thin for a 10-question topic session`)
  }
}

// Passages should carry enough questions to be worth reading.
const passageUse = new Map<string, number>()
for (const q of questions) {
  if (q.passageId) passageUse.set(q.passageId, (passageUse.get(q.passageId) ?? 0) + 1)
}
for (const id of passageIds) {
  const used = passageUse.get(id) ?? 0
  if (used === 0) warnings.push(`passage "${id}" is not used by any question`)
  else if (used < 3) warnings.push(`passage "${id}": only ${used} question(s) — aim for 4+`)
}

// Copy-pasted learning points suggest questions that teach the same thing twice.
const pointUse = new Map<string, string[]>()
for (const q of questions) {
  if (!q.learningPoint) continue
  const key = normalise(q.learningPoint)
  pointUse.set(key, [...(pointUse.get(key) ?? []), q.id])
}
for (const [, ids] of pointUse) {
  if (ids.length > 2) {
    warnings.push(
      `${ids.length} questions share an identical learning point (${ids.slice(0, 3).join(', ')}…)`,
    )
  }
}

// The learning loop needs a related question to fall back on.
const bySkill = new Map<string, number>()
for (const q of questions) bySkill.set(q.skill, (bySkill.get(q.skill) ?? 0) + 1)
for (const q of questions) {
  const skillCount = bySkill.get(q.skill) ?? 0
  const topicCount = questions.filter(
    (o) => o.subject === q.subject && o.topic === q.topic,
  ).length
  if (skillCount < 2 && topicCount < 2 && (q.followUpIds ?? []).length === 0) {
    warnings.push(
      `${q.id}: no follow-up available (only question with skill "${q.skill}" and topic "${q.topic}")`,
    )
  }
}

// ---- Report --------------------------------------------------------------

const bySubject = new Map<string, number>()
for (const q of questions) bySubject.set(q.subject, (bySubject.get(q.subject) ?? 0) + 1)

console.log(`Checked ${questions.length} questions across ${bankFiles.length} files.`)
for (const [subject, count] of [...bySubject].sort()) {
  console.log(`  ${subject}: ${count}`)
}

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`)
  for (const w of warnings) console.log(`  ! ${w}`)
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`)
  for (const e of errors) console.error(`  x ${e}`)
  process.exit(1)
}

console.log('\nQuestion bank is valid.')
