import { QUESTIONS, topicKey } from '../data'
import type { Progress, SubjectId } from '../types'

export type MasteryBand = 'Needs work' | 'Developing' | 'Good' | 'Strong' | 'Mastered'

export interface TopicMastery {
  subject: SubjectId
  topic: string
  key: string
  /** 0–100, or null when nothing has been attempted yet. */
  score: number | null
  band: MasteryBand | null
  attempts: number
  /** How many of this topic's questions have been answered at least once. */
  coverage: number
  total: number
}

/** Attempts needed before the top two bands can be awarded. */
export const CONFIDENCE_ATTEMPTS = 4

/**
 * One lucky answer is not mastery. Below CONFIDENCE_ATTEMPTS the band is capped
 * at 'Good', so 'Strong' and 'Mastered' always reflect sustained accuracy.
 */
export function bandFor(score: number, attempts = CONFIDENCE_ATTEMPTS): MasteryBand {
  if (score >= 95 && attempts >= CONFIDENCE_ATTEMPTS) return 'Mastered'
  if (score >= 80 && attempts >= CONFIDENCE_ATTEMPTS) return 'Strong'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Developing'
  return 'Needs work'
}

/**
 * Topic mastery: accuracy across the topic's attempted questions, with the most
 * recent attempt on each question weighted more heavily than its history, so
 * that improvement shows up quickly.
 *
 * This is an in-app learning indicator only. It is NOT a standardised score and
 * says nothing about performance in a real 11+ assessment.
 */
export function topicMastery(progress: Progress): TopicMastery[] {
  const groups = new Map<string, { subject: SubjectId; topic: string; ids: string[] }>()
  for (const q of QUESTIONS) {
    const key = topicKey(q.subject, q.topic)
    const group = groups.get(key) ?? { subject: q.subject, topic: q.topic, ids: [] }
    group.ids.push(q.id)
    groups.set(key, group)
  }

  const out: TopicMastery[] = []
  for (const [key, group] of groups) {
    let weighted = 0
    let weight = 0
    let attempts = 0
    let coverage = 0
    for (const id of group.ids) {
      const r = progress.questions[id]
      if (!r) continue
      coverage += 1
      attempts += r.attempts
      // Historical accuracy for this question, weight 1.
      weighted += r.correct / r.attempts
      weight += 1
      // Most recent outcome, weight 1 again — doubles the pull of recent work.
      weighted += r.lastCorrect ? 1 : 0
      weight += 1
    }
    const score = weight === 0 ? null : Math.round((weighted / weight) * 100)
    out.push({
      subject: group.subject,
      topic: group.topic,
      key,
      score,
      band: score === null ? null : bandFor(score, attempts),
      attempts,
      coverage,
      total: group.ids.length,
    })
  }
  return out
}

export function subjectMastery(
  progress: Progress,
): { subject: SubjectId; score: number | null; attempts: number }[] {
  const topics = topicMastery(progress)
  const bySubject = new Map<SubjectId, { sum: number; n: number; attempts: number }>()
  for (const t of topics) {
    const entry = bySubject.get(t.subject) ?? { sum: 0, n: 0, attempts: 0 }
    entry.attempts += t.attempts
    if (t.score !== null) {
      entry.sum += t.score
      entry.n += 1
    }
    bySubject.set(t.subject, entry)
  }
  return [...bySubject.entries()].map(([subject, e]) => ({
    subject,
    score: e.n === 0 ? null : Math.round(e.sum / e.n),
    attempts: e.attempts,
  }))
}

/**
 * Topics needing practice. The 70% threshold is shared with strongestTopics so
 * that a topic can never appear in both lists at once.
 */
export const PRACTISE_THRESHOLD = 70

export function weakestTopics(progress: Progress, limit = 5): TopicMastery[] {
  return topicMastery(progress)
    .filter((t) => t.score !== null && t.attempts >= 2 && t.score < PRACTISE_THRESHOLD)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, limit)
}

export function strongestTopics(progress: Progress, limit = 5): TopicMastery[] {
  return topicMastery(progress)
    .filter((t) => t.score !== null && t.attempts >= 2 && t.score >= PRACTISE_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
}
