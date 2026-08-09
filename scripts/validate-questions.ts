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
    if (q.options.length < 3) {
      errors.push(`${label}: needs at least 3 options`)
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
