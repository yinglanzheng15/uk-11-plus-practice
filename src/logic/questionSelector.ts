import { QUESTIONS, topicKey } from '../data'
import { topicMastery } from './mastery'
import { paperFor, sectionTopicKeys } from './papers'
import { mistakeIds } from './progress'
import type { Progress, Question, QuestionRecord, SessionConfig } from '../types'

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

const DAY_MS = 86_400_000

/**
 * The spaced-repetition ladder, indexed by consecutive-correct streak.
 *
 * A question answered correctly once comes back the next day, then after three
 * days, a week, three weeks. Getting it wrong resets the streak to 0, so it is
 * due immediately. These are the conventional Leitner-style intervals, and they
 * suit the app's stated aim of retention over volume.
 */
export const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 21]

export function intervalDaysFor(streak: number): number {
  const i = Math.min(Math.max(streak, 0), REVIEW_INTERVAL_DAYS.length - 1)
  return REVIEW_INTERVAL_DAYS[i]
}

/** Epoch ms at which a question is scheduled to come round again. */
export function dueAt(record: QuestionRecord): number {
  if (!record.lastCorrect) return record.lastSeen
  return record.lastSeen + intervalDaysFor(record.streak) * DAY_MS
}

export function isDue(record: QuestionRecord, now: number = Date.now()): boolean {
  return now >= dueAt(record)
}

/**
 * How highly a question deserves to be served next.
 *
 *   never seen            very high
 *   recently incorrect    high
 *   due for review        moderate, rising the longer it is overdue
 *   not yet due           very low — but never zero, so a small bank still works
 *   weak topic            bonus on top
 *
 * Scheduling, rather than a flat "prefer older" rule, is what makes this spaced
 * repetition: a question answered right three times running is deliberately
 * left alone for a week even though it is the oldest thing in the bank.
 */
function score(
  q: Question,
  progress: Progress,
  masteryByTopic: Map<string, number | null>,
  now: number,
): number {
  const r = progress.questions[q.id]
  let s: number

  if (!r) {
    s = 100
  } else if (!r.lastCorrect) {
    s = 70
  } else {
    const interval = intervalDaysFor(r.streak)
    const elapsed = (now - r.lastSeen) / DAY_MS
    // interval is 0 only for streak 0, which lastCorrect rules out here.
    const ratio = interval === 0 ? 1 : elapsed / interval
    s =
      ratio >= 1
        ? // Due. Overdue questions climb, but never above a fresh one.
          40 + Math.min(25, (ratio - 1) * 20)
        : // Not due. Kept in the pool as a fallback, but well down the order.
          2 + ratio * 10
  }

  // Weak topics get a bonus of up to 30.
  const mastery = masteryByTopic.get(topicKey(q.subject, q.topic))
  if (mastery !== null && mastery !== undefined) {
    s += Math.round(((100 - mastery) / 100) * 30)
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
  if (config.topicKeys?.length) {
    const keys = new Set(config.topicKeys)
    pool = pool.filter((q) => keys.has(topicKey(q.subject, q.topic)))
  }

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
  now: number = Date.now(),
): SelectionResult {
  if (config.mode === 'paper') return selectPaper(config, progress, seed, now)

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
        s: score(q, progress, masteryByTopic, now) + rand() * 12,
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

/**
 * Fill a full paper section by section, in the booklet's own order.
 *
 * Each section is just an ordinary single-subject selection restricted to that
 * section's topics, so every rule the rest of the app relies on — spaced
 * repetition, the difficulty ceiling, avoiding recently served questions —
 * applies unchanged within it. What a paper adds is the *quota*: a run of 50
 * that happens to contain no geometry is not a maths paper, however well the
 * questions were chosen.
 *
 * Sections are never interleaved. Sitting a whole section before moving on is
 * part of what the child is rehearsing.
 */
function selectPaper(
  config: SessionConfig,
  progress: Progress,
  seed: number,
  now: number,
): SelectionResult {
  const paper = paperFor(config.subjects[0])
  if (!paper) return { questions: [], note: 'empty-pool' }

  const questions: Question[] = []
  let short = false
  paper.sections.forEach((section, i) => {
    const result = selectQuestions(
      {
        mode: 'subject',
        length: section.count,
        subjects: [paper.subject],
        topicKeys: sectionTopicKeys(paper, section),
        timed: false,
      },
      progress,
      // A per-section seed, or every section would draw the same jitter.
      seed + i * 7919,
      now,
    )
    // A thin section shortens the paper rather than failing it — the child
    // still sits a real run, and the summary reports what was actually served.
    if (result.questions.length < section.count) short = true
    questions.push(...result.questions)
  })

  if (questions.length === 0) return { questions: [], note: 'empty-pool' }
  return { questions, note: short ? 'short-pool' : undefined }
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
