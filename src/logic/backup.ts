/**
 * Export and restore progress.
 *
 * Everything this app knows lives in one browser profile. That is a deliberate
 * privacy choice, but it means a cleared browser or a new tablet starts the
 * child from zero. A plain JSON file is the whole answer: no account, no
 * server, and something a parent can actually read and keep.
 */
import {
  DEFAULT_SECONDS_PER_QUESTION,
  emptyProgress,
  isPlainObject,
  readSubjects,
  SCHEMA_VERSION,
} from './storage'
import type { Progress } from '../types'

/** Identifies our own files, so an unrelated JSON file fails clearly. */
const FILE_KIND = 'uk-11-plus-practice-progress'

interface BackupFile {
  kind: typeof FILE_KIND
  /** Progress schema version, so a future import knows what it is reading. */
  version: number
  exportedAt: number
  progress: Progress
}

export function exportProgress(
  progress: Progress,
  at: number = Date.now(),
): string {
  const file: BackupFile = {
    kind: FILE_KIND,
    version: SCHEMA_VERSION,
    exportedAt: at,
    progress,
  }
  return JSON.stringify(file, null, 2)
}

/** `11-plus-progress-2026-08-10.json` — dated so successive backups do not collide. */
export function backupFilename(at: number = Date.now()): string {
  const d = new Date(at)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `11-plus-progress-${d.getFullYear()}-${month}-${day}.json`
}

export type ImportResult =
  | { ok: true; progress: Progress; exportedAt: number | null }
  | { ok: false; error: string }

/**
 * Parse a backup file defensively.
 *
 * A restore overwrites everything the child has done, so this refuses anything
 * it is not sure about rather than importing a half-understood shape. Messages
 * are written for a parent, not a developer.
 */
export function parseBackup(text: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not readable — it is not valid JSON.' }
  }

  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'That file does not contain any progress data.' }
  }

  const file = raw as Partial<BackupFile>
  if (file.kind !== FILE_KIND) {
    return {
      ok: false,
      error: 'That is not an 11+ Practice progress file. Choose the file you downloaded from this app.',
    }
  }
  if (typeof file.version !== 'number' || file.version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'That file was saved by a newer version of the app. Update this device first.',
    }
  }
  if (!file.progress || typeof file.progress !== 'object') {
    return { ok: false, error: 'That file is missing its progress data.' }
  }

  const p = file.progress as Partial<Progress>
  if (!p.questions || typeof p.questions !== 'object' || Array.isArray(p.questions)) {
    return { ok: false, error: 'That file is damaged — the question records are missing.' }
  }
  if (!p.totals || typeof p.totals.answered !== 'number') {
    return { ok: false, error: 'That file is damaged — the totals are missing.' }
  }

  // Fill in anything an older export predates, exactly as loading from storage
  // would. Older records without `streak` are handled the same way.
  const base = emptyProgress()
  const questions: Progress['questions'] = {}
  for (const [id, r] of Object.entries(p.questions)) {
    if (!r || typeof r !== 'object') continue
    const record = r as Partial<Progress['questions'][string]>
    if (typeof record.attempts !== 'number' || typeof record.lastSeen !== 'number') continue
    questions[id] = {
      attempts: record.attempts,
      correct: record.correct ?? 0,
      lastSeen: record.lastSeen,
      lastCorrect: record.lastCorrect ?? false,
      streak: record.streak ?? (record.lastCorrect ? 1 : 0),
    }
  }

  return {
    ok: true,
    exportedAt: typeof file.exportedAt === 'number' ? file.exportedAt : null,
    progress: {
      ...base,
      ...p,
      version: SCHEMA_VERSION,
      questions,
      recentQuestionIds: Array.isArray(p.recentQuestionIds) ? p.recentQuestionIds : [],
      sessions: Array.isArray(p.sessions) ? p.sessions : [],
      feedback: Array.isArray(p.feedback) ? p.feedback : [],
      streak: { ...base.streak, ...p.streak },
      totals: { ...base.totals, ...p.totals },
      preferences: {
        ...base.preferences,
        ...p.preferences,
        // A backup file is editable by hand, so this cannot be trusted. A zero
        // or missing pace would make every timed session expire immediately.
        secondsPerQuestion:
          typeof p.preferences?.secondsPerQuestion === 'number' &&
          p.preferences.secondsPerQuestion > 0
            ? p.preferences.secondsPerQuestion
            : DEFAULT_SECONDS_PER_QUESTION,
        // Files exported at schema 4 name this `mixedSubjects`.
        practiceSubjects: readSubjects(p.preferences),
        practiceTopics: isPlainObject(p.preferences?.practiceTopics)
          ? (p.preferences.practiceTopics as Record<string, string[]>)
          : {},
      },
    },
  }
}

/** A one-line summary of what a file holds, shown before the parent commits to it. */
export function describeBackup(result: Extract<ImportResult, { ok: true }>): string {
  const { progress, exportedAt } = result
  const answered = progress.totals.answered
  const sessions = progress.sessions.length
  const when = exportedAt
    ? new Date(exportedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'an unknown date'
  return `Saved on ${when}: ${answered} question${answered === 1 ? '' : 's'} answered across ${sessions} session${sessions === 1 ? '' : 's'}.`
}
