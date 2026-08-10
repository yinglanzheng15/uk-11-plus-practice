import { useState } from 'react'
import { SUBJECTS } from '../data/subjects'
import { topicsForSubject } from '../data'
import { mistakeIds, overallAccuracy } from '../logic/progress'
import { topicMastery } from '../logic/mastery'
import { mainAnswers } from '../logic/session'
import { paceLabel, timeLimitFor } from '../logic/pace'
import type { RestoredSession } from '../logic/sessionStorage'
import type { Progress, SessionConfig, SessionMode, SubjectId } from '../types'

interface Props {
  progress: Progress
  onStart: (config: SessionConfig) => void
  onSetTimed: (timed: boolean) => void
  /** An unfinished session from a previous visit, if there is one worth offering. */
  resumable?: RestoredSession | null
  onResume: () => void
  onDiscardResume: () => void
}

/** "just now" / "20 minutes ago" / "yesterday" — no library needed for three cases. */
function describeWhen(at: number, now: number = Date.now()): string {
  const minutes = Math.round((now - at) / 60_000)
  if (minutes < 2) return 'a moment ago'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return 'yesterday'
}

export function Home({
  progress,
  onStart,
  onSetTimed,
  resumable,
  onResume,
  onDiscardResume,
}: Props) {
  const [subjectPicker, setSubjectPicker] = useState<SubjectId | null>(null)
  const timed = progress.preferences.timed
  const secondsPerQuestion = progress.preferences.secondsPerQuestion

  const accuracy = overallAccuracy(progress)
  const mistakes = mistakeIds(progress)
  const weakTopics = topicMastery(progress).filter(
    (t) => t.score !== null && t.score < 70 && t.attempts >= 2,
  )

  // A single, adaptive suggestion so the child always has an obvious next step.
  const recommendation = (() => {
    if (progress.totals.answered === 0) {
      return {
        eyebrow: 'Start here',
        title: 'Warm up with a Quick 5',
        blurb: 'Five mixed questions to get going — only a few minutes.',
        cta: 'Start Quick 5',
        run: () => start('quick5', 5, []),
      }
    }
    if (mistakes.length >= 3) {
      return {
        eyebrow: 'Recommended',
        title: 'Review your mistakes',
        blurb: `You have ${mistakes.length} questions worth another look. Fixing these lifts your score fastest.`,
        cta: 'Review mistakes',
        run: () => start('mistakes', Math.min(10, mistakes.length), []),
      }
    }
    if (weakTopics.length > 0) {
      return {
        eyebrow: 'Recommended',
        title: 'Practise your weak areas',
        blurb: `${weakTopics.length} topic${weakTopics.length === 1 ? '' : 's'} could use some work. A focused 10 makes a real difference.`,
        cta: 'Practise weak areas',
        run: () => start('weak', 10, []),
      }
    }
    return {
      eyebrow: 'Keep it up',
      title: 'A mixed Quick 10',
      blurb: 'Ten questions across every subject to keep everything sharp.',
      cta: 'Start Quick 10',
      run: () => start('quick10', 10, []),
    }
  })()

  function start(mode: SessionMode, length: number, subjects: SubjectId[], topic?: string) {
    onStart({
      mode,
      length,
      subjects,
      topic,
      timed,
      timeLimitMs: timed ? timeLimitFor(length, secondsPerQuestion) : undefined,
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
      <div className="greeting">
        <h2>Ready to practise?</h2>
        <p>
          {progress.totals.answered === 0
            ? 'Pick something below to begin.'
            : `${progress.totals.answered} questions answered so far — nice work.`}
        </p>
      </div>

      {!resumable && (
        <div className="card recommend">
          <p className="recommend-eyebrow">{recommendation.eyebrow}</p>
          <h2>{recommendation.title}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {recommendation.blurb}
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-on-accent"
              onClick={recommendation.run}
            >
              {recommendation.cta}
            </button>
          </div>
        </div>
      )}

      {resumable && (
        <div className="card">
          <h2 className="section-title">Carry on where you left off?</h2>
          <p className="muted">
            You were on question {resumable.state.index + 1} of{' '}
            {resumable.state.questions.length}, started {describeWhen(resumable.savedAt)}.
            You have {mainAnswers(resumable.state).filter((a) => a.correct).length}{' '}
            right so far.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={onResume}>
              Carry on
            </button>
            <button type="button" className="btn" onClick={onDiscardResume}>
              Start something new
            </button>
          </div>
        </div>
      )}

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
              <span>
                <span className="tile-dot" aria-hidden="true" />
                {s.label}
              </span>
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
        {timed && (
          <p className="muted small" style={{ marginTop: 6, marginBottom: 0 }}>
            {secondsPerQuestion} seconds a question ({paceLabel(secondsPerQuestion)}) — a
            grown-up can change this in the Parent tab.
          </p>
        )}
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
