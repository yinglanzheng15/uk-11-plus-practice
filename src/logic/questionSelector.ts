import { QUESTIONS, topicKey } from '../data'
import { topicMastery } from './mastery'
import { mistakeIds } from './progress'
import type { Progress, Question, SessionConfig } from '../types'

/** Small deterministic PRNG so a session is reproducible from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SelectionResult {
  questions: Question[]
  /** Set when the pool was too small and constraints had to be relaxed. */
  note?: string
}

/**
 * How highly a question deserves to be served next.
 *
 *   never seen            very high
 *   recently incorrect    high
 *   weak topic            bonus
 *   correct once          low
 *   correct repeatedly    very low
 */
function score(
  q: Question,
  progress: Progress,
  masteryByTopic: Map<string, number | null>,
): number {
  const r = progress.questions[q.id]
  let s: number

  if (!r) {
    s = 100
  } else if (!r.lastCorrect) {
    s = 70
  } else if (r.correct >= 3) {
    s = 4
  } else if (r.correct >= 2) {
    s = 10
  } else {
    s = 22
  }

  // Weak topics get a bonus of up to 30.
  const mastery = masteryByTopic.get(topicKey(q.subject, q.topic))
  if (mastery !== null && mastery !== undefined) {
    s += Math.round(((100 - mastery) / 100) * 30)
  }

  // Older attempts become eligible again as time passes (up to +15 after ~2 weeks).
  if (r) {
    const days = (Date.now() - r.lastSeen) / 86_400_000
    s += Math.min(15, Math.round(days * 1.1))
  }

  return s
}

/**
 * Difficulty ceiling rises with topic mastery, so harder questions are
 * introduced gradually rather than all at once.
 */
function difficultyCeiling(mastery: number | null | undefined): number {
  if (mastery === null || mastery === undefined) return 3
  if (mastery >= 85) return 4
  if (mastery >= 65) return 3
  return 2
}

function poolForMode(config: SessionConfig, progress: Progress): Question[] {
  const subjects = config.subjects
  let pool = QUESTIONS.filter(
    (q) => subjects.length === 0 || subjects.includes(q.subject),
  )
  if (config.topic) pool = pool.filter((q) => q.topic === config.topic)

  switch (config.mode) {
    case 'mistakes': {
      const ids = new Set(mistakeIds(progress))
      return pool.filter((q) => ids.has(q.id))
    }
    case 'weak': {
      const weak = topicMastery(progress)
        .filter((t) => t.score !== null && t.score < 70 && t.attempts >= 2)
        .map((t) => t.key)
      if (weak.length === 0) return []
      const keys = new Set(weak)
      return pool.filter((q) => keys.has(topicKey(q.subject, q.topic)))
    }
    case 'challenge':
      return pool.filter((q) => q.difficulty >= 3)
    default:
      return pool
  }
}

/**
 * Choose the questions for a session.
 *
 * Guarantees: no question appears twice in one session, and recently served
 * questions are avoided unless the pool is too small to fill the session — in
 * which case the constraint is relaxed and a note is returned for the UI.
 */
export function selectQuestions(
  config: SessionConfig,
  progress: Progress,
  seed: number = Date.now(),
): SelectionResult {
  const rand = mulberry32(seed)
  const pool = poolForMode(config, progress)

  if (pool.length === 0) {
    return { questions: [], note: 'empty-pool' }
  }

  const masteryByTopic = new Map(topicMastery(progress).map((t) => [t.key, t.score]))
  const recent = new Set(progress.recentQuestionIds)

  const rank = (list: Question[]) =>
    list
      .map((q) => ({
        q,
        // Jitter keeps consecutive sessions from serving an identical order.
        s: score(q, progress, masteryByTopic) + rand() * 12,
      }))
      .sort((a, b) => b.s - a.s)
      .map((e) => e.q)

  const withinCeiling = pool.filter(
    (q) =>
      q.difficulty <=
      difficultyCeiling(masteryByTopic.get(topicKey(q.subject, q.topic))),
  )

  // Tier 1: unseen recently, within the difficulty ceiling. Tier 2 relaxes the
  // ceiling. Tier 3 allows recently seen questions back in.
  const tier1 = rank(withinCeiling.filter((q) => !recent.has(q.id)))
  const tier2 = rank(pool.filter((q) => !recent.has(q.id)))
  const tier3 = rank(pool)

  const chosen: Question[] = []
  const used = new Set<string>()
  for (const tier of [tier1, tier2, tier3]) {
    for (const q of tier) {
      if (chosen.length >= config.length) break
      if (used.has(q.id)) continue
      used.add(q.id)
      chosen.push(q)
    }
    if (chosen.length >= config.length) break
  }

  const note =
    chosen.length < config.length
      ? 'short-pool'
      : tier1.length < config.length
        ? 'relaxed'
        : undefined

  // For mixed sessions, interleave subjects so the child is not given all the
  // maths first — but keep the ranked order within each subject.
  const questions =
    config.subjects.length === 1 ? chosen : interleaveBySubject(chosen)

  return { questions, note }
}

function interleaveBySubject(questions: Question[]): Question[] {
  const buckets = new Map<string, Question[]>()
  for (const q of questions) {
    const list = buckets.get(q.subject) ?? []
    list.push(q)
    buckets.set(q.subject, list)
  }
  const lists = [...buckets.values()]
  const out: Question[] = []
  let i = 0
  while (out.length < questions.length) {
    const list = lists[i % lists.length]
    const next = list.shift()
    if (next) out.push(next)
    i += 1
    if (lists.every((l) => l.length === 0)) break
  }
  return out
}

/**
 * Pick a follow-up question for the wrong-answer learning loop.
 *
 * Prefers an explicit `followUpIds` entry, then the nearest unused question
 * sharing the same skill, then the same topic. Returns undefined only when the
 * bank genuinely has nothing related left.
 */
export function selectFollowUp(
  question: Question,
  excludeIds: Set<string>,
): Question | undefined {
  for (const id of question.followUpIds ?? []) {
    if (!excludeIds.has(id)) {
      const q = QUESTIONS.find((c) => c.id === id)
      if (q) return q
    }
  }

  const candidates = QUESTIONS.filter(
    (q) => q.id !== question.id && !excludeIds.has(q.id),
  )

  const bySkill = candidates
    .filter((q) => q.skill === question.skill)
    .sort(
      (a, b) =>
        Math.abs(a.difficulty - question.difficulty) -
        Math.abs(b.difficulty - question.difficulty),
    )
  if (bySkill.length > 0) return bySkill[0]

  // A slightly easier question is the better teaching choice after a mistake.
  const byTopic = candidates
    .filter((q) => q.subject === question.subject && q.topic === question.topic)
    .sort((a, b) => a.difficulty - b.difficulty)
  if (byTopic.length > 0) return byTopic[0]

  // Last resort: anything in the same subject at a similar level. Better to
  // keep the child practising than to abandon the learning loop entirely.
  return candidates
    .filter(
      (q) => q.subject === question.subject && q.difficulty <= question.difficulty,
    )
    .sort((a, b) => b.difficulty - a.difficulty)[0]
}
