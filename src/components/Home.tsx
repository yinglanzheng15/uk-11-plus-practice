import { useState } from 'react'
import { SUBJECTS } from '../data/subjects'
import { topicsForSubject } from '../data'
import { mistakeIds, overallAccuracy } from '../logic/progress'
import { topicMastery } from '../logic/mastery'
import type { Progress, SessionConfig, SessionMode, SubjectId } from '../types'

interface Props {
  progress: Progress
  onStart: (config: SessionConfig) => void
  onSetTimed: (timed: boolean) => void
}

/** Roughly 45 seconds per question — generous rather than pressured. */
function timeLimitFor(length: number): number {
  return length * 45_000
}

export function Home({ progress, onStart, onSetTimed }: Props) {
  const [subjectPicker, setSubjectPicker] = useState<SubjectId | null>(null)
  const timed = progress.preferences.timed

  const accuracy = overallAccuracy(progress)
  const mistakes = mistakeIds(progress)
  const weakTopics = topicMastery(progress).filter(
    (t) => t.score !== null && t.score < 70 && t.attempts >= 2,
  )

  function start(mode: SessionMode, length: number, subjects: SubjectId[], topic?: string) {
    onStart({
      mode,
      length,
      subjects,
      topic,
      timed,
      timeLimitMs: timed ? timeLimitFor(length) : undefined,
    })
  }

  if (subjectPicker) {
    const subject = SUBJECTS.find((s) => s.id === subjectPicker)!
    const topics = topicsForSubject(subjectPicker)
    return (
      <div className="card">
        <h2 className="section-title">{subject.label} — choose a topic</h2>
        <p className="muted small">{subject.description}</p>
        <div className="tile-grid" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="tile tile-accent"
            style={{ ['--tile-colour' as string]: subject.colour }}
            onClick={() => start('subject', 10, [subjectPicker])}
          >
            All topics
            <span className="tile-sub">10 questions</span>
          </button>
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              className="tile tile-accent"
              style={{ ['--tile-colour' as string]: subject.colour }}
              onClick={() => start('subject', 10, [subjectPicker], topic)}
            >
              {topic}
              <span className="tile-sub">10 questions</span>
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setSubjectPicker(null)}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h2 className="section-title">What would you like to practise?</h2>

        <div className="tile-grid">
          <button type="button" className="tile" onClick={() => start('quick5', 5, [])}>
            Quick 5
            <span className="tile-sub">About 3–5 minutes</span>
          </button>
          <button type="button" className="tile" onClick={() => start('quick10', 10, [])}>
            Quick 10
            <span className="tile-sub">About 5–10 minutes</span>
          </button>
          <button type="button" className="tile" onClick={() => start('quick20', 20, [])}>
            Quick 20
            <span className="tile-sub">About 10–15 minutes</span>
          </button>
        </div>

        <h3 className="section-title" style={{ marginTop: 22 }}>
          By subject
        </h3>
        <div className="tile-grid">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="tile tile-accent"
              style={{ ['--tile-colour' as string]: s.colour }}
              onClick={() => setSubjectPicker(s.id)}
            >
              {s.label}
              <span className="tile-sub">Choose a topic</span>
            </button>
          ))}
        </div>

        <h3 className="section-title" style={{ marginTop: 22 }}>
          Targeted practice
        </h3>
        <div className="tile-grid">
          <button
            type="button"
            className="tile"
            disabled={mistakes.length === 0}
            onClick={() => start('mistakes', Math.min(10, mistakes.length), [])}
          >
            My mistakes
            <span className="tile-sub">
              {mistakes.length === 0
                ? 'Nothing to review yet'
                : `${mistakes.length} to review`}
            </span>
          </button>
          <button
            type="button"
            className="tile"
            disabled={weakTopics.length === 0}
            onClick={() => start('weak', 10, [])}
          >
            Weak areas
            <span className="tile-sub">
              {weakTopics.length === 0
                ? 'Answer a few more first'
                : `${weakTopics.length} topic${weakTopics.length === 1 ? '' : 's'}`}
            </span>
          </button>
          <button type="button" className="tile" onClick={() => start('mixed', 10, [])}>
            Mixed practice
            <span className="tile-sub">All three subjects</span>
          </button>
          <button
            type="button"
            className="tile"
            onClick={() => start('challenge', 10, [])}
          >
            Challenge
            <span className="tile-sub">Harder questions</span>
          </button>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 22,
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => onSetTimed(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          Use a timer for my next session
        </label>
      </div>

      <div className="card">
        <h2 className="section-title">Your progress so far</h2>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{progress.totals.answered}</div>
            <div className="stat-label">Questions answered</div>
          </div>
          <div className="stat">
            <div className="stat-value">{accuracy === null ? '—' : `${accuracy}%`}</div>
            <div className="stat-label">Accuracy</div>
          </div>
          <div className="stat">
            <div className="stat-value">{progress.streak.current}</div>
            <div className="stat-label">Day streak</div>
          </div>
        </div>
        {progress.totals.answered === 0 && (
          <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
            Start with a Quick 5 — it only takes a few minutes.
          </p>
        )}
      </div>
    </>
  )
}
