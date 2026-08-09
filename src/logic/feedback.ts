import { getQuestion } from '../data'
import { getSubject } from '../data/subjects'
import type { FeedbackItem, FeedbackReason, Progress } from '../types'

export const FEEDBACK_REASONS: { value: FeedbackReason; label: string }[] = [
  { value: 'answer-wrong', label: 'I think the answer is wrong' },
  { value: 'confusing', label: 'The question was confusing' },
  { value: 'typo', label: 'There is a spelling or typing mistake' },
  { value: 'too-hard', label: 'Too hard' },
  { value: 'too-easy', label: 'Too easy' },
  { value: 'other', label: 'Something else' },
]

export function reasonLabel(reason: FeedbackReason | undefined): string {
  return FEEDBACK_REASONS.find((r) => r.value === reason)?.label ?? 'Note'
}

/** Ids only need to be unique within one device, so a timestamp plus a counter is plenty. */
let counter = 0
function nextId(at: number): string {
  counter += 1
  return `fb-${at.toString(36)}-${counter.toString(36)}`
}

export function addFeedback(
  progress: Progress,
  item: Omit<FeedbackItem, 'id' | 'createdAt'>,
  at: number = Date.now(),
): Progress {
  const entry: FeedbackItem = { ...item, id: nextId(at), createdAt: at }
  return { ...progress, feedback: [entry, ...(progress.feedback ?? [])].slice(0, 200) }
}

export function removeFeedback(progress: Progress, id: string): Progress {
  return { ...progress, feedback: (progress.feedback ?? []).filter((f) => f.id !== id) }
}

export function clearFeedback(progress: Progress): Progress {
  return { ...progress, feedback: [] }
}

function formatDate(at: number): string {
  return new Date(at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Render the feedback as Markdown. Question reports include the id, the
 * question text and the marked answer, so whoever fixes the bank has
 * everything they need without opening the app.
 */
export function feedbackToMarkdown(progress: Progress): string {
  const items = progress.feedback ?? []
  const lines: string[] = ['# Feedback on 11+ Practice', '']

  if (items.length === 0) {
    lines.push('No feedback has been recorded yet.')
    return lines.join('\n')
  }

  lines.push(`${items.length} item${items.length === 1 ? '' : 's'}, newest first.`, '')

  const questionReports = items.filter((f) => f.kind === 'question')
  const notes = items.filter((f) => f.kind !== 'question')

  if (questionReports.length > 0) {
    lines.push('## Questions flagged', '')
    for (const f of questionReports) {
      const q = f.questionId ? getQuestion(f.questionId) : undefined
      lines.push(`### ${f.questionId ?? 'unknown question'}`)
      lines.push('')
      lines.push(`- **Reported:** ${reasonLabel(f.reason)} — ${formatDate(f.createdAt)}`)
      if (q) {
        lines.push(`- **Subject:** ${getSubject(q.subject).label} · ${q.topic} (difficulty ${q.difficulty})`)
        lines.push(`- **Question:** ${q.question}`)
        lines.push(`- **Marked answer:** ${q.options[q.answer]}`)
      } else if (f.questionId) {
        lines.push('- *This question is no longer in the bank.*')
      }
      if (f.message.trim()) lines.push(`- **Comment:** ${f.message.trim()}`)
      lines.push('')
    }
  }

  if (notes.length > 0) {
    lines.push('## General notes', '')
    for (const f of notes) {
      lines.push(`- **${formatDate(f.createdAt)}** — ${f.message.trim()}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** Trigger a file download without any server involvement. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Returns false when the clipboard is unavailable, so the UI can offer a fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
