import { TECHNIQUE_CARDS, type TechniqueCard } from '../data/techniqueCards'
import { selectFollowUp } from './questionSelector'
import type { Question, SessionAnswer, SessionConfig } from '../types'

/** Maximum follow-up questions offered for a single mistake. */
export const MAX_FOLLOW_UPS = 2

export type Phase =
  | 'question'
  | 'feedback'
  | 'followup'
  | 'followup-feedback'
  | 'technique'
  | 'complete'

export interface SessionState {
  config: SessionConfig
  questions: Question[]
  index: number
  phase: Phase
  /** The option the child chose for whatever question is currently in view. */
  selected: number | null
  lastCorrect: boolean
  followUp: Question | null
  /** How many follow-ups have been served for the current mistake. */
  followUpRound: number
  /** True when the follow-ups ran out without a correct answer. */
  followUpExhausted: boolean
  answers: SessionAnswer[]
  /** Every question id shown in this session, main or follow-up. */
  usedIds: string[]
  techniqueCard: TechniqueCard | null
  startedAt: number
  questionStartedAt: number
  endedAt: number | null
  /** Set when the timer ran out rather than the child finishing all questions. */
  timedOut: boolean
}

export type SessionAction =
  | { type: 'answer'; option: number; at: number }
  | { type: 'continue'; at: number }
  | { type: 'timeout'; at: number }

export function createSession(
  config: SessionConfig,
  questions: Question[],
  at: number = Date.now(),
): SessionState {
  return {
    config,
    questions,
    index: 0,
    phase: questions.length === 0 ? 'complete' : 'question',
    selected: null,
    lastCorrect: false,
    followUp: null,
    followUpRound: 0,
    followUpExhausted: false,
    answers: [],
    usedIds: questions.map((q) => q.id),
    techniqueCard: null,
    startedAt: at,
    questionStartedAt: at,
    endedAt: questions.length === 0 ? at : null,
    timedOut: false,
  }
}

/** The question currently on screen, whether a main question or a follow-up. */
export function currentQuestion(state: SessionState): Question | undefined {
  if (state.phase === 'followup' || state.phase === 'followup-feedback') {
    return state.followUp ?? undefined
  }
  return state.questions[state.index]
}

/** Main-run answers only — follow-ups never count against the headline score. */
export function mainAnswers(state: SessionState): SessionAnswer[] {
  return state.answers.filter((a) => !a.isFollowUp)
}

export function sessionScore(state: SessionState): { correct: number; total: number } {
  const main = mainAnswers(state)
  return {
    correct: main.filter((a) => a.correct).length,
    total: state.questions.length,
  }
}

/** A short technique card appears after every 6th question, at most once a session. */
function techniqueCardFor(state: SessionState): TechniqueCard | null {
  const answered = mainAnswers(state).length
  const isLast = state.index + 1 >= state.questions.length
  if (isLast || answered === 0 || answered % 6 !== 0) return null
  if (state.techniqueCard) return null
  const idx = (state.startedAt + answered) % TECHNIQUE_CARDS.length
  return TECHNIQUE_CARDS[idx]
}

function advance(state: SessionState, at: number): SessionState {
  const nextIndex = state.index + 1
  if (nextIndex >= state.questions.length) {
    return { ...state, phase: 'complete', endedAt: at, selected: null }
  }
  const card = techniqueCardFor(state)
  return {
    ...state,
    index: nextIndex,
    phase: card ? 'technique' : 'question',
    techniqueCard: card,
    selected: null,
    followUp: null,
    followUpRound: 0,
    followUpExhausted: false,
    questionStartedAt: at,
  }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'timeout':
      if (state.phase === 'complete') return state
      return { ...state, phase: 'complete', endedAt: action.at, timedOut: true }

    case 'answer': {
      const question = currentQuestion(state)
      if (!question) return state
      if (state.phase !== 'question' && state.phase !== 'followup') return state

      const correct = action.option === question.answer
      const answer: SessionAnswer = {
        questionId: question.id,
        chosen: action.option,
        correct,
        isFollowUp: state.phase === 'followup',
        elapsedMs: action.at - state.questionStartedAt,
      }
      return {
        ...state,
        selected: action.option,
        lastCorrect: correct,
        answers: [...state.answers, answer],
        phase: state.phase === 'question' ? 'feedback' : 'followup-feedback',
      }
    }

    case 'continue': {
      if (state.phase === 'technique') {
        return { ...state, phase: 'question', questionStartedAt: action.at }
      }

      if (state.phase === 'feedback') {
        // Correct first time — move straight on.
        if (state.lastCorrect) return advance(state, action.at)
        // Wrong — enter the learning loop.
        const followUp = selectFollowUp(
          state.questions[state.index],
          new Set(state.usedIds),
        )
        if (!followUp) return advance(state, action.at)
        return {
          ...state,
          phase: 'followup',
          followUp,
          followUpRound: 1,
          selected: null,
          usedIds: [...state.usedIds, followUp.id],
          questionStartedAt: action.at,
        }
      }

      if (state.phase === 'followup-feedback') {
        if (state.lastCorrect) return advance(state, action.at)
        if (state.followUpRound >= MAX_FOLLOW_UPS) {
          // Do not trap the child. Acknowledge it and come back to the topic later.
          return { ...state, phase: 'followup-feedback', followUpExhausted: true }
        }
        const next = selectFollowUp(
          state.followUp ?? state.questions[state.index],
          new Set(state.usedIds),
        )
        if (!next) return { ...state, followUpExhausted: true }
        return {
          ...state,
          phase: 'followup',
          followUp: next,
          followUpRound: state.followUpRound + 1,
          selected: null,
          usedIds: [...state.usedIds, next.id],
          questionStartedAt: action.at,
        }
      }

      return state
    }

    default:
      return state
  }
}

/** Called when the child clicks past an exhausted learning loop. */
export function resolveExhausted(state: SessionState, at: number): SessionState {
  return advance({ ...state, followUpExhausted: false }, at)
}

export function sessionDurationMs(state: SessionState): number {
  return (state.endedAt ?? Date.now()) - state.startedAt
}
