import type { Passage, Question, SubjectId } from '../types'
import free from './free.json'
import passagesJson from './passages.json'
import { SUBJECTS } from './subjects'
import { shuffleOptions } from './shuffle'

/**
 * The question bank.
 *
 * Only the free half is bundled with the client; the paid half arrives at
 * runtime (see ./access.ts for the split rule and scripts/split-bank.ts for the
 * build step). src/main.tsx awaits loadPaidQuestions() before the first render,
 * so every consumer below can go on treating the bank as a plain synchronous
 * array — none of them needed changing for this.
 *
 * Options are permuted deterministically per question id (see ./shuffle.ts) so
 * that the authored "correct answer first" convention never reaches the child.
 */
export let QUESTIONS: readonly Question[] = Object.freeze(
  (free as Question[]).map(shuffleOptions),
)

export const PASSAGES: readonly Passage[] = Object.freeze(passagesJson as Passage[])

let questionsById = new Map(QUESTIONS.map((q) => [q.id, q]))
const passagesById = new Map(PASSAGES.map((p) => [p.id, p]))

/**
 * Merge the paid half into the bank. Idempotent, and ignores any question whose
 * id is already present, so a double load or an overlapping server response
 * cannot duplicate a question into a session.
 *
 * Exported separately from the fetch so that Node — the smoke test — can supply
 * the bank from disk without a network or a DOM.
 */
export function installPaidQuestions(questions: Question[]): number {
  const added = questions
    .filter((q) => !questionsById.has(q.id))
    .map(shuffleOptions)
  if (added.length === 0) return 0
  QUESTIONS = Object.freeze([...QUESTIONS, ...added])
  questionsById = new Map(QUESTIONS.map((q) => [q.id, q]))
  return added.length
}

/**
 * Fetch and install the paid half.
 *
 * Today this reads public/paid.json, which the build emits — so the deployed
 * app is still the whole bank, free to everyone, exactly as before the split.
 * Setting VITE_PAID_BANK_URL to an authenticated endpoint is what turns this
 * into the paywall; nothing else in the app has to change.
 *
 * Never throws. A child who is offline, or whose subscription has lapsed, gets
 * the free bank and a working app rather than a blank screen.
 */
export async function loadPaidQuestions(): Promise<number> {
  const url =
    import.meta.env.VITE_PAID_BANK_URL ?? `${import.meta.env.BASE_URL}paid.json`
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return 0
    const body: unknown = await res.json()
    if (!Array.isArray(body)) return 0
    return installPaidQuestions(body as Question[])
  } catch {
    return 0
  }
}

export function getQuestion(id: string): Question | undefined {
  return questionsById.get(id)
}

export function getPassage(id: string | undefined): Passage | undefined {
  return id ? passagesById.get(id) : undefined
}

export function questionsForSubject(subject: SubjectId): Question[] {
  return QUESTIONS.filter((q) => q.subject === subject)
}

/** Distinct topics for a subject, in the order they first appear in the bank. */
export function topicsForSubject(subject: SubjectId): string[] {
  const seen: string[] = []
  for (const q of QUESTIONS) {
    if (q.subject === subject && !seen.includes(q.topic)) seen.push(q.topic)
  }
  return seen
}

/** Every (subject, topic) pair present in the bank. */
export function allTopics(): { subject: SubjectId; topic: string }[] {
  return SUBJECTS.flatMap((s) =>
    topicsForSubject(s.id).map((topic) => ({ subject: s.id, topic })),
  )
}

export function topicKey(subject: SubjectId, topic: string): string {
  return `${subject}::${topic}`
}
