import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuestionCard } from './QuestionCard'
import { FeedbackPanel } from './FeedbackPanel'
import { Timer } from './Timer'
import { SessionSummary } from './SessionSummary'
import { getSubject } from '../data/subjects'
import {
  createSession,
  currentQuestion,
  resolveExhausted,
  sessionReducer,
  MAX_FOLLOW_UPS,
  type SessionState,
} from '../logic/session'
import type { FeedbackReason, Question, SessionConfig } from '../types'

interface Props {
  config: SessionConfig
  questions: Question[]
  note?: string
  /** A restored session, when the child chose to carry on where they left off. */
  initialState?: SessionState
  /** Persist a single answer. Follow-ups are recorded too. */
  onRecord: (question: Question, correct: boolean) => void
  /** Called on every transition so the session survives a refresh. */
  onPersist: (state: SessionState) => void
  onFinish: (state: SessionState) => void
  onExit: () => void
  onRestart: () => void
  onReport: (questionId: string, reason: FeedbackReason, message: string) => void
}

export function QuizSession({
  config,
  questions,
  note,
  initialState,
  onRecord,
  onPersist,
  onFinish,
  onExit,
  onRestart,
  onReport,
}: Props) {
  const initial = useMemo(
    () => initialState ?? createSession(config, questions),
    [initialState, config, questions],
  )
  const [state, setState] = useState(initial)
  const finishedRef = useRef(false)

  const question = currentQuestion(state)

  // Snapshot every transition, including the very first render, so closing the
  // tab on question 1 is as recoverable as closing it on question 19.
  useEffect(() => {
    onPersist(state)
  }, [state, onPersist])

  // Report completion exactly once, as an effect rather than inside an updater
  // (updaters are re-run under StrictMode and must stay side-effect free).
  useEffect(() => {
    if (state.phase === 'complete' && !finishedRef.current) {
      finishedRef.current = true
      onFinish(state)
    }
  }, [state, onFinish])

  const apply = useCallback((transition: (s: SessionState) => SessionState) => {
    setState(transition)
  }, [])

  // A long feedback panel leaves the page scrolled down; without this the next
  // question would open below the fold.
  const shownQuestionId = question?.id
  useEffect(() => {
    if (state.phase !== 'feedback' && state.phase !== 'followup-feedback') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [shownQuestionId, state.phase])

  const handleSelect = useCallback(
    (option: number) => {
      const q = currentQuestion(state)
      if (!q) return
      if (state.phase !== 'question' && state.phase !== 'followup') return
      onRecord(q, option === q.answer)
      apply((s) => sessionReducer(s, { type: 'answer', option, at: Date.now() }))
    },
    [state, onRecord, apply],
  )

  const handleContinue = useCallback(() => {
    apply((s) =>
      s.followUpExhausted
        ? resolveExhausted(s, Date.now())
        : sessionReducer(s, { type: 'continue', at: Date.now() }),
    )
  }, [apply])

  const handleTimeout = useCallback(() => {
    apply((s) => sessionReducer(s, { type: 'timeout', at: Date.now() }))
  }, [apply])

  if (state.phase === 'complete') {
    return <SessionSummary state={state} onExit={onExit} onRestart={onRestart} />
  }

  if (questions.length === 0) {
    return (
      <div className="card">
        <h2 className="section-title">Nothing to practise here yet</h2>
        <p className="muted">
          There are no questions available for this choice at the moment. Try a Quick 10
          instead — once you have answered a few questions, this mode will fill up.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onExit}>
            Back to home
          </button>
        </div>
      </div>
    )
  }

  if (state.phase === 'technique' && state.techniqueCard) {
    return (
      <div className="card">
        <p className="badge">Exam tip</p>
        <h2 className="section-title" style={{ marginTop: 10 }}>
          {state.techniqueCard.title}
        </h2>
        <p>{state.techniqueCard.body}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={handleContinue} autoFocus>
            Carry on
          </button>
        </div>
      </div>
    )
  }

  if (!question) return null

  const revealed = state.phase === 'feedback' || state.phase === 'followup-feedback'
  const inLearningLoop = state.phase === 'followup' || state.phase === 'followup-feedback'
  const subject = getSubject(question.subject)

  return (
    <>
      <div className="quiz-meta">
        <span>
          Question {Math.min(state.index + 1, questions.length)} / {questions.length}
        </span>
        <span>
          {subject.label} · {question.topic}
        </span>
        {config.timed && config.timeLimitMs && (
          <Timer
            startedAt={state.startedAt}
            limitMs={config.timeLimitMs}
            paused={false}
            onExpire={handleTimeout}
          />
        )}
      </div>

      {note === 'short-pool' && state.index === 0 && (
        <div className="notice">
          There were not quite enough new questions for a full session, so this one is a
          little shorter.
        </div>
      )}

      {inLearningLoop && (
        <div className="learning-banner">
          Practice question {state.followUpRound} of {MAX_FOLLOW_UPS} — let's make sure
          that idea has stuck.
        </div>
      )}

      <div className="card">
        <QuestionCard
          key={question.id}
          question={question}
          selected={state.selected}
          revealed={revealed}
          onSelect={handleSelect}
        />

        {revealed && (
          <FeedbackPanel
            question={question}
            correct={state.lastCorrect}
            chosen={state.selected}
            variant={state.phase === 'followup-feedback' ? 'followup' : 'main'}
            exhausted={state.followUpExhausted}
            onContinue={handleContinue}
            onReport={onReport}
            continueLabel={
              state.lastCorrect || state.followUpExhausted
                ? state.index + 1 >= questions.length
                  ? 'Finish'
                  : 'Next question'
                : 'Try a practice question'
            }
          />
        )}
      </div>

      <button type="button" className="btn btn-quiet" onClick={onExit}>
        Stop this session
      </button>
    </>
  )
}
