import { ProgressBar } from './ProgressBar'
import { getQuestion } from '../data'
import { getSubject, SUBJECTS } from '../data/subjects'
import { mistakeIds, overallAccuracy } from '../logic/progress'
import {
  strongestTopics,
  subjectMastery,
  topicMastery,
  weakestTopics,
} from '../logic/mastery'
import type { Progress } from '../types'

interface Props {
  progress: Progress
}

export function Dashboard({ progress }: Props) {
  const accuracy = overallAccuracy(progress)
  const subjects = subjectMastery(progress)
  const strong = strongestTopics(progress, 4)
  const weak = weakestTopics(progress, 4)
  const mastered = topicMastery(progress).filter((t) => t.band === 'Mastered')
  const recentMistakes = mistakeIds(progress).slice(0, 5)

  if (progress.totals.answered === 0) {
    return (
      <div className="card">
        <h2 className="section-title">Your progress</h2>
        <p className="muted">
          Once you have answered some questions, this page will show how you are getting
          on in each subject and topic.
        </p>
      </div>
    )
  }

  // Accuracy per completed session, oldest → newest, for the trend chart.
  const recentSessions = progress.sessions
    .filter((s) => s.total > 0)
    .slice(-10)
    .map((s) => Math.round((s.correct / s.total) * 100))

  return (
    <>
      <div className="card">
        <h2 className="section-title">Overall</h2>
        <div className="overall-grid">
          <div
            className="ring"
            style={{ ['--ring-pct' as string]: accuracy }}
            role="img"
            aria-label={`Overall accuracy ${accuracy} per cent`}
          >
            <div className="ring-label">
              <div className="ring-value">{accuracy}%</div>
              <div className="ring-sub">Accuracy</div>
            </div>
          </div>
          <div className="stat-row" style={{ flex: 1 }}>
            <div className="stat">
              <div className="stat-value">{progress.totals.answered}</div>
              <div className="stat-label">Questions answered</div>
            </div>
            <div className="stat">
              <div className="stat-value">{progress.streak.current}</div>
              <div className="stat-label">Day streak</div>
            </div>
            <div className="stat">
              <div className="stat-value">{progress.streak.best}</div>
              <div className="stat-label">Best streak</div>
            </div>
          </div>
        </div>
      </div>

      {recentSessions.length >= 2 && (
        <div className="card">
          <h2 className="section-title">Accuracy over time</h2>
          <div
            className="trend"
            role="img"
            aria-label={`Accuracy across your last ${recentSessions.length} sessions: ${recentSessions.join(', ')} per cent`}
          >
            {recentSessions.map((pct, i) => (
              <div className="trend-bar" key={i} title={`${pct}%`}>
                <span style={{ height: `${Math.max(pct, 4)}%` }} />
              </div>
            ))}
          </div>
          <div className="trend-axis">
            <span>Oldest</span>
            <span>Most recent</span>
          </div>
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            Each bar is one practice session. Watch it climb as you improve.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">By subject</h2>
        {SUBJECTS.map((s) => {
          const entry = subjects.find((e) => e.subject === s.id)
          return (
            <ProgressBar
              key={s.id}
              label={s.label}
              value={entry?.score ?? null}
              colour={s.colour}
            />
          )
        })}
        <p className="muted small" style={{ marginTop: 4, marginBottom: 0 }}>
          These figures show how you are doing in this app. They are not a standardised
          11+ score.
        </p>
      </div>

      {strong.length > 0 && (
        <div className="card">
          <h2 className="section-title">Strongest topics</h2>
          {strong.map((t) => (
            <ProgressBar
              key={t.key}
              label={`${getSubject(t.subject).shortLabel} · ${t.topic}`}
              value={t.score}
              valueText={`${t.score}% ${t.band}`}
              colour={getSubject(t.subject).colour}
            />
          ))}
        </div>
      )}

      {weak.length > 0 && (
        <div className="card">
          <h2 className="section-title">Topics to practise</h2>
          {weak.map((t) => (
            <ProgressBar
              key={t.key}
              label={`${getSubject(t.subject).shortLabel} · ${t.topic}`}
              value={t.score}
              valueText={`${t.score}% ${t.band}`}
              colour={getSubject(t.subject).colour}
            />
          ))}
        </div>
      )}

      {mastered.length > 0 && (
        <div className="card">
          <h2 className="section-title">Mastered</h2>
          <div className="chip-row">
            {mastered.map((t) => (
              <span key={t.key} className="badge">
                {getSubject(t.subject).shortLabel} · {t.topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {recentMistakes.length > 0 && (
        <div className="card">
          <h2 className="section-title">Recent mistakes</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            Tap one to go through it again — no need to re-answer.
          </p>
          <ul className="list-plain">
            {recentMistakes.map((id) => {
              const q = getQuestion(id)
              if (!q) return null
              // Native <details> for a keyboard-accessible accordion — no state.
              // The chosen answer isn't stored, so we re-read the teaching that
              // doesn't need it: correct answer, working, rule and the traps.
              return (
                <li key={id}>
                  <details>
                    <summary style={{ cursor: 'pointer' }}>
                      <span className="small muted">
                        {getSubject(q.subject).label} · {q.topic}
                      </span>
                      <span style={{ display: 'block', margin: '2px 0 0' }}>
                        {q.question}
                      </span>
                    </summary>
                    <p className="small" style={{ margin: '8px 0 0' }}>
                      <strong>Correct answer:</strong> {q.options[q.answer]}
                    </p>
                    <p className="small" style={{ margin: '4px 0 0' }}>{q.explanation}</p>
                    {q.distractorNotes?.some((n, i) => n && i !== q.answer) && (
                      <ul className="list-plain small" style={{ margin: '4px 0 0' }}>
                        {q.options.map((opt, i) =>
                          i !== q.answer && q.distractorNotes?.[i] ? (
                            <li key={i} style={{ margin: '2px 0 0' }}>
                              <strong>{opt}:</strong> {q.distractorNotes[i]}
                            </li>
                          ) : null,
                        )}
                      </ul>
                    )}
                    <p className="small muted" style={{ margin: '4px 0 0' }}>
                      <strong>Remember: </strong>
                      {q.learningPoint}
                    </p>
                  </details>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
