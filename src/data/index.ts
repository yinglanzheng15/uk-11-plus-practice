import type { Passage, Question, SubjectId } from '../types'
import maths from './maths.json'
import english from './english.json'
import verbalReasoning from './verbal-reasoning.json'
import nonVerbalReasoning from './non-verbal-reasoning.json'
import passagesJson from './passages.json'
import { SUBJECTS } from './subjects'
import { shuffleOptions } from './shuffle'

/**
 * The bundled question bank. Adding a subject means importing one more JSON
 * file here and adding an entry to SUBJECTS — nothing else changes.
 *
 * Options are permuted deterministically per question id (see ./shuffle.ts) so
 * that the authored "correct answer first" convention never reaches the child.
 */
export const QUESTIONS: readonly Question[] = Object.freeze(
  [
    ...(maths as Question[]),
    ...(english as Question[]),
    ...(verbalReasoning as Question[]),
    ...(nonVerbalReasoning as Question[]),
  ].map(shuffleOptions),
)

export const PASSAGES: readonly Passage[] = Object.freeze(passagesJson as Passage[])

const questionsById = new Map(QUESTIONS.map((q) => [q.id, q]))
const passagesById = new Map(PASSAGES.map((p) => [p.id, p]))

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
