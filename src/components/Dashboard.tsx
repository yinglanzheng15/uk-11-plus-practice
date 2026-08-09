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

  return (
    <>
      <div className="card">
        <h2 className="section-title">Overall</h2>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{progress.totals.answered}</div>
            <div className="stat-label">Questions answered</div>
          </div>
          <div className="stat">
            <div className="stat-value">{accuracy}%</div>
            <div className="stat-label">Accuracy</div>
          </div>
          <div className="stat">
            <div className="stat-value">{progress.streak.current}</div>
            <div className="stat-label">Day streak (best {progress.streak.best})</div>
          </div>
        </div>
      </div>

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
          <ul className="list-plain">
            {recentMistakes.map((id) => {
              const q = getQuestion(id)
              if (!q) return null
              return (
                <li key={id}>
                  <p className="small muted" style={{ margin: 0 }}>
                    {getSubject(q.subject).label} · {q.topic}
                  </p>
                  <p style={{ margin: '2px 0 0' }}>{q.question}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
