import { useCallback, useEffect, useState } from 'react'
import { Home } from './components/Home'
import { QuizSession } from './components/QuizSession'
import { Dashboard } from './components/Dashboard'
import { ParentView } from './components/ParentView'
import { getQuestion } from './data'
import { selectQuestions } from './logic/questionSelector'
import {
  finishSession,
  noteServed,
  recordAnswer,
  resetProgress,
} from './logic/progress'
import { addFeedback, clearFeedback, removeFeedback } from './logic/feedback'
import { loadProgress, saveProgress, clearProgress } from './logic/storage'
import { mainAnswers, sessionDurationMs, type SessionState } from './logic/session'
import type { FeedbackReason, Progress, Question, SessionConfig } from './types'

type View = 'home' | 'quiz' | 'dashboard' | 'parent'

interface ActiveSession {
  config: SessionConfig
  questions: Question[]
  note?: string
  /** Bumped on restart so QuizSession remounts with fresh state. */
  key: number
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [view, setView] = useState<View>('home')
  const [session, setSession] = useState<ActiveSession | null>(null)

  // Persist on every change, so a refresh mid-session never loses answered work.
  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  const startSession = useCallback(
    (config: SessionConfig) => {
      const result = selectQuestions(config, progress)
      setProgress((p) => noteServed(p, result.questions.map((q) => q.id)))
      setSession({
        config,
        questions: result.questions,
        note: result.note,
        key: Date.now(),
      })
      setView('quiz')
    },
    [progress],
  )

  const handleRecord = useCallback((question: Question, correct: boolean) => {
    setProgress((p) => recordAnswer(p, question, correct))
  }, [])

  const handleFinish = useCallback((state: SessionState) => {
    const answered = mainAnswers(state)
    const weak = [
      ...new Set(
        answered
          .filter((a) => !a.correct)
          .map((a) => getQuestion(a.questionId)?.topic)
          .filter((t): t is string => Boolean(t)),
      ),
    ]
    setProgress((p) =>
      finishSession(p, {
        finishedAt: Date.now(),
        mode: state.config.mode,
        subjects: [...new Set(state.questions.map((q) => q.subject))],
        total: answered.length,
        correct: answered.filter((a) => a.correct).length,
        durationMs: sessionDurationMs(state),
        weakTopics: weak,
      }),
    )
  }, [])

  const handleExit = useCallback(() => {
    setSession(null)
    setView('home')
  }, [])

  const handleRestart = useCallback(() => {
    if (session) startSession(session.config)
  }, [session, startSession])

  const handleSetTimed = useCallback((timed: boolean) => {
    setProgress((p) => ({ ...p, preferences: { ...p.preferences, timed } }))
  }, [])

  const handleReport = useCallback(
    (questionId: string, reason: FeedbackReason, message: string) => {
      setProgress((p) => addFeedback(p, { kind: 'question', questionId, reason, message }))
    },
    [],
  )

  const handleAddNote = useCallback((message: string) => {
    setProgress((p) => addFeedback(p, { kind: 'general', message }))
  }, [])

  const handleRemoveFeedback = useCallback((id: string) => {
    setProgress((p) => removeFeedback(p, id))
  }, [])

  const handleClearFeedback = useCallback(() => {
    setProgress((p) => clearFeedback(p))
  }, [])

  const handleReset = useCallback(() => {
    clearProgress()
    setProgress(resetProgress())
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">11+ Practice</h1>
        <nav aria-label="Main">
          <button
            type="button"
            className="btn btn-quiet"
            aria-current={view === 'home' ? 'page' : undefined}
            onClick={handleExit}
          >
            Home
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            aria-current={view === 'dashboard' ? 'page' : undefined}
            onClick={() => setView('dashboard')}
          >
            My progress
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            aria-current={view === 'parent' ? 'page' : undefined}
            onClick={() => setView('parent')}
          >
            Parent
          </button>
        </nav>
      </header>

      <main>
        {view === 'home' && (
          <Home progress={progress} onStart={startSession} onSetTimed={handleSetTimed} />
        )}

        {view === 'quiz' && session && (
          <QuizSession
            key={session.key}
            config={session.config}
            questions={session.questions}
            note={session.note}
            onRecord={handleRecord}
            onFinish={handleFinish}
            onExit={handleExit}
            onRestart={handleRestart}
            onReport={handleReport}
          />
        )}

        {view === 'dashboard' && <Dashboard progress={progress} />}

        {view === 'parent' && (
          <ParentView
            progress={progress}
            onReset={handleReset}
            onAddNote={handleAddNote}
            onRemoveFeedback={handleRemoveFeedback}
            onClearFeedback={handleClearFeedback}
          />
        )}
      </main>

      <footer className="muted small" style={{ marginTop: 32, textAlign: 'center' }}>
        Original practice questions written in the style of UK 11+ assessments. Not
        affiliated with, or endorsed by, any school, consortium or examination board.
      </footer>
    </div>
  )
}
