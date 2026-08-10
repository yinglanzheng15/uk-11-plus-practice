import { QUESTIONS, getQuestion } from '../src/data/index'
import {
  intervalDaysFor,
  isDue,
  selectQuestions,
  REVIEW_INTERVAL_DAYS,
} from '../src/logic/questionSelector'
import {
  __internal as sessionStore,
  RESUME_MAX_AGE_MS,
} from '../src/logic/sessionStorage'
import { describeBackup, exportProgress, parseBackup } from '../src/logic/backup'
import {
  createSession,
  currentQuestion,
  mainAnswers,
  resolveExhausted,
  sessionReducer,
  unansweredQuestions,
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

console.log('\n== spaced repetition ==')
{
  const DAY = 86_400_000
  check('interval ladder is 0/1/3/7/21', REVIEW_INTERVAL_DAYS.join(',') === '0,1,3,7,21')
  check('a longer streak waits longer', intervalDaysFor(1) === 1 && intervalDaysFor(3) === 7)
  check('the ladder stops climbing at the top', intervalDaysFor(9) === 21)

  const now = Date.now()
  const fresh = { attempts: 1, correct: 1, lastSeen: now, lastCorrect: true, streak: 1 }
  check('answered right today is not due today', !isDue(fresh, now))
  check('the same question is due tomorrow', isDue(fresh, now + DAY + 1))

  const wrong = { attempts: 1, correct: 0, lastSeen: now, lastCorrect: false, streak: 0 }
  check('a mistake is due immediately', isDue(wrong, now))

  // The behaviour that matters: with everything already learnt, the selector
  // serves whatever has come round again rather than the most recently seen.
  const maths = QUESTIONS.filter((q) => q.subject === 'maths')
  const overdue = maths[0]
  const questions: Progress['questions'] = {}
  for (const q of maths) {
    questions[q.id] = {
      attempts: 3,
      correct: 3,
      // Everything was answered correctly today except one, seen a month ago.
      lastSeen: q.id === overdue.id ? now - 30 * DAY : now,
      lastCorrect: true,
      streak: 3,
    }
  }
  const p: Progress = { ...emptyProgress(), questions }
  const run = selectQuestions(cfg({ subjects: ['maths'], length: 5 }), p, 21, now)
  check(
    'the overdue question is served ahead of ones seen today',
    run.questions.some((q) => q.id === overdue.id),
  )

  // Scheduling must not crowd out new material: an unseen question still ranks
  // above one that has merely come round again.
  const withUnseen = { ...p, questions: { ...questions } }
  delete withUnseen.questions[maths[1].id]
  const mixed = selectQuestions(cfg({ subjects: ['maths'], length: 3 }), withUnseen, 21, now)
  check(
    'an unseen question still comes before an overdue one',
    mixed.questions.findIndex((q) => q.id === maths[1].id) <
      mixed.questions.findIndex((q) => q.id === overdue.id),
  )
}

console.log('\n== skipping and coming back ==')
{
  const questions = selectQuestions(cfg({ length: 4 }), emptyProgress(), 41).questions
  const answer = (s: SessionState) =>
    sessionReducer(
      sessionReducer(s, { type: 'answer', option: currentQuestion(s)!.answer, at: Date.now() }),
      { type: 'continue', at: Date.now() },
    )
  const skip = (s: SessionState) => sessionReducer(s, { type: 'skip', at: Date.now() })

  let s = createSession(cfg({ length: 4 }), questions)
  const first = currentQuestion(s)!.id
  s = skip(s)
  check('skipping moves straight on', currentQuestion(s)!.id === questions[1].id)
  check('the question is parked', s.skipped.length === 1)
  check('no answer is recorded for a skip', s.answers.length === 0)
  check('the skip does not reveal the answer', s.phase === 'question')

  s = answer(s)
  s = answer(s)
  s = answer(s)
  check('the skipped question comes back at the end', currentQuestion(s)!.id === first)
  check('and is flagged as the second pass', s.revisiting === true)
  check('the session has not finished yet', s.phase !== 'complete')

  s = answer(s)
  check('answering it finishes the session', s.phase === 'complete')
  check('nothing is left parked', s.skipped.length === 0)
  check('all four questions were answered', mainAnswers(s).length === 4)
  check('none is reported as unanswered', unansweredQuestions(s).length === 0)

  // Skipping again on the second pass lets the question go, rather than
  // queueing it for ever.
  let t = createSession(cfg({ length: 4 }), questions)
  t = skip(t)
  t = answer(t)
  t = answer(t)
  t = answer(t)
  check('second pass reached', t.revisiting === true)
  t = skip(t)
  check('a second skip ends the session', t.phase === 'complete')
  check('the question is left unanswered', unansweredQuestions(t).length === 1)
  check('it is not still parked', t.skipped.length === 0)

  // Skipping everything must still terminate.
  let u = createSession(cfg({ length: 4 }), questions)
  for (let i = 0; i < 20 && u.phase !== 'complete'; i += 1) u = skip(u)
  check('skipping every question terminates', u.phase === 'complete')
  check('all four are reported unanswered', unansweredQuestions(u).length === 4)

  // A skipped question survives a refresh.
  let v = createSession(cfg({ length: 4 }), questions)
  v = skip(v)
  const at = Date.now()
  const back = sessionStore.deserialise(sessionStore.serialise(v, undefined, at), at)
  check('a parked question survives a refresh', back!.state.skipped.length === 1)
}

console.log('\n== resuming a session ==')
{
  const questions = selectQuestions(cfg({ length: 5 }), emptyProgress(), 31).questions
  let s = createSession(cfg({ length: 5 }), questions)
  s = sessionReducer(s, { type: 'answer', option: currentQuestion(s)!.answer, at: Date.now() })
  s = sessionReducer(s, { type: 'continue', at: Date.now() })

  const at = Date.now()
  const snapshot = sessionStore.serialise(s, 'short-pool', at)
  const restored = sessionStore.deserialise(snapshot, at + 60_000)
  check('a saved session can be restored', restored !== null)
  check('it resumes on the same question', restored!.state.index === s.index)
  check('answers already given are kept', restored!.state.answers.length === s.answers.length)
  check('the same questions come back', restored!.state.questions[0].id === s.questions[0].id)
  check('the note is carried across', restored!.note === 'short-pool')
  // Time spent away must not eat into a timed session's remaining minutes.
  check(
    'the clock is shifted by the time away',
    restored!.state.startedAt === s.startedAt + 60_000,
  )

  const stale = sessionStore.deserialise(snapshot, at + RESUME_MAX_AGE_MS + 1)
  check('a session older than a day is not offered', stale === null)

  const gone = sessionStore.deserialise(
    { ...snapshot, questionIds: [...snapshot.questionIds.slice(1), 'no-such-question'] },
    at,
  )
  check('a session referring to a missing question is dropped', gone === null)

  let done = createSession(cfg({ length: 1 }), questions.slice(0, 1))
  done = sessionReducer(done, { type: 'timeout', at: Date.now() })
  check(
    'a finished session is never restored',
    sessionStore.deserialise(sessionStore.serialise(done, undefined, at), at) === null,
  )
}

console.log('\n== exporting and restoring progress ==')
{
  let p: Progress = emptyProgress()
  p = recordAnswer(p, QUESTIONS[0], true)
  p = recordAnswer(p, QUESTIONS[1], false)
  p = finishSession(p, {
    finishedAt: Date.now(),
    mode: 'quick5',
    subjects: ['maths'],
    total: 2,
    correct: 1,
    durationMs: 60_000,
    weakTopics: [],
  })

  const result = parseBackup(exportProgress(p))
  check('an exported file can be read back', result.ok === true)
  if (result.ok) {
    check('totals survive the round trip', result.progress.totals.answered === 2)
    check('sessions survive the round trip', result.progress.sessions.length === 1)
    check(
      'per-question records survive',
      result.progress.questions[QUESTIONS[0].id]?.streak === 1,
    )
    check('the summary mentions the count', describeBackup(result).includes('2 questions'))
  }

  check('an unrelated JSON file is refused', parseBackup('{"hello":"world"}').ok === false)
  check('a damaged file is refused', parseBackup('not json at all').ok === false)
  check(
    'a file from a newer version is refused',
    parseBackup(JSON.stringify({ kind: 'uk-11-plus-practice-progress', version: 999, progress: p }))
      .ok === false,
  )

  // Profiles saved before spaced repetition existed have no streak field.
  const legacy = JSON.parse(exportProgress(p))
  delete legacy.progress.questions[QUESTIONS[0].id].streak
  const migrated = parseBackup(JSON.stringify(legacy))
  check(
    'an older file without streaks is migrated',
    migrated.ok && migrated.progress.questions[QUESTIONS[0].id].streak === 1,
  )
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

