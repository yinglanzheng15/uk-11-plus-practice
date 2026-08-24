/**
 * Turn an exported progress file into a triage list of flagged questions.
 *
 *   npm run triage -- path/to/11-plus-progress-2026-08-24.json
 *
 * A parent gets that file from Parent → Settings → Data → "Download
 * progress" (see src/logic/backup.ts — it is the same file a restore reads).
 * This resolves every question report in it against the *current* bank on
 * disk, not whatever version was bundled into the build the parent was
 * running, and says which file a maintainer would actually need to edit —
 * closing the loop the Feedback tab opens but does not, on its own, finish.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBackup } from '../src/logic/backup'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')

const path = process.argv[2]
if (!path) {
  console.error('Usage: npm run triage -- <path-to-progress-backup.json>')
  console.error('Get one from Parent → Settings → Data → "Download progress".')
  process.exit(1)
}

let text: string
try {
  text = readFileSync(path, 'utf8')
} catch (e) {
  console.error(`Could not read ${path}: ${(e as Error).message}`)
  process.exit(1)
}

const result = parseBackup(text)
if (!result.ok) {
  console.error(result.error)
  process.exit(1)
}

const reports = result.progress.feedback.filter((f) => f.kind === 'question')

if (reports.length === 0) {
  console.log('No question reports in this file.')
  process.exit(0)
}

// Load the current bank, tracking which file each question lives in — the
// same set npm run validate checks, so this always matches what is actually
// on disk right now, not what the parent's build happened to bundle.
const NOT_A_BANK = new Set(['passages.json', 'free.json'])
const bankFiles = readdirSync(dataDir).filter(
  (f) => f.endsWith('.json') && !NOT_A_BANK.has(f),
)

interface BankQuestion {
  id: string
  subject: string
  topic: string
  difficulty: number
  question: string
  options: string[]
  answer: number
}

const byId = new Map<string, { q: BankQuestion; file: string }>()
for (const file of bankFiles) {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
  } catch {
    continue
  }
  if (!Array.isArray(parsed)) continue
  for (const q of parsed as BankQuestion[]) {
    byId.set(q.id, { q, file })
  }
}

const REASON_LABELS: Record<string, string> = {
  'answer-wrong': 'I think the answer is wrong',
  confusing: 'The question was confusing',
  typo: 'There is a spelling or typing mistake',
  'too-hard': 'Too hard',
  'too-easy': 'Too easy',
  other: 'Something else',
}

const sorted = [...reports].sort((a, b) => b.createdAt - a.createdAt)

console.log(
  `${sorted.length} question report${sorted.length === 1 ? '' : 's'}, newest first.\n`,
)

let stale = 0
for (const f of sorted) {
  const entry = f.questionId ? byId.get(f.questionId) : undefined
  const when = new Date(f.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  console.log(
    `— ${f.questionId ?? '(no id)'}  [${REASON_LABELS[f.reason ?? ''] ?? 'Note'}]  ${when}`,
  )
  if (!entry) {
    stale += 1
    console.log('  ⚠ not found in the current bank — already fixed, removed or renamed.')
  } else {
    const { q, file } = entry
    console.log(
      file === 'generated.json'
        ? '  generated — edit its template in src/data/templates.ts, not this file'
        : `  src/data/${file}`,
    )
    console.log(`  ${q.subject} · ${q.topic} (difficulty ${q.difficulty})`)
    console.log(`  Q: ${q.question}`)
    console.log(`  Marked answer: ${q.options[q.answer]}`)
  }
  if (f.message.trim()) console.log(`  Comment: "${f.message.trim()}"`)
  console.log('')
}

if (stale > 0) {
  console.log(
    `${stale} report${stale === 1 ? '' : 's'} reference a question no longer in the bank.`,
  )
}
