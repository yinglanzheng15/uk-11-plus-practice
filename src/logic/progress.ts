import type { Progress, Question, SessionSummaryRecord } from '../types'
import { emptyProgress } from './storage'

/** Number of recently served question ids remembered across sessions. */
export const RECENT_MEMORY = 60

/** Local date as YYYY-MM-DD — used for the daily streak. */
export function localDateString(at: number = Date.now()): string {
  const d = new Date(at)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const msPerDay = 86_400_000
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay)
}

/**
 * Record a single answer. Follow-up questions from the learning loop are
 * recorded too — mastery should reflect them — but the caller decides whether
 * they count towards the session's headline score.
 */
export function recordAnswer(
  progress: Progress,
  question: Question,
  correct: boolean,
  at: number = Date.now(),
): Progress {
  const existing = progress.questions[question.id]
  const record = {
    attempts: (existing?.attempts ?? 0) + 1,
    correct: (existing?.correct ?? 0) + (correct ? 1 : 0),
    lastSeen: at,
    lastCorrect: correct,
    // One mistake sends the question back to the start of the review ladder.
    streak: correct ? (existing?.streak ?? 0) + 1 : 0,
  }
  return {
    ...progress,
    questions: { ...progress.questions, [question.id]: record },
    totals: {
      answered: progress.totals.answered + 1,
      correct: progress.totals.correct + (correct ? 1 : 0),
    },
  }
}

/** Push question ids onto the rolling "recently seen" buffer (newest first). */
export function noteServed(progress: Progress, ids: string[]): Progress {
  const merged = [...ids, ...progress.recentQuestionIds.filter((id) => !ids.includes(id))]
  return { ...progress, recentQuestionIds: merged.slice(0, RECENT_MEMORY) }
}

export function finishSession(
  progress: Progress,
  summary: SessionSummaryRecord,
): Progress {
  const today = localDateString(summary.finishedAt)
  const { lastDate, current, best } = progress.streak
  let nextCurrent = current
  if (lastDate === today) {
    nextCurrent = Math.max(current, 1)
  } else if (lastDate && daysBetween(lastDate, today) === 1) {
    nextCurrent = current + 1
  } else {
    nextCurrent = 1
  }
  return {
    ...progress,
    sessions: [summary, ...progress.sessions].slice(0, 50),
    streak: {
      lastDate: today,
      current: nextCurrent,
      best: Math.max(best, nextCurrent),
    },
  }
}

/** Question ids the child has answered incorrectly on their most recent attempt. */
export function mistakeIds(progress: Progress): string[] {
  return Object.entries(progress.questions)
    .filter(([, r]) => !r.lastCorrect)
    .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
    .map(([id]) => id)
}

export function overallAccuracy(progress: Progress): number | null {
  if (progress.totals.answered === 0) return null
  return Math.round((progress.totals.correct / progress.totals.answered) * 100)
}

export function resetProgress(): Progress {
  return emptyProgress()
}
