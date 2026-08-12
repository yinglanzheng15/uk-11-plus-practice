import type { Question } from '../types'

/**
 * How many questions per topic stay in the free, publicly bundled bank.
 *
 * Three per topic across the bank's 33 distinct topics lands just under 100
 * questions — enough for every subject and topic to be genuinely usable and
 * demoable, without giving the paid bank away. Changing the size of the free
 * tier is this one constant.
 *
 * (33, not 45: the generated templates in ./templates.ts deliberately reuse
 * existing topic names rather than inventing parallel ones.)
 */
export const FREE_PER_TOPIC = 3

/** Topic identity. Inlined rather than imported from ./index to avoid a cycle:
 *  index imports free.json, which this partition is what produces. */
function key(q: Question): string {
  return `${q.subject}::${q.topic}`
}

/**
 * Split the authored bank into the free half (bundled with the client) and the
 * paid half (served from an authenticated endpoint).
 *
 * The rule is derived rather than stored — no `free: true` flag to maintain
 * across 434 records, and no chance of the flag drifting out of step with the
 * bank. Easiest questions go free, so the free tier is the on-ramp and the
 * harder material is what a subscription buys.
 *
 * Deterministic: same bank in, same split out, so a child who is mid-way
 * through the free tier does not have questions move under them on a redeploy.
 */
export function partitionBank(questions: readonly Question[]): {
  free: Question[]
  paid: Question[]
} {
  const byTopic = new Map<string, Question[]>()
  for (const q of questions) {
    const list = byTopic.get(key(q)) ?? []
    list.push(q)
    byTopic.set(key(q), list)
  }

  const freeIds = new Set<string>()
  for (const list of byTopic.values()) {
    // id breaks ties so the split never depends on the order the banks concat in.
    const easiestFirst = [...list].sort(
      (a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id),
    )
    for (const q of easiestFirst.slice(0, FREE_PER_TOPIC)) freeIds.add(q.id)
  }

  // Authored order is preserved within each half, so both stay reviewable.
  return {
    free: questions.filter((q) => freeIds.has(q.id)),
    paid: questions.filter((q) => !freeIds.has(q.id)),
  }
}
