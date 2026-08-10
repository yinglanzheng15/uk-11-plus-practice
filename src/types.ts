/**
 * Core domain types.
 *
 * The subject list is deliberately data-driven (see `src/data/subjects.ts`) so
 * that adding Non-Verbal Reasoning, Problem Solving or Creative Comprehension
 * later means adding a JSON file plus one registry entry — not rewriting the app.
 */

export type SubjectId = string

export type Difficulty = 1 | 2 | 3 | 4

export interface Passage {
  id: string
  title: string
  /** Paragraphs of an original short fiction / non-fiction extract. */
  text: string[]
}

export interface Question {
  id: string
  subject: SubjectId
  topic: string
  skill: string
  /** Question family, e.g. 'analogy', 'comprehension-inference', 'word-problem'. */
  type: string
  difficulty: Difficulty
  /** English comprehension questions reference a passage by id. */
  passageId?: string
  question: string
  options: string[]
  /** Index into `options`. */
  answer: number
  explanation: string
  /**
   * Optional per-option note explaining why a distractor is tempting.
   * Same length as `options` when present; the correct option's entry may be ''.
   */
  distractorNotes?: string[]
  learningPoint: string
  /** Explicit follow-up questions for the wrong-answer learning loop. */
  followUpIds?: string[]
  tags: string[]
}

/** Per-question progress record persisted to localStorage. */
export interface QuestionRecord {
  attempts: number
  correct: number
  /** Epoch ms of the most recent attempt. */
  lastSeen: number
  /** Whether the most recent attempt was correct. */
  lastCorrect: boolean
  /**
   * Consecutive correct answers, reset to 0 by a mistake. Drives the spaced
   * -repetition interval — see `REVIEW_INTERVAL_DAYS` in questionSelector.ts.
   */
  streak: number
}

export interface TopicKey {
  subject: SubjectId
  topic: string
}

export interface SessionAnswer {
  questionId: string
  chosen: number
  correct: boolean
  /** True for questions served by the learning loop rather than the main run. */
  isFollowUp: boolean
  /** Time spent on the question, in ms. */
  elapsedMs: number
}

export interface SessionSummaryRecord {
  /** Epoch ms when the session finished. */
  finishedAt: number
  mode: string
  subjects: SubjectId[]
  total: number
  correct: number
  durationMs: number
  /** Topics answered incorrectly at least once during the session. */
  weakTopics: string[]
}

/** Why a question was flagged. Presets keep reports comparable and quick to file. */
export type FeedbackReason =
  | 'answer-wrong'
  | 'confusing'
  | 'too-hard'
  | 'too-easy'
  | 'typo'
  | 'other'

export interface FeedbackItem {
  id: string
  createdAt: number
  /** 'question' reports are tied to a question id; 'general' notes are free-standing. */
  kind: 'question' | 'general'
  questionId?: string
  reason?: FeedbackReason
  message: string
}

export interface Progress {
  version: number
  questions: Record<string, QuestionRecord>
  /** Rolling list of the most recently served question ids (newest first). */
  recentQuestionIds: string[]
  sessions: SessionSummaryRecord[]
  /** Newest first. Stored locally like everything else; never sent anywhere. */
  feedback: FeedbackItem[]
  streak: {
    /** Local date string (YYYY-MM-DD) of the last day a session was completed. */
    lastDate: string | null
    current: number
    best: number
  }
  totals: {
    answered: number
    correct: number
  }
  preferences: {
    timed: boolean
  }
}

export type SessionMode =
  | 'quick5'
  | 'quick10'
  | 'quick20'
  | 'subject'
  | 'mixed'
  | 'mistakes'
  | 'weak'
  | 'challenge'

export interface SessionConfig {
  mode: SessionMode
  length: number
  /** Empty means "all subjects". */
  subjects: SubjectId[]
  topic?: string
  timed: boolean
  /** Total time allowed, in ms. Only meaningful when `timed` is true. */
  timeLimitMs?: number
}
