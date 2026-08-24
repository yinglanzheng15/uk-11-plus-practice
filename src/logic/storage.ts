import type { Progress, QuestionRecord } from '../types'

/** Generous rather than pressured — the pace a child starts with. */
export const DEFAULT_SECONDS_PER_QUESTION = 45

/**
 * The single fixed key every device used before profiles existed — one
 * browser, one child. `ensureProfile()` in `logic/profiles.ts` migrates
 * whatever is under it into a first profile the first time this loads.
 */
export const LEGACY_PROGRESS_KEY = 'elevenplus:v1:progress'

export function progressKey(profileId: string): string {
  return `elevenplus:v1:progress:${profileId}`
}

/**
 * 2 added `streak` to QuestionRecord for spaced repetition.
 * 3 added `preferences.secondsPerQuestion`.
 * 4 added `preferences.mixedSubjects`.
 * 5 renamed it to `preferences.practiceSubjects` (it now governs quick
 *   sessions too) and added `preferences.practiceTopics`.
 * 6 added `totalElapsedMs` to QuestionRecord, for per-topic timing.
 */
export const SCHEMA_VERSION = 6

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
 *
 * Records written before schema 6 have no `totalElapsedMs`. There is no way to
 * recover timing for past attempts, so it starts at 0 — the question's average
 * is simply undercounted until it is answered again, rather than guessed at.
 */
function migrateQuestions(
  questions: Record<string, QuestionRecord> | undefined,
): Record<string, QuestionRecord> {
  if (!questions) return {}
  const out: Record<string, QuestionRecord> = {}
  for (const [id, r] of Object.entries(questions)) {
    const withStreak =
      typeof r?.streak === 'number' ? r : { ...r, streak: r?.lastCorrect ? 1 : 0 }
    out[id] =
      typeof withStreak.totalElapsedMs === 'number'
        ? withStreak
        : { ...withStreak, totalElapsedMs: 0 }
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

/**
 * In-memory fallback used when localStorage is unavailable (private mode,
 * quota), keyed by profile — so that even without persistence, switching
 * profiles within one tab cannot leak one child's answers into another's.
 */
const memoryFallback = new Map<string, Progress>()

export function loadProgress(profileId: string): Progress {
  try {
    const raw = window.localStorage.getItem(progressKey(profileId))
    if (!raw) return memoryFallback.get(profileId) ?? emptyProgress()
    return migrate(JSON.parse(raw))
  } catch {
    return memoryFallback.get(profileId) ?? emptyProgress()
  }
}

/**
 * How long writes are batched for.
 *
 * Every answer produces a new Progress object, and writing each one serialises
 * the child's entire history — every question record, session and feedback note.
 * Locally that is a few milliseconds and nobody notices. The reason to batch it
 * is that this same call becomes a network write once progress syncs to a
 * server: without batching that is one full-blob round trip per question.
 */
export const SAVE_DEBOUNCE_MS = 2000

let pending: { profileId: string; progress: Progress } | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function cancelPending(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  pending = null
}

/**
 * Queue a save.
 *
 * The in-memory copy is updated synchronously, so a read straight after a write
 * always sees the new value — only the trip to storage is deferred.
 *
 * This is a throttle with a trailing write rather than a true debounce: the
 * first save starts the clock and later ones only replace what will be written.
 * A plain debounce would push the deadline back on every answer, so a child
 * answering steadily could go a whole session without anything reaching disk.
 *
 * Only one write is ever queued at a time. Switching profiles flushes
 * whatever was pending for the old one first (see App.tsx), so this never
 * needs to batch more than one profile at once.
 */
export function saveProgress(profileId: string, progress: Progress): void {
  memoryFallback.set(profileId, progress)
  pending = { profileId, progress }
  if (timer === null) timer = setTimeout(flushProgress, SAVE_DEBOUNCE_MS)
}

/** Write any queued save immediately. Safe to call when nothing is pending. */
export function flushProgress(): void {
  const entry = pending
  cancelPending()
  if (entry === null) return
  try {
    window.localStorage.setItem(progressKey(entry.profileId), JSON.stringify(entry.progress))
  } catch {
    // Storage full or blocked — the in-memory copy keeps the session working.
  }
}

export function clearProgress(profileId: string): void {
  // Drop any queued write first, or it would land after the wipe and put the
  // child's history straight back.
  if (pending?.profileId === profileId) cancelPending()
  memoryFallback.delete(profileId)
  try {
    window.localStorage.removeItem(progressKey(profileId))
  } catch {
    // Nothing more we can do; the caller resets state regardless.
  }
}
