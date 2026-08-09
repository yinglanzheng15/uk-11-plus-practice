import { useState } from 'react'
import { getQuestion } from '../data'
import { getSubject } from '../data/subjects'
import {
  copyText,
  downloadText,
  feedbackToMarkdown,
  reasonLabel,
} from '../logic/feedback'
import type { Progress } from '../types'

interface Props {
  progress: Progress
  onAddNote: (message: string) => void
  onRemove: (id: string) => void
  onClear: () => void
}

function formatDate(at: number): string {
  return new Date(at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FeedbackTab({ progress, onAddNote, onRemove, onClear }: Props) {
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')
  const [confirmingClear, setConfirmingClear] = useState(false)

  const items = progress.feedback ?? []
  const questionReports = items.filter((f) => f.kind === 'question')
  const notes = items.filter((f) => f.kind !== 'question')
  const markdown = feedbackToMarkdown(progress)

  async function handleCopy() {
    setCopied((await copyText(markdown)) ? 'ok' : 'failed')
  }

  return (
    <>
      <div className="card">
        <h2 className="section-title">Feedback</h2>
        <p className="muted small">
          When a question seems wrong or confusing, it can be flagged from the answer
          screen and it will appear here. You can also add your own notes. Everything is
          stored on this device only — nothing is sent anywhere, so use{' '}
          <strong>Copy</strong> or <strong>Download</strong> to share it.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim() === '') return
            onAddNote(note.trim())
            setNote('')
          }}
        >
          <label className="small" htmlFor="feedback-note">
            Add a note
          </label>
          <textarea
            id="feedback-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: fractions questions seem harder than the percentages ones."
          />
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={note.trim() === ''}>
              Save note
            </button>
          </div>
        </form>
      </div>

      {items.length > 0 && (
        <div className="card">
          <h2 className="section-title">Share or save</h2>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={handleCopy}>
              Copy all feedback
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadText(
                  `11plus-feedback-${new Date().toISOString().slice(0, 10)}.md`,
                  markdown,
                )
              }
            >
              Download as a file
            </button>
          </div>
          {copied === 'ok' && (
            <p className="small" role="status" style={{ marginBottom: 0 }}>
              Copied to the clipboard.
            </p>
          )}
          {copied === 'failed' && (
            <>
              <p className="small" role="status">
                The clipboard is not available in this browser — select the text below and
                copy it manually.
              </p>
              <textarea readOnly rows={8} value={markdown} />
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="section-title">
          Questions flagged {questionReports.length > 0 && `(${questionReports.length})`}
        </h2>
        {questionReports.length === 0 ? (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Nothing has been flagged. If a question ever looks wrong, use “Report a problem
            with this question” underneath the answer.
          </p>
        ) : (
          <ul className="list-plain">
            {questionReports.map((f) => {
              const q = f.questionId ? getQuestion(f.questionId) : undefined
              return (
                <li key={f.id}>
                  <p className="small muted" style={{ margin: 0 }}>
                    {q ? `${getSubject(q.subject).label} · ${q.topic}` : 'Question removed'}{' '}
                    · {formatDate(f.createdAt)} · <code>{f.questionId}</code>
                  </p>
                  <p style={{ margin: '2px 0 4px', fontWeight: 600 }}>
                    {q ? q.question : 'This question is no longer in the app.'}
                  </p>
                  <p className="small" style={{ margin: 0 }}>
                    <span className="badge">{reasonLabel(f.reason)}</span>
                    {q && (
                      <>
                        {' '}
                        Marked answer: <strong>{q.options[q.answer]}</strong>
                      </>
                    )}
                  </p>
                  {f.message.trim() && (
                    <p className="small" style={{ margin: '4px 0 0' }}>
                      “{f.message.trim()}”
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-link small"
                    onClick={() => onRemove(f.id)}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {notes.length > 0 && (
        <div className="card">
          <h2 className="section-title">Your notes ({notes.length})</h2>
          <ul className="list-plain">
            {notes.map((f) => (
              <li key={f.id}>
                <p className="small muted" style={{ margin: 0 }}>
                  {formatDate(f.createdAt)}
                </p>
                <p style={{ margin: '2px 0 4px' }}>{f.message}</p>
                <button
                  type="button"
                  className="btn-link small"
                  onClick={() => onRemove(f.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="card">
          {confirmingClear ? (
            <>
              <p>Delete all {items.length} feedback items? This cannot be undone.</p>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onClear()
                    setConfirmingClear(false)
                  }}
                >
                  Yes, delete all feedback
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirmingClear(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmingClear(true)}>
              Clear all feedback
            </button>
          )}
        </div>
      )}
    </>
  )
}
