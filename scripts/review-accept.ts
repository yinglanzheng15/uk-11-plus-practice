/**
 * Marks every question currently in the bank as reviewed.
 *
 *   npm run review:accept
 *
 * After this, `npm run review -- new` shows only questions added since. That
 * way a growing bank never means re-reading the same questions.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')
const seenFile = join(here, '..', 'docs', '.review-seen')

const ids: string[] = []
for (const file of readdirSync(dataDir).filter((f) => f.endsWith('.json') && f !== 'passages.json')) {
  const qs = JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as { id: string }[]
  ids.push(...qs.map((q) => q.id))
}

ids.sort()
writeFileSync(seenFile, ids.join('\n') + '\n', 'utf8')
console.log(`Marked ${ids.length} question(s) as reviewed in docs/.review-seen`)
