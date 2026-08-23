import { QUESTIONS, topicKey } from '../data'
import type { Progress, SubjectId } from '../types'

export interface TopicTiming {
  subject: SubjectId
  topic: string
  key: string
  /** Mean time per answer for this topic, in ms. */
  avgMs: number
  attempts: number
}

/**
 * Mean time per answer, by topic — surfaces which topics take longest, which
 * is often more revealing than accuracy alone: a topic answered quickly but
 * wrongly is a different problem from one answered slowly but rightly.
 *
 * Attempts made before schema 6 carry no timing data (`totalElapsedMs` starts
 * at 0 for them — see storage.ts), so they are excluded rather than dragging
 * the average toward zero.
 */
export function topicTiming(progress: Progress, minAttempts = 2): TopicTiming[] {
  const groups = new Map<string, { subject: SubjectId; topic: string; ids: string[] }>()
  for (const q of QUESTIONS) {
    const key = topicKey(q.subject, q.topic)
    const group = groups.get(key) ?? { subject: q.subject, topic: q.topic, ids: [] }
    group.ids.push(q.id)
    groups.set(key, group)
  }

  const out: TopicTiming[] = []
  for (const [key, group] of groups) {
    let totalMs = 0
    let attempts = 0
    for (const id of group.ids) {
      const r = progress.questions[id]
      if (!r || r.totalElapsedMs <= 0) continue
      totalMs += r.totalElapsedMs
      attempts += r.attempts
    }
    if (attempts < minAttempts) continue
    out.push({
      subject: group.subject,
      topic: group.topic,
      key,
      avgMs: Math.round(totalMs / attempts),
      attempts,
    })
  }
  return out
}
