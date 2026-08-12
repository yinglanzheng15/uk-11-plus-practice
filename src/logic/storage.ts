import type { Progress, QuestionRecord } from '../types'

/** Generous rather than pressured — the pace a child starts with. */
export const DEFAULT_SECONDS_PER_QUESTION = 45

const KEY = 'elevenplus:v1:progress'
/**
 * 2 added `streak` to QuestionRecord for spaced repetition.
 * 3 added `preferences.secondsPerQuestion`.
 * 4 added `preferences.mixedSubjects`.
 * 5 renamed it to `preferences.practiceSubjects` (it now governs quick
 *   sessions too) and added `preferences.practiceTopics`.
 */
export const SCHEMA_VERSION = 5

export function emptyProgress(): Progress {
  return {
    version: SCHEMA_VERSION,
    questions: {},
    recentQuestionIds: [],
    sessions: [],
    feedback: [],
    streak: { lastDate: null, current: 0, best: 0 },
    totals: { answered: 0, correct: 0 },
    preferences: {
      timed: false,
      secondsPerQuestion: DEFAULT_SECONDS_PER_QUESTION,
      practiceSubjects: [],
      practiceTopics: {},
    },
  }
}

/**
 * Migrate an older stored shape forward. Kept deliberately simple: unknown or
 * damaged data falls back to a fresh profile rather than crashing the app.
 */
/**
 * Records written before schema 2 have no `streak`. Rather than guess at a
 * history we do not have, a question last answered correctly starts one rung up
 * the review ladder — it comes back tomorrow instead of immediately.
 */
function migrateQuestions(
  questions: Record<string, QuestionRecord> | undefined,
): Record<string, QuestionRecord> {
  if (!questions) return {}
  const out: Record<string, QuestionRecord> = {}
  for (const [id, r] of Object.entries(questions)) {
    out[id] =
      typeof r?.streak === 'number' ? r : { ...r, streak: r?.lastCorrect ? 1 : 0 }
  }
  return out
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The chosen practice subjects, accepting the schema-4 `mixedSubjects` name so
 * that upgrading does not silently reset a child's selection.
 *
 * Shared with the backup importer, which reads hand-editable files and so has
 * exactly the same problem.
 */
export function readSubjects(preferences: unknown): string[] {
  if (!isPlainObject(preferences)) return []
  const current = preferences.practiceSubjects
  if (Array.isArray(current)) return current
  const legacy = preferences.mixedSubjects
  return Array.isArray(legacy) ? legacy : []
}

function migrate(raw: unknown): Progress {
  const base = emptyProgress()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<Progress>
  return {
    ...base,
    ...data,
    version: SCHEMA_VERSION,
    questions: migrateQuestions(data.questions),
    recentQuestionIds: data.recentQuestionIds ?? base.recentQuestionIds,
    sessions: data.sessions ?? base.sessions,
    // Added after the first release; older saved profiles will not have it.
    feedback: data.feedback ?? base.feedback,
    streak: { ...base.streak, ...data.streak },
    totals: { ...base.totals, ...data.totals },
    preferences: {
      ...base.preferences,
      ...data.preferences,
      // Added in schema 3; also repairs a damaged value rather than producing
      // a session with a nonsensical time limit.
      secondsPerQuestion:
        typeof data.preferences?.secondsPerQuestion === 'number' &&
        data.preferences.secondsPerQuestion > 0
          ? data.preferences.secondsPerQuestion
          : DEFAULT_SECONDS_PER_QUESTION,
      // Added in schema 4 as `mixedSubjects`, renamed in schema 5. A profile
      // saved at v4 keeps whatever subjects the child had already chosen.
      practiceSubjects: readSubjects(data.preferences),
      // Added in schema 5; older saved profiles will not have it.
      practiceTopics:
        isPlainObject(data.preferences?.practiceTopics)
          ? (data.preferences.practiceTopics as Record<string, string[]>)
          : {},
    },
  }
}

/** In-memory fallback used when localStorage is unavailable (private mode, quota). */
let memoryFallback: Progress | null = null

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return memoryFallback ?? emptyProgress()
    return migrate(JSON.parse(raw))
  } catch {
    return memoryFallback ?? emptyProgress()
  }
}

export function saveProgress(progress: Progress): void {
  memoryFallback = progress
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // Storage full or blocked — the in-memory copy keeps the session working.
  }
}

export function clearProgress(): void {
  memoryFallback = null
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing more we can do; the caller resets state regardless.
  }
}
