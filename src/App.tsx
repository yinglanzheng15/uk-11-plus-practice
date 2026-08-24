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
import { loadProgress, saveProgress, clearProgress, flushProgress } from './logic/storage'
import {
  clearSession,
  loadSession,
  saveSession,
  type RestoredSession,
} from './logic/sessionStorage'
import {
  createProfile,
  deleteProfile,
  ensureProfile,
  loadProfiles,
  renameProfile,
  setActiveProfileId,
  type ChildProfile,
} from './logic/profiles'
import { mainAnswers, sessionDurationMs, type SessionState } from './logic/session'
import { scoreBand, track } from './logic/analytics'
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
  // One browser can hold several children's progress side by side — see
  // logic/profiles.ts. ensureProfile() also runs the one-time migration for a
  // device that predates profiles, so this is always safe to call first.
  const [activeProfile, setActiveProfile] = useState<ChildProfile>(() => ensureProfile())
  const [profiles, setProfiles] = useState<ChildProfile[]>(() => loadProfiles())
  const [progress, setProgress] = useState<Progress>(() => loadProgress(activeProfile.id))
  const [view, setView] = useState<View>('home')
  const [session, setSession] = useState<ActiveSession | null>(null)
  // Read once on load. A saved session is only *offered* — it is never resumed
  // automatically, because the child may well want to start something else.
  const [resumable, setResumable] = useState<RestoredSession | null>(() =>
    loadSession(activeProfile.id),
  )
  // The most recent snapshot, kept so that leaving a quiz can offer it straight
  // back rather than throwing it away.
  const liveSession = useRef<SessionState | null>(null)

  // Persist on every change, so a refresh mid-session never loses answered work.
  // The write itself is batched (see SAVE_DEBOUNCE_MS), so a steady run of
  // answers costs one write rather than twenty.
  useEffect(() => {
    saveProgress(activeProfile.id, progress)
  }, [activeProfile.id, progress])

  // Batching means a queued write can still be outstanding when the tab goes
  // away, so force it out. `pagehide` is the one that fires reliably when a
  // mobile browser discards the tab; `visibilitychange` covers switching apps or
  // tabs without leaving. Both are idempotent when nothing is pending.
  useEffect(() => {
    const flush = () => flushProgress()
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushProgress()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      flushProgress()
    }
  }, [])

  const startSession = useCallback(
    (config: SessionConfig) => {
      const result = selectQuestions(config, progress)
      track(`start/${config.mode}/${config.subjects.join('+') || 'all'}`)
      setProgress((p) => noteServed(p, result.questions.map((q) => q.id)))
      setResumable(null)
      liveSession.current = null
      clearSession(activeProfile.id)
      setSession({
        config,
        questions: result.questions,
        note: result.note,
        key: Date.now(),
      })
      setView('quiz')
    },
    [progress, activeProfile.id],
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
    clearSession(activeProfile.id)
    liveSession.current = null
    setResumable(null)
  }, [activeProfile.id])

  const sessionNote = session?.note
  const handlePersist = useCallback(
    (state: SessionState) => {
      if (state.phase === 'complete') {
        liveSession.current = null
        clearSession(activeProfile.id)
      } else {
        liveSession.current = state
        saveSession(activeProfile.id, state, sessionNote)
      }
    },
    [activeProfile.id, sessionNote],
  )

  // Follow-ups are chosen by the learning loop rather than by selectQuestions,
  // so noting every served question here is what stops one reappearing as a
  // main question in the very next session.
  const handleRecord = useCallback(
    (question: Question, correct: boolean, elapsedMs: number) => {
      setProgress((p) =>
        noteServed(recordAnswer(p, question, correct, elapsedMs), [question.id]),
      )
    },
    [],
  )

  const handleFinish = useCallback((state: SessionState) => {
    const answered = mainAnswers(state)
    track(
      `finish/${state.config.mode}/${scoreBand(
        answered.filter((a) => a.correct).length,
        answered.length,
      )}`,
    )
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

  const handleSetPracticeSubjects = useCallback((practiceSubjects: SubjectId[]) => {
    setProgress((p) => ({ ...p, preferences: { ...p.preferences, practiceSubjects } }))
  }, [])

  const handleSetPracticeTopics = useCallback(
    (practiceTopics: Record<SubjectId, string[]>) => {
      setProgress((p) => ({ ...p, preferences: { ...p.preferences, practiceTopics } }))
    },
    [],
  )

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

  // A restore replaces the active child's progress wholesale, so any
  // half-done session of theirs is meaningless and goes too. Other children's
  // profiles on this device are untouched.
  const handleRestore = useCallback(
    (restored: Progress) => {
      clearSession(activeProfile.id)
      liveSession.current = null
      setResumable(null)
      setSession(null)
      setProgress(restored)
    },
    [activeProfile.id],
  )

  const handleReset = useCallback(() => {
    clearProgress(activeProfile.id)
    clearSession(activeProfile.id)
    liveSession.current = null
    setResumable(null)
    setSession(null)
    setProgress(resetProgress())
  }, [activeProfile.id])

  /**
   * Switch to a different child's profile.
   *
   * Any pending write for the outgoing profile is flushed first — the
   * debounced save in storage.ts only ever tracks one profile's write at a
   * time, so switching without flushing could drop its last few seconds of
   * progress. Session-scoped state (the live quiz, the resume offer) is
   * reset rather than carried over, since it belongs to whoever was using
   * the device a moment ago, not the child switching in.
   */
  const handleSwitchProfile = useCallback(
    (profile: ChildProfile) => {
      if (profile.id === activeProfile.id) return
      flushProgress()
      setActiveProfileId(profile.id)
      setActiveProfile(profile)
      setProgress(loadProgress(profile.id))
      setResumable(loadSession(profile.id))
      liveSession.current = null
      setSession(null)
      setView('home')
    },
    [activeProfile.id],
  )

  const handleCreateProfile = useCallback((name: string) => {
    const profile = createProfile(name)
    setProfiles((list) => [...list, profile])
    return profile
  }, [])

  const handleRenameProfile = useCallback(
    (id: string, name: string) => {
      renameProfile(id, name)
      const trimmed = name.trim()
      if (!trimmed) return
      setProfiles((list) => list.map((p) => (p.id === id ? { ...p, name: trimmed } : p)))
      if (id === activeProfile.id) {
        setActiveProfile((p) => ({ ...p, name: trimmed }))
      }
    },
    [activeProfile.id],
  )

  // Deleting the profile currently in use, or the last one left, would leave
  // the app with no valid profile to fall back to — the caller (ProfilesPanel)
  // disables both, but the check is repeated here since it is destructive.
  const handleDeleteProfile = useCallback(
    (id: string) => {
      if (id === activeProfile.id || profiles.length <= 1) return
      deleteProfile(id)
      setProfiles((list) => list.filter((p) => p.id !== id))
    },
    [activeProfile.id, profiles.length],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          11+ Practice
          {/* Only shown once there is more than one child on this device — a
              single-profile household should never see profile plumbing. */}
          {profiles.length > 1 && (
            <span className="muted small" style={{ fontWeight: 600 }}>
              {activeProfile.name}
            </span>
          )}
        </h1>
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
            onSetPracticeSubjects={handleSetPracticeSubjects}
            onSetPracticeTopics={handleSetPracticeTopics}
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
            profiles={profiles}
            activeProfileId={activeProfile.id}
            onSwitchProfile={handleSwitchProfile}
            onCreateProfile={handleCreateProfile}
            onRenameProfile={handleRenameProfile}
            onDeleteProfile={handleDeleteProfile}
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
