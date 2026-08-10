/**
 * Persistence for an *in-progress* session.
 *
 * Answers are already saved as they happen (see `progress.ts`), so nothing is
 * ever lost from mastery or streaks. What used to be lost on a refresh was the
 * session itself — question 7 of 20 became the home screen. This module stores
 * just enough to put the child back where they were.
 *
 * Questions are stored as ids and rehydrated from the bank, so a saved session
 * stays small and cannot go stale against an edited question. If any id has
 * since disappeared, the saved session is discarded rather than half-restored.
 */
import { getQuestion } from '../data'
import { TECHNIQUE_CARDS } from '../data/techniqueCards'
import type { Phase, SessionState } from './session'
import type { SessionAnswer, SessionConfig } from '../types'

const KEY = 'elevenplus:v1:session'
export const SESSION_SCHEMA_VERSION = 1

/**
 * A session older than this is not offered again. Coming back to a half-done
 * quiz the next morning is fine; coming back to one from last week is not —
 * the child will have forgotten the earlier questions anyway.
 */
export const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000

interface StoredSession {
  version: number
  /** Epoch ms when this snapshot was written — used for ageing and timers. */
  savedAt: number
  config: SessionConfig
  note?: string
  questionIds: string[]
  index: number
  phase: Phase
  selected: number | null
  lastCorrect: boolean
  followUpId: string | null
  followUpRound: number
  followUpExhausted: boolean
  answers: SessionAnswer[]
  skipped: number[]
  revisiting: boolean
  usedIds: string[]
  techniqueCardId: string | null
  startedAt: number
  questionStartedAt: number
  timedOut: boolean
}

/** In-memory fallback for private mode or a full quota, mirroring storage.ts. */
let memoryFallback: StoredSession | null = null

function serialise(
  state: SessionState,
  note: string | undefined,
  at: number,
): StoredSession {
  return {
    version: SESSION_SCHEMA_VERSION,
    savedAt: at,
    config: state.config,
    note,
    questionIds: state.questions.map((q) => q.id),
    index: state.index,
    phase: state.phase,
    selected: state.selected,
    lastCorrect: state.lastCorrect,
    followUpId: state.followUp?.id ?? null,
    followUpRound: state.followUpRound,
    followUpExhausted: state.followUpExhausted,
    answers: state.answers,
    skipped: state.skipped,
    revisiting: state.revisiting,
    usedIds: state.usedIds,
    techniqueCardId: state.techniqueCard?.id ?? null,
    startedAt: state.startedAt,
    questionStartedAt: state.questionStartedAt,
    timedOut: state.timedOut,
  }
}

export interface RestoredSession {
  state: SessionState
  note?: string
  /** Epoch ms the snapshot was taken, so the UI can say how long ago it was. */
  savedAt: number
}

/**
 * Rebuild a session from a snapshot, or return null if it cannot be trusted.
 *
 * The clock is shifted rather than restored verbatim: a timed session saved
 * with four minutes left should resume with four minutes left, not with four
 * minutes of wall-clock time already burnt while the tab was closed.
 */
function deserialise(stored: StoredSession, at: number): RestoredSession | null {
  if (stored.version !== SESSION_SCHEMA_VERSION) return null
  if (stored.phase === 'complete') return null
  if (at - stored.savedAt > RESUME_MAX_AGE_MS) return null

  const questions = stored.questionIds.map((id) => getQuestion(id))
  if (questions.some((q) => q === undefined)) return null
  if (questions.length === 0) return null
  if (stored.index < 0 || stored.index >= questions.length) return null

  const followUp = stored.followUpId ? getQuestion(stored.followUpId) : undefined
  // The learning loop cannot continue without the question it was serving.
  if (stored.followUpId && !followUp) return null

  const away = Math.max(0, at - stored.savedAt)

  return {
    savedAt: stored.savedAt,
    note: stored.note,
    state: {
      config: stored.config,
      questions: questions as NonNullable<(typeof questions)[number]>[],
      index: stored.index,
      phase: stored.phase,
      selected: stored.selected,
      lastCorrect: stored.lastCorrect,
      followUp: followUp ?? null,
      followUpRound: stored.followUpRound,
      followUpExhausted: stored.followUpExhausted,
      answers: stored.answers,
      // Snapshots written before "Skip for now" existed have neither field.
      skipped: stored.skipped ?? [],
      revisiting: stored.revisiting ?? false,
      usedIds: stored.usedIds,
      techniqueCard:
        TECHNIQUE_CARDS.find((c) => c.id === stored.techniqueCardId) ?? null,
      startedAt: stored.startedAt + away,
      questionStartedAt: stored.questionStartedAt + away,
      endedAt: null,
      timedOut: stored.timedOut,
    },
  }
}

export function saveSession(
  state: SessionState,
  note: string | undefined,
  at: number = Date.now(),
): void {
  if (state.phase === 'complete') {
    clearSession()
    return
  }
  const stored = serialise(state, note, at)
  memoryFallback = stored
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // Quota or private mode — the in-memory copy still survives a re-render.
  }
}

export function loadSession(at: number = Date.now()): RestoredSession | null {
  let stored: StoredSession | null = memoryFallback
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) stored = JSON.parse(raw) as StoredSession
  } catch {
    // Fall through to the in-memory copy, or to null.
  }
  if (!stored) return null
  try {
    return deserialise(stored, at)
  } catch {
    // A damaged snapshot should never stop the app from starting.
    return null
  }
}

export function clearSession(): void {
  memoryFallback = null
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing more we can do; the caller drops the session regardless.
  }
}

/** Exported for the test suite, which has no localStorage to round-trip through. */
export const __internal = { serialise, deserialise }
