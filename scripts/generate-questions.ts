/**
 * Expand `src/data/templates.ts` into `src/data/generated.json`.
 *
 *   npm run generate
 *
 * Runs as the first step of `npm run build`, so the committed JSON can never
 * drift from the templates. The output is an ordinary bank file: the validator
 * picks it up automatically and the review sheet shows it like any other.
 *
 * Seeds are derived from the template id and the variant number, so the same
 * template always produces the same questions — ids stay stable and so does a
 * child's progress. Editing a template's `build` deliberately re-rolls its
 * variants; their ids survive but their numbers change, which is the honest
 * trade for keeping generation reproducible.
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEMPLATES, type Rand, type Variant } from '../src/data/templates'
import { hashString, seededRandom } from '../src/data/shuffle'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = join(here, '..', 'src', 'data', 'generated.json')

function rng(seed: string): Rand {
  const next = seededRandom(hashString(seed))
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return { int, pick: (items) => items[int(0, items.length - 1)] }
}

/** A variant is only usable if its five options are genuinely distinct. */
function optionsAreDistinct(v: Variant): boolean {
  return new Set(v.options.map((o) => o.trim())).size === v.options.length
}

const seenQuestions = new Set<string>()
const out: Record<string, unknown>[] = []
let discarded = 0

for (const t of TEMPLATES) {
  let made = 0
  // Collisions are expected — keep drawing fresh seeds until the template has
  // produced `count` usable variants, or has clearly run out of room.
  for (let attempt = 0; made < t.count && attempt < t.count * 30; attempt += 1) {
    let v: Variant
    try {
      v = t.build(rng(`${t.id}#${attempt}`))
    } catch {
      discarded += 1
      continue
    }
    const key = v.question.trim().toLowerCase()
    if (seenQuestions.has(key) || !optionsAreDistinct(v)) {
      discarded += 1
      continue
    }
    seenQuestions.add(key)
    made += 1
    out.push({
      id: `${t.id}-v${String(made).padStart(2, '0')}`,
      subject: t.subject,
      topic: t.topic,
      skill: t.skill,
      type: t.type,
      difficulty: v.difficulty ?? t.difficulty,
      question: v.question,
      options: v.options,
      answer: 0,
      explanation: v.explanation,
      ...(v.distractorNotes ? { distractorNotes: v.distractorNotes } : {}),
      learningPoint: v.learningPoint,
      ...(v.verify ? { verify: v.verify } : {}),
      tags: t.tags,
    })
  }
  if (made < t.count) {
    console.warn(`${t.id}: only ${made} of ${t.count} variants were distinct enough to keep`)
  }
  console.log(`${t.id}: ${made} variants`)
}

writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
console.log(
  `Wrote ${out.length} generated questions from ${TEMPLATES.length} templates (${discarded} draws discarded).`,
)
