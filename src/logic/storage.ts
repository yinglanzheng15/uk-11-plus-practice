import type { Progress } from '../types'

const KEY = 'elevenplus:v1:progress'
export const SCHEMA_VERSION = 1

export function emptyProgress(): Progress {
  return {
    version: SCHEMA_VERSION,
    questions: {},
    recentQuestionIds: [],
    sessions: [],
    streak: { lastDate: null, current: 0, best: 0 },
    totals: { answered: 0, correct: 0 },
    preferences: { timed: false },
  }
}

/**
 * Migrate an older stored shape forward. Kept deliberately simple: unknown or
 * damaged data falls back to a fresh profile rather than crashing the app.
 */
function migrate(raw: unknown): Progress {
  const base = emptyProgress()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<Progress>
  return {
    ...base,
    ...data,
    version: SCHEMA_VERSION,
    questions: data.questions ?? base.questions,
    recentQuestionIds: data.recentQuestionIds ?? base.recentQuestionIds,
    sessions: data.sessions ?? base.sessions,
    streak: { ...base.streak, ...data.streak },
    totals: { ...base.totals, ...data.totals },
    preferences: { ...base.preferences, ...data.preferences },
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
