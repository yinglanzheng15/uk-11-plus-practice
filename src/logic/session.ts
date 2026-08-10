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
  /**
   * Indices of main questions parked by "Skip for now", oldest first. They are
   * offered again once the end of the run is reached; anything still here when
   * the session finishes was genuinely left unanswered.
   */
  skipped: number[]
  /** True while working back through the skipped questions at the end. */
  revisiting: boolean
  /** Every question id shown in this session, main or follow-up. */
  usedIds: string[]
  techniqueCard: TechniqueCard | null
  startedAt: number
  questionStartedAt: number
  /**
   * Time the clock has been stopped for, in ms. A timed session should measure
   * time spent *answering*, not time spent reading an explanation — otherwise
   * engaging with the learning loop costs the child time, which is precisely
   * backwards.
   */
  pausedMs: number
  /** When the clock stopped, or null while it is running. */
  pausedAt: number | null
  endedAt: number | null
  /** Set when the timer ran out rather than the child finishing all questions. */
  timedOut: boolean
}

export type SessionAction =
  | { type: 'answer'; option: number; at: number }
  | { type: 'continue'; at: number }
  | { type: 'skip'; at: number }
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
    skipped: [],
    revisiting: false,
    usedIds: questions.map((q) => q.id),
    techniqueCard: null,
    startedAt: at,
    questionStartedAt: at,
    pausedMs: 0,
    pausedAt: null,
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

/**
 * A short technique card appears after every 6th question answered — so a
 * Quick 20 sees about three of them, and a Quick 5 none at all. Never two in a
 * row: the card just shown is still on the state, which blocks the next one.
 */
function techniqueCardFor(state: SessionState): TechniqueCard | null {
  const answered = mainAnswers(state).length
  const isLast = state.index + 1 >= state.questions.length
  if (isLast || answered === 0 || answered % 6 !== 0) return null
  if (state.techniqueCard) return null
  const idx = (state.startedAt + answered) % TECHNIQUE_CARDS.length
  return TECHNIQUE_CARDS[idx]
}

/** Stop the clock. Idempotent, so a double transition cannot double-count. */
function pause(state: SessionState, at: number): SessionState {
  return state.pausedAt === null ? { ...state, pausedAt: at } : state
}

/** Start the clock again, banking however long it was stopped for. */
function resume(state: SessionState, at: number): SessionState {
  if (state.pausedAt === null) return state
  return {
    ...state,
    pausedMs: state.pausedMs + Math.max(0, at - state.pausedAt),
    pausedAt: null,
  }
}

/** Common reset when any question is left behind, whatever comes next. */
function moveTo(
  state: SessionState,
  index: number,
  at: number,
  extra: Partial<SessionState> = {},
): SessionState {
  return {
    ...resume(state, at),
    index,
    phase: 'question',
    selected: null,
    followUp: null,
    followUpRound: 0,
    followUpExhausted: false,
    questionStartedAt: at,
    ...extra,
  }
}

/**
 * Finish with the current question and move on.
 *
 * The run goes straight through the questions once, then returns to anything
 * parked by "Skip for now". Whatever is still parked when that second pass ends
 * was left unanswered, and the summary says so.
 */
function advance(state: SessionState, at: number, park = false): SessionState {
  // Whatever happens next, this question is no longer waiting where it was.
  // `park` puts it back at the end of the queue instead of dropping it.
  const others = state.skipped.filter((i) => i !== state.index)
  const remaining = park ? [...others, state.index] : others
  const complete = (): SessionState => ({
    ...state,
    skipped: remaining,
    phase: 'complete',
    endedAt: at,
    selected: null,
  })

  if (state.revisiting) {
    if (remaining.length === 0) return complete()
    return moveTo(state, remaining[0], at, { skipped: remaining })
  }

  const nextIndex = state.index + 1
  if (nextIndex < state.questions.length) {
    // No tip after a skip. The answered count has not moved, so the same card
    // would otherwise be offered again on the next skip in a row.
    const card = park ? null : techniqueCardFor(state)
    const next = moveTo(state, nextIndex, at, {
      skipped: remaining,
      phase: card ? 'technique' : 'question',
      techniqueCard: card,
    })
    return card ? pause(next, at) : next
  }

  // End of the straight run. Anything skipped now gets a second look.
  if (remaining.length === 0) return complete()
  return moveTo(state, remaining[0], at, { skipped: remaining, revisiting: true })
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'timeout':
      if (state.phase === 'complete') return state
      return { ...state, phase: 'complete', endedAt: action.at, timedOut: true }

    case 'skip': {
      // Only a main question can be parked. A follow-up is the teaching part of
      // a mistake, and the loop already lets the child out after two rounds.
      if (state.phase !== 'question') return state
      // On the second pass the child has already had their second look, so a
      // skip there lets the question go rather than queueing it again for ever.
      return advance(state, action.at, !state.revisiting)
    }

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
        // Reading the explanation is not answering time.
        ...pause(state, action.at),
        selected: action.option,
        lastCorrect: correct,
        answers: [...state.answers, answer],
        phase: state.phase === 'question' ? 'feedback' : 'followup-feedback',
      }
    }

    case 'continue': {
      if (state.phase === 'technique') {
        return { ...resume(state, action.at), phase: 'question', questionStartedAt: action.at }
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
          ...resume(state, action.at),
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
          ...resume(state, action.at),
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

/** Main questions the child never answered — skipped and left, or timed out. */
export function unansweredQuestions(state: SessionState): Question[] {
  const answered = new Set(mainAnswers(state).map((a) => a.questionId))
  return state.questions.filter((q) => !answered.has(q.id))
}

/** Wall-clock length of the session, including time spent reading feedback. */
export function sessionDurationMs(state: SessionState): number {
  return (state.endedAt ?? Date.now()) - state.startedAt
}

/**
 * When a timed session runs out, in epoch ms. Moves later every time the clock
 * is stopped, so the limit only ever covers time spent answering.
 */
export function deadlineAt(state: SessionState, limitMs: number): number {
  return state.startedAt + state.pausedMs + limitMs
}
