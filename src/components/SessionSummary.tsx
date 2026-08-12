import { useState } from 'react'
import { getQuestion } from '../data'
import { getSubject } from '../data/subjects'
import { formatDuration } from './Timer'
import { paperFor } from '../logic/papers'
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
  // A full paper reports by section instead of by topic: "Spelling 7/12" is
  // what tells a parent where to spend the next fortnight, and it is the way
  // the real papers report back. Sections the child never reached are shown
  // too, at 0 answered — a paper they ran out of time on is the finding.
  const paper = state.config.mode === 'paper' ? paperFor(state.config.subjects[0]) : undefined
  const sectionScores = paper
    ? paper.sections.map((section) => {
        const served = state.questions.filter((q) => section.topics.includes(q.topic))
        const ids = new Set(served.map((q) => q.id))
        const done = answered.filter((a) => ids.has(a.questionId))
        return {
          name: section.name,
          right: done.filter((a) => a.correct).length,
          answered: done.length,
          served: served.length,
        }
      })
    : []

  const ranked = [...byTopic.values()].sort((a, b) => b.right / b.n - a.right / a.n)
  const strongest = ranked.filter((t) => t.right === t.n).slice(0, 2)
  const toPractise = ranked.filter((t) => t.right < t.n).slice(-3).reverse()

  const mistakes = answered.filter((a) => !a.correct)
  // Skipped and left, or not reached before the timer went. Either way they are
  // reported rather than quietly dropped, but they never count against accuracy.
  const unanswered = state.timedOut ? [] : unansweredQuestions(state)
  // Everything worth a second look: what was got wrong, plus what was left.
  const reviewable = mistakes.length + unanswered.length

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

        {sectionScores.length > 0 && (
          <>
            <h3 className="section-title" style={{ marginTop: 20 }}>
              Section by section
            </h3>
            <ul className="list-plain">
              {sectionScores.map((s) => (
                <li key={s.name} className="section-score">
                  <span>{s.name}</span>
                  <strong>
                    {s.right} / {s.answered}
                    {s.answered < s.served && (
                      <span className="muted small">
                        {' '}
                        ({s.served - s.answered} not reached)
                      </span>
                    )}
                  </strong>
                </li>
              ))}
            </ul>
            <p className="muted small">
              These are raw marks out of what was attempted. They are not a
              standardised or scaled score — a real 11+ score is worked out
              against how everyone else sitting that paper did, which is not
              something this app can know.
            </p>
          </>
        )}

        {sectionScores.length === 0 && strongest.length > 0 && (
          <p style={{ marginTop: 18 }}>
            <strong>You were strongest at: </strong>
            {strongest.map((t) => t.label).join(', ')}
          </p>
        )}

        {sectionScores.length === 0 && toPractise.length > 0 && (
          <p>
            <strong>Practise next: </strong>
            {toPractise.map((t) => t.label).join(', ')}
          </p>
        )}

        <div className="actions">
          {reviewable > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowMistakes((v) => !v)}
              aria-expanded={showMistakes}
            >
              {showMistakes ? 'Hide the review' : `Go through these (${reviewable})`}
            </button>
          )}
          <button
            type="button"
            className={reviewable > 0 ? 'btn' : 'btn btn-primary'}
            onClick={onRestart}
          >
            Try another session
          </button>
          <button type="button" className="btn" onClick={onExit}>
            Back to home
          </button>
        </div>
      </div>

      {showMistakes && (
        <div className="card">
          <h2 className="section-title">Going through them</h2>
          <p className="muted small">
            The full working for each one, so there is no need to sit through a practice
            question during the quiz unless you want to.
          </p>

          {mistakes.length > 0 && (
            <ul className="list-plain">
              {mistakes.map((a) => {
                const q = getQuestion(a.questionId)
                if (!q) return null
                const yourNote = a.chosen >= 0 ? q.distractorNotes?.[a.chosen] : undefined
                return (
                  <li key={a.questionId}>
                    <p className="small muted" style={{ margin: 0 }}>
                      {getSubject(q.subject).label} · {q.topic}
                    </p>
                    <p style={{ margin: '2px 0 6px', fontWeight: 600 }}>{q.question}</p>
                    <p className="small" style={{ margin: 0 }}>
                      <strong>You chose:</strong> {q.options[a.chosen]}
                      {yourNote ? ` — ${yourNote}` : ''}
                    </p>
                    <p className="small" style={{ margin: '4px 0 0' }}>
                      <strong>Correct answer:</strong> {q.options[q.answer]}
                    </p>
                    <p className="small" style={{ margin: '4px 0 0' }}>{q.explanation}</p>
                    <p className="small muted" style={{ margin: '4px 0 0' }}>
                      <strong>Remember: </strong>
                      {q.learningPoint}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          {unanswered.length > 0 && (
            <>
              <h3 className="section-title" style={{ marginTop: 20 }}>
                The ones you left
              </h3>
              <ul className="list-plain">
                {unanswered.map((q) => (
                  <li key={q.id}>
                    <p className="small muted" style={{ margin: 0 }}>
                      {getSubject(q.subject).label} · {q.topic}
                    </p>
                    <p style={{ margin: '2px 0 6px', fontWeight: 600 }}>{q.question}</p>
                    <p className="small" style={{ margin: 0 }}>
                      <strong>Correct answer:</strong> {q.options[q.answer]}
                    </p>
                    <p className="small" style={{ margin: '4px 0 0' }}>{q.explanation}</p>
                    <p className="small muted" style={{ margin: '4px 0 0' }}>
                      <strong>Remember: </strong>
                      {q.learningPoint}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  )
}
