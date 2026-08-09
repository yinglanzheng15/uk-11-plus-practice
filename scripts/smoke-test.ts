import { QUESTIONS, getQuestion } from '../src/data/index'
import { selectQuestions } from '../src/logic/questionSelector'
import {
  createSession,
  currentQuestion,
  mainAnswers,
  resolveExhausted,
  sessionReducer,
  type SessionState,
} from '../src/logic/session'
import {
  finishSession,
  mistakeIds,
  noteServed,
  recordAnswer,
} from '../src/logic/progress'
import { emptyProgress } from '../src/logic/storage'
import { topicMastery } from '../src/logic/mastery'
import type { Progress, SessionConfig } from '../src/types'

let failures = 0
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL ${name} ${detail}`)
  }
}

function cfg(over: Partial<SessionConfig> = {}): SessionConfig {
  return { mode: 'quick10', length: 10, subjects: [], timed: false, ...over }
}

console.log('\n== selection ==')
let progress: Progress = emptyProgress()

const r1 = selectQuestions(cfg(), progress, 1)
check('quick10 returns 10 questions', r1.questions.length === 10, `got ${r1.questions.length}`)
check('no duplicates in a session', new Set(r1.questions.map((q) => q.id)).size === 10)
check('mixed session spans subjects', new Set(r1.questions.map((q) => q.subject)).size > 1)

progress = noteServed(progress, r1.questions.map((q) => q.id))
const r2 = selectQuestions(cfg(), progress, 2)
const overlap = r2.questions.filter((q) => r1.questions.some((p) => p.id === q.id)).length
check('little overlap with previous session', overlap === 0, `overlap=${overlap}`)

const subjOnly = selectQuestions(cfg({ mode: 'subject', subjects: ['maths'] }), emptyProgress(), 3)
check('subject filter respected', subjOnly.questions.every((q) => q.subject === 'maths'))

const topicOnly = selectQuestions(
  cfg({ mode: 'subject', subjects: ['maths'], topic: 'Fractions', length: 5 }),
  emptyProgress(),
  4,
)
check('topic filter respected', topicOnly.questions.every((q) => q.topic === 'Fractions'))
check('topic session non-empty', topicOnly.questions.length > 0)

const challenge = selectQuestions(cfg({ mode: 'challenge' }), emptyProgress(), 5)
check('challenge prefers difficulty >= 3', challenge.questions.every((q) => q.difficulty >= 3))

console.log('\n== empty / edge cases ==')
const emptyMistakes = selectQuestions(cfg({ mode: 'mistakes' }), emptyProgress(), 6)
check('mistakes mode empty on fresh profile', emptyMistakes.questions.length === 0)
check('empty pool is flagged', emptyMistakes.note === 'empty-pool')

const emptyWeak = selectQuestions(cfg({ mode: 'weak' }), emptyProgress(), 7)
check('weak mode empty on fresh profile', emptyWeak.questions.length === 0)

const oversized = selectQuestions(
  cfg({ mode: 'subject', subjects: ['maths'], topic: 'Fractions', length: 99 }),
  emptyProgress(),
  8,
)
check('oversized request is capped, not crashed', oversized.questions.length < 99)
check('short pool is flagged', oversized.note === 'short-pool')

const emptySession = createSession(cfg({ length: 0 }), [])
check('zero-question session completes immediately', emptySession.phase === 'complete')

console.log('\n== quiz engine: all correct ==')
{
  const questions = selectQuestions(cfg({ length: 5, mode: 'quick5' }), emptyProgress(), 9).questions
  let s: SessionState = createSession(cfg({ length: 5, mode: 'quick5' }), questions)
  let guard = 0
  while (s.phase !== 'complete' && guard++ < 60) {
    const q = currentQuestion(s)!
    s = sessionReducer(s, { type: 'answer', option: q.answer, at: Date.now() })
    s = sessionReducer(s, { type: 'continue', at: Date.now() })
    if (s.phase === 'technique') s = sessionReducer(s, { type: 'continue', at: Date.now() })
  }
  check('session completes', s.phase === 'complete')
  check('5 main answers recorded', mainAnswers(s).length === 5, `got ${mainAnswers(s).length}`)
  check('all scored correct', mainAnswers(s).every((a) => a.correct))
  check('no follow-ups served', s.answers.every((a) => !a.isFollowUp))
}

console.log('\n== quiz engine: wrong -> follow-up correct ==')
{
  const questions = selectQuestions(cfg({ length: 3 }), emptyProgress(), 10).questions
  let s: SessionState = createSession(cfg({ length: 3 }), questions)
  const first = currentQuestion(s)!
  const wrong = (first.answer + 1) % first.options.length
  s = sessionReducer(s, { type: 'answer', option: wrong, at: Date.now() })
  check('phase is feedback after wrong answer', s.phase === 'feedback')
  check('marked incorrect', s.lastCorrect === false)

  s = sessionReducer(s, { type: 'continue', at: Date.now() })
  check('enters learning loop', s.phase === 'followup', `phase=${s.phase}`)
  check('follow-up is a different question', s.followUp?.id !== first.id)
  check('follow-up round is 1', s.followUpRound === 1)

  const fu = currentQuestion(s)!
  s = sessionReducer(s, { type: 'answer', option: fu.answer, at: Date.now() })
  check('follow-up feedback phase', s.phase === 'followup-feedback')
  check('follow-up correct', s.lastCorrect === true)

  s = sessionReducer(s, { type: 'continue', at: Date.now() })
  check('returns to main run', s.index === 1 && (s.phase === 'question' || s.phase === 'technique'))
  check('follow-up excluded from score', mainAnswers(s).length === 1)
  check('follow-up still recorded in answers', s.answers.length === 2)
}

console.log('\n== quiz engine: exhausting the retry loop ==')
{
  const questions = selectQuestions(cfg({ length: 3 }), emptyProgress(), 11).questions
  let s: SessionState = createSession(cfg({ length: 3 }), questions)
  const wrongFor = (st: SessionState) => {
    const q = currentQuestion(st)!
    return (q.answer + 1) % q.options.length
  }
  s = sessionReducer(s, { type: 'answer', option: wrongFor(s), at: Date.now() })
  s = sessionReducer(s, { type: 'continue', at: Date.now() })
  s = sessionReducer(s, { type: 'answer', option: wrongFor(s), at: Date.now() })
  s = sessionReducer(s, { type: 'continue', at: Date.now() })
  check('second follow-up served', s.followUpRound === 2, `round=${s.followUpRound}`)
  s = sessionReducer(s, { type: 'answer', option: wrongFor(s), at: Date.now() })
  s = sessionReducer(s, { type: 'continue', at: Date.now() })
  check('loop reports exhausted', s.followUpExhausted === true)
  const before = s.index
  s = resolveExhausted(s, Date.now())
  check('child is not trapped â€” moves on', s.index === before + 1 || s.phase === 'complete')
  check('never repeats a question in-session', new Set(s.usedIds).size === s.usedIds.length)
}

console.log('\n== timer ==')
{
  const questions = selectQuestions(cfg({ length: 20, mode: 'quick20' }), emptyProgress(), 12).questions
  let s: SessionState = createSession(cfg({ length: 20, mode: 'quick20', timed: true, timeLimitMs: 1000 }), questions)
  s = sessionReducer(s, { type: 'answer', option: currentQuestion(s)!.answer, at: Date.now() })
  s = sessionReducer(s, { type: 'timeout', at: Date.now() })
  check('timeout ends the session', s.phase === 'complete')
  check('timeout flagged', s.timedOut === true)
  check('answers so far are kept', mainAnswers(s).length === 1)
}

console.log('\n== progress, mastery, persistence ==')
{
  let p: Progress = emptyProgress()
  const frac = QUESTIONS.filter((q) => q.topic === 'Fractions')
  for (const q of frac) p = recordAnswer(p, q, false)
  const fracMastery = topicMastery(p).find((t) => t.topic === 'Fractions')!
  check('all-wrong topic scores 0', fracMastery.score === 0, `score=${fracMastery.score}`)
  check('band is Needs work', fracMastery.band === 'Needs work')
  check('mistakes list populated', mistakeIds(p).length === frac.length)

  for (const q of frac) p = recordAnswer(p, q, true)
  const after = topicMastery(p).find((t) => t.topic === 'Fractions')!
  check('mastery rises after correct retries', (after.score ?? 0) > 0, `score=${after.score}`)
  check('mistakes clear once answered correctly', mistakeIds(p).length === 0)

  const weakNow = selectQuestions(cfg({ mode: 'weak' }), p, 13)
  check('weak mode handles a recovered profile', Array.isArray(weakNow.questions))

  p = recordAnswer(p, frac[0], false)
  const mistakeRun = selectQuestions(cfg({ mode: 'mistakes', length: 5 }), p, 14)
  check('mistakes mode now returns the wrong question', mistakeRun.questions.some((q) => q.id === frac[0].id))

  const before = p.streak.current
  p = finishSession(p, {
    finishedAt: Date.now(),
    mode: 'quick10',
    subjects: ['maths'],
    total: 10,
    correct: 7,
    durationMs: 300000,
    weakTopics: ['Fractions'],
  })
  check('streak starts at 1', p.streak.current === 1 && before === 0)
  check('session history recorded', p.sessions.length === 1)

  const round = JSON.parse(JSON.stringify(p)) as Progress
  check('progress survives a JSON round-trip', round.totals.answered === p.totals.answered)
}

console.log('\n== bank integrity ==')
{
  check('every question resolvable by id', QUESTIONS.every((q) => getQuestion(q.id)?.id === q.id))
  check('every answer index in range', QUESTIONS.every((q) => q.answer >= 0 && q.answer < q.options.length))
  const positions = new Map<number, number>()
  for (const q of QUESTIONS) positions.set(q.answer, (positions.get(q.answer) ?? 0) + 1)
  const maxShare = Math.max(...positions.values()) / QUESTIONS.length
  check('answer positions are spread out', maxShare < 0.45, `max share=${(maxShare * 100).toFixed(0)}%`)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

