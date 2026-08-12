import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  clearSession,
  loadSession,
  saveSession,
  type RestoredSession,
} from './logic/sessionStorage'
import { mainAnswers, sessionDurationMs, type SessionState } from './logic/session'
import type { FeedbackReason, Progress, Question, SessionConfig, SubjectId } from './types'

type View = 'home' | 'quiz' | 'dashboard' | 'parent'

interface ActiveSession {
  config: SessionConfig
  questions: Question[]
  note?: string
  /** Present only when carrying on a session restored from a previous visit. */
  initialState?: SessionState
  /** Bumped on restart so QuizSession remounts with fresh state. */
  key: number
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [view, setView] = useState<View>('home')
  const [session, setSession] = useState<ActiveSession | null>(null)
  // Read once on load. A saved session is only *offered* — it is never resumed
  // automatically, because the child may well want to start something else.
  const [resumable, setResumable] = useState<RestoredSession | null>(() => loadSession())
  // The most recent snapshot, kept so that leaving a quiz can offer it straight
  // back rather than throwing it away.
  const liveSession = useRef<SessionState | null>(null)

  // Persist on every change, so a refresh mid-session never loses answered work.
  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  const startSession = useCallback(
    (config: SessionConfig) => {
      const result = selectQuestions(config, progress)
      setProgress((p) => noteServed(p, result.questions.map((q) => q.id)))
      setResumable(null)
      liveSession.current = null
      clearSession()
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

  const handleResume = useCallback(() => {
    if (!resumable) return
    setSession({
      config: resumable.state.config,
      questions: resumable.state.questions,
      note: resumable.note,
      initialState: resumable.state,
      key: resumable.savedAt,
    })
    setResumable(null)
    setView('quiz')
  }, [resumable])

  const handleDiscardResume = useCallback(() => {
    clearSession()
    liveSession.current = null
    setResumable(null)
  }, [])

  const sessionNote = session?.note
  const handlePersist = useCallback(
    (state: SessionState) => {
      if (state.phase === 'complete') {
        liveSession.current = null
        clearSession()
      } else {
        liveSession.current = state
        saveSession(state, sessionNote)
      }
    },
    [sessionNote],
  )

  // Follow-ups are chosen by the learning loop rather than by selectQuestions,
  // so noting every served question here is what stops one reappearing as a
  // main question in the very next session.
  const handleRecord = useCallback((question: Question, correct: boolean) => {
    setProgress((p) => noteServed(recordAnswer(p, question, correct), [question.id]))
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

  /**
   * Leave the quiz — whether by "Stop this session" or the Home link.
   *
   * Deliberately *not* destructive. Half a Quick 20 is a lot of work to lose to
   * a mistapped link, so the snapshot is kept and offered back on the home
   * screen. Starting anything new clears it.
   */
  const handleExit = useCallback(() => {
    const live = liveSession.current
    if (live && live.phase !== 'complete') {
      setResumable({ state: live, note: sessionNote, savedAt: Date.now() })
      liveSession.current = null
    }
    setSession(null)
    setView('home')
  }, [sessionNote])

  const handleRestart = useCallback(() => {
    if (session) startSession(session.config)
  }, [session, startSession])

  const handleSetTimed = useCallback((timed: boolean) => {
    setProgress((p) => ({ ...p, preferences: { ...p.preferences, timed } }))
  }, [])

  const handleSetSecondsPerQuestion = useCallback((secondsPerQuestion: number) => {
    setProgress((p) => ({ ...p, preferences: { ...p.preferences, secondsPerQuestion } }))
  }, [])

  const handleSetMixedSubjects = useCallback((mixedSubjects: SubjectId[]) => {
    setProgress((p) => ({ ...p, preferences: { ...p.preferences, mixedSubjects } }))
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

  // A restore replaces the profile wholesale, so any half-done session from the
  // old one is meaningless and goes too.
  const handleRestore = useCallback((restored: Progress) => {
    clearSession()
    liveSession.current = null
    setResumable(null)
    setSession(null)
    setProgress(restored)
  }, [])

  const handleReset = useCallback(() => {
    clearProgress()
    clearSession()
    liveSession.current = null
    setResumable(null)
    setSession(null)
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
          <Home
            progress={progress}
            onStart={startSession}
            onSetTimed={handleSetTimed}
            onSetMixedSubjects={handleSetMixedSubjects}
            resumable={resumable}
            onResume={handleResume}
            onDiscardResume={handleDiscardResume}
          />
        )}

        {view === 'quiz' && session && (
          <QuizSession
            key={session.key}
            config={session.config}
            questions={session.questions}
            note={session.note}
            initialState={session.initialState}
            onRecord={handleRecord}
            onPersist={handlePersist}
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
            onRestore={handleRestore}
            onSetSecondsPerQuestion={handleSetSecondsPerQuestion}
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
