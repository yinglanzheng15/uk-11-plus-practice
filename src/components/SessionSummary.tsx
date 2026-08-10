import { useState } from 'react'
import { getQuestion } from '../data'
import { getSubject } from '../data/subjects'
import { formatDuration } from './Timer'
import {
  mainAnswers,
  sessionDurationMs,
  unansweredQuestions,
  type SessionState,
} from '../logic/session'

interface Props {
  state: SessionState
  onExit: () => void
  onRestart: () => void
}

/** Encouraging regardless of score — never makes a low result feel like failure. */
function headline(percentage: number): string {
  if (percentage >= 90) return 'Excellent work!'
  if (percentage >= 70) return 'Great work!'
  if (percentage >= 50) return 'Good effort — solid progress.'
  return 'Well done for sticking with it.'
}

export function SessionSummary({ state, onExit, onRestart }: Props) {
  const [showMistakes, setShowMistakes] = useState(false)

  const answered = mainAnswers(state)
  const correct = answered.filter((a) => a.correct).length
  const total = answered.length
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100)
  const duration = sessionDurationMs(state)

  // Strongest and weakest topics within this session only.
  const byTopic = new Map<string, { right: number; n: number; label: string }>()
  for (const a of answered) {
    const q = getQuestion(a.questionId)
    if (!q) continue
    const key = `${q.subject}::${q.topic}`
    const entry = byTopic.get(key) ?? { right: 0, n: 0, label: q.topic }
    entry.n += 1
    if (a.correct) entry.right += 1
    byTopic.set(key, entry)
  }
  const ranked = [...byTopic.values()].sort((a, b) => b.right / b.n - a.right / a.n)
  const strongest = ranked.filter((t) => t.right === t.n).slice(0, 2)
  const toPractise = ranked.filter((t) => t.right < t.n).slice(-3).reverse()

  const mistakes = answered.filter((a) => !a.correct)
  // Skipped and left, or not reached before the timer went. Either way they are
  // reported rather than quietly dropped, but they never count against accuracy.
  const unanswered = state.timedOut ? [] : unansweredQuestions(state)

  return (
    <>
      <div className="card">
        <h2 className="section-title">{headline(percentage)}</h2>

        {state.timedOut && (
          <div className="notice">
            The time ran out — that is completely fine. Here is how you did on the
            questions you reached.
          </div>
        )}

        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">
              {correct} / {total}
            </div>
            <div className="stat-label">Correct</div>
          </div>
          <div className="stat">
            <div className="stat-value">{percentage}%</div>
            <div className="stat-label">Accuracy</div>
          </div>
          <div className="stat">
            <div className="stat-value">{formatDuration(duration)}</div>
            <div className="stat-label">Time taken</div>
          </div>
        </div>

        {unanswered.length > 0 && (
          <p style={{ marginTop: 18 }}>
            <strong>
              You left {unanswered.length} question{unanswered.length === 1 ? '' : 's'}.
            </strong>{' '}
            That is a perfectly sensible thing to do in a real test — they are not
            counted above, and they will come round again another day.
          </p>
        )}

        {strongest.length > 0 && (
          <p style={{ marginTop: 18 }}>
            <strong>You were strongest at: </strong>
            {strongest.map((t) => t.label).join(', ')}
          </p>
        )}

        {toPractise.length > 0 && (
          <p>
            <strong>Practise next: </strong>
            {toPractise.map((t) => t.label).join(', ')}
          </p>
        )}

        <div className="actions">
          {mistakes.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => setShowMistakes((v) => !v)}
              aria-expanded={showMistakes}
            >
              {showMistakes ? 'Hide review' : `Review mistakes (${mistakes.length})`}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            Try another session
          </button>
          <button type="button" className="btn" onClick={onExit}>
            Back to home
          </button>
        </div>
      </div>

      {showMistakes && (
        <div className="card">
          <h2 className="section-title">Questions to review</h2>
          <ul className="list-plain">
            {mistakes.map((a) => {
              const q = getQuestion(a.questionId)
              if (!q) return null
              return (
                <li key={a.questionId}>
                  <p className="small muted" style={{ margin: 0 }}>
                    {getSubject(q.subject).label} · {q.topic}
                  </p>
                  <p style={{ margin: '2px 0 6px', fontWeight: 600 }}>{q.question}</p>
                  <p className="small" style={{ margin: 0 }}>
                    <strong>Answer:</strong> {q.options[q.answer]}
                  </p>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    {q.learningPoint}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
