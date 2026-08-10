import { useState } from 'react'
import { BackupPanel } from './BackupPanel'
import { PacePanel } from './PacePanel'
import { FeedbackTab } from './FeedbackTab'
import { ProgressBar } from './ProgressBar'
import { formatDuration } from './Timer'
import { getSubject, SUBJECTS } from '../data/subjects'
import { subjectMastery, topicMastery } from '../logic/mastery'
import { overallAccuracy } from '../logic/progress'
import type { Progress } from '../types'

interface Props {
  progress: Progress
  onReset: () => void
  onAddNote: (message: string) => void
  onRemoveFeedback: (id: string) => void
  onClearFeedback: () => void
  onRestore: (progress: Progress) => void
  onSetSecondsPerQuestion: (seconds: number) => void
}

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ParentView({
  progress,
  onReset,
  onAddNote,
  onRemoveFeedback,
  onClearFeedback,
  onRestore,
  onSetSecondsPerQuestion,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const [tab, setTab] = useState<'progress' | 'feedback'>('progress')
  const feedbackCount = (progress.feedback ?? []).length

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Parent sections">
        <button
          type="button"
          role="tab"
          id="tab-progress"
          aria-selected={tab === 'progress'}
          aria-controls="panel-parent"
          className={`tab ${tab === 'progress' ? 'tab-active' : ''}`}
          onClick={() => setTab('progress')}
        >
          Progress
        </button>
        <button
          type="button"
          role="tab"
          id="tab-feedback"
          aria-selected={tab === 'feedback'}
          aria-controls="panel-parent"
          className={`tab ${tab === 'feedback' ? 'tab-active' : ''}`}
          onClick={() => setTab('feedback')}
        >
          Feedback
          {feedbackCount > 0 && <span className="tab-count">{feedbackCount}</span>}
        </button>
      </div>

      <div
        id="panel-parent"
        role="tabpanel"
        aria-labelledby={tab === 'progress' ? 'tab-progress' : 'tab-feedback'}
      >
        {tab === 'feedback' ? (
          <FeedbackTab
            progress={progress}
            onAddNote={onAddNote}
            onRemove={onRemoveFeedback}
            onClear={onClearFeedback}
          />
        ) : (
          <ParentProgress
            progress={progress}
            onReset={onReset}
            onRestore={onRestore}
            onSetSecondsPerQuestion={onSetSecondsPerQuestion}
            confirming={confirming}
            setConfirming={setConfirming}
          />
        )}
      </div>
    </>
  )
}

interface ProgressProps {
  progress: Progress
  onReset: () => void
  onRestore: (progress: Progress) => void
  onSetSecondsPerQuestion: (seconds: number) => void
  confirming: boolean
  setConfirming: (v: boolean) => void
}

function ParentProgress({
  progress,
  onReset,
  onRestore,
  onSetSecondsPerQuestion,
  confirming,
  setConfirming,
}: ProgressProps) {
  const topics = topicMastery(progress)
    .filter((t) => t.attempts > 0)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
  const subjects = subjectMastery(progress)

  // A topic counts as a persistent weak area if it is still below 60% after a
  // reasonable amount of practice.
  const persistentWeak = topics.filter(
    (t) => t.score !== null && t.score < 60 && t.attempts >= 4,
  )

  // Improvement over time: accuracy of the five oldest vs five newest sessions.
  const sessions = progress.sessions
  const recent = sessions.slice(0, 5)
  const older = sessions.slice(-5)
  const avg = (list: typeof sessions) =>
    list.length === 0
      ? null
      : Math.round(
          (list.reduce((sum, s) => sum + (s.total === 0 ? 0 : s.correct / s.total), 0) /
            list.length) *
            100,
        )
  const recentAvg = avg(recent)
  const olderAvg = avg(older)

  return (
    <>
      <div className="card">
        <h2 className="section-title">Parent view</h2>
        <p className="muted small">
          Everything below is stored only in this browser. There is no account and no
          data leaves this device. The percentages are an in-app learning indicator, not
          a standardised 11+ score.
        </p>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{progress.totals.answered}</div>
            <div className="stat-label">Questions answered</div>
          </div>
          <div className="stat">
            <div className="stat-value">{overallAccuracy(progress) ?? 0}%</div>
            <div className="stat-label">Overall accuracy</div>
          </div>
          <div className="stat">
            <div className="stat-value">{sessions.length}</div>
            <div className="stat-label">Sessions completed</div>
          </div>
        </div>
      </div>

      {sessions.length >= 2 && recentAvg !== null && olderAvg !== null && (
        <div className="card">
          <h2 className="section-title">Improvement over time</h2>
          <ProgressBar label="Earliest sessions" value={olderAvg} />
          <ProgressBar label="Most recent sessions" value={recentAvg} />
          <p className="muted small" style={{ marginBottom: 0 }}>
            {recentAvg > olderAvg
              ? `Accuracy has risen by ${recentAvg - olderAvg} percentage points.`
              : recentAvg === olderAvg
                ? 'Accuracy is holding steady.'
                : 'Recent sessions have been harder — the app introduces tougher questions as topics improve, so a dip here is normal.'}
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Subject performance</h2>
        {SUBJECTS.map((s) => {
          const entry = subjects.find((e) => e.subject === s.id)
          return (
            <ProgressBar
              key={s.id}
              label={`${s.label} (${entry?.attempts ?? 0} answered)`}
              value={entry?.score ?? null}
              colour={s.colour}
            />
          )
        })}
      </div>

      {persistentWeak.length > 0 && (
        <div className="card">
          <h2 className="section-title">Persistent weak areas</h2>
          <p className="muted small">
            Still below 60% after several attempts — worth working through together.
          </p>
          <ul className="list-plain">
            {persistentWeak.map((t) => (
              <li key={t.key}>
                <strong>
                  {getSubject(t.subject).label} · {t.topic}
                </strong>{' '}
                — {t.score}% over {t.attempts} attempt{t.attempts === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {topics.length > 0 && (
        <div className="card">
          <h2 className="section-title">Topic performance</h2>
          {topics.map((t) => (
            <ProgressBar
              key={t.key}
              label={`${getSubject(t.subject).shortLabel} · ${t.topic}`}
              value={t.score}
              valueText={`${t.score}% ${t.band} · ${t.attempts} attempt${t.attempts === 1 ? '' : 's'}`}
              colour={getSubject(t.subject).colour}
            />
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="card">
          <h2 className="section-title">Recent activity</h2>
          <ul className="list-plain">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.finishedAt}>
                <strong>{formatDate(s.finishedAt)}</strong> — {s.correct}/{s.total}{' '}
                correct in {formatDuration(s.durationMs)}
                {s.weakTopics.length > 0 && (
                  <span className="muted small"> · struggled with {s.weakTopics.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PacePanel
        secondsPerQuestion={progress.preferences.secondsPerQuestion}
        onChange={onSetSecondsPerQuestion}
      />

      <BackupPanel progress={progress} onRestore={onRestore} />

      <div className="card">
        <h2 className="section-title">Reset</h2>
        {confirming ? (
          <>
            <p>
              This will permanently delete all progress stored in this browser. It cannot
              be undone.
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onReset()
                  setConfirming(false)
                }}
              >
                Yes, delete everything
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirming(true)}>
            Reset all progress
          </button>
        )}
      </div>
    </>
  )
}
