import { useState } from 'react'
import { FEEDBACK_REASONS } from '../logic/feedback'
import type { FeedbackReason } from '../types'

interface Props {
  questionId: string
  onSubmit: (reason: FeedbackReason, message: string) => void
}

/**
 * A quiet "something's wrong with this question" control shown under the
 * answer feedback. Deliberately understated: it must not compete with the
 * explanation, and it should never look like a way to skip the learning loop.
 */
export function ReportProblem({ questionId, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [reason, setReason] = useState<FeedbackReason>('confusing')
  const [message, setMessage] = useState('')

  if (done) {
    return (
      <p className="small muted report-row" role="status">
        Thank you — that has been saved for a grown-up to look at.
      </p>
    )
  }

  if (!open) {
    return (
      <div className="report-row">
        <button type="button" className="btn-link" onClick={() => setOpen(true)}>
          Report a problem with this question
        </button>
      </div>
    )
  }

  return (
    <div className="report-form">
      <fieldset>
        <legend className="small">What is wrong with it?</legend>
        {FEEDBACK_REASONS.map((r) => (
          <label key={r.value} className="report-option">
            <input
              type="radio"
              name={`reason-${questionId}`}
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
            />
            {r.label}
          </label>
        ))}
      </fieldset>

      <label className="small" htmlFor={`note-${questionId}`}>
        Anything else? (optional)
      </label>
      <textarea
        id={`note-${questionId}`}
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="For example: I think B could also be right because…"
      />

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            onSubmit(reason, message)
            setDone(true)
          }}
        >
          Send
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
