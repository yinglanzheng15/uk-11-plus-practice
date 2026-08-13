import { readFileSync } from 'node:fs'
import { QUESTIONS, getQuestion, topicKey, installPaidQuestions } from '../src/data/index'
import { FREE_PER_TOPIC, partitionBank } from '../src/data/access'
import { hashString, seededRandom, shuffleOptions } from '../src/data/shuffle'
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
import { initAnalytics, scoreBand, track } from '../src/logic/analytics'
import { PACE_PRESETS, timeLimitFor } from '../src/logic/pace'
import { PAPERS, paperLength } from '../src/logic/papers'
import { formatDuration } from '../src/components/Timer'
import {
  createSession,
  currentQuestion,
  deadlineAt,
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
import {
  clearProgress,
  emptyProgress,
  flushProgress,
  loadProgress,
  saveProgress,
  DEFAULT_SECONDS_PER_QUESTION,
  SCHEMA_VERSION,
} from '../src/logic/storage'
import {
  addFeedback,
  clearFeedback,
  feedbackToMarkdown,
  reasonLabel,
  removeFeedback,
} from '../src/logic/feedback'
import { topicMastery } from '../src/logic/mastery'
import type { Progress, SessionConfig } from '../src/types'

// The client bundles only the free half of the bank and fetches the rest at
// runtime. Node has no fetch target here, so the test installs the paid half
// straight from the file the build emits — every check below then sees the same
// complete bank the app sees.
const freeOnlyCount = QUESTIONS.length
const paidBank = JSON.parse(readFileSync('public/paid.json', 'utf8'))
const installed = installPaidQuestions(paidBank)

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

const mixedSubset = selectQuestions(
  cfg({ mode: 'mixed', subjects: ['maths', 'english'], length: 10 }),
  emptyProgress(),
  3,
)
check(
  'mixed session respects a chosen subject subset',
  mixedSubset.questions.every((q) => q.subject === 'maths' || q.subject === 'english'),
)
check(
  'mixed session with a subset still spans those subjects',
  new Set(mixedSubset.questions.map((q) => q.subject)).size > 1,
)

const quickSubset = selectQuestions(
  cfg({ mode: 'quick10', subjects: ['maths', 'english'], length: 10 }),
  emptyProgress(),
  3,
)
check(
  'quick session respects a chosen subject subset',
  quickSubset.questions.every((q) => q.subject === 'maths' || q.subject === 'english'),
)

const topicOnly = selectQuestions(
  cfg({
    mode: 'subject',
    subjects: ['maths'],
    topicKeys: [topicKey('maths', 'Fractions')],
    length: 5,
  }),
  emptyProgress(),
  4,
)
check('topic filter respected', topicOnly.questions.every((q) => q.topic === 'Fractions'))
check('topic session non-empty', topicOnly.questions.length > 0)

// "Vocabulary" is a topic in both English and Verbal Reasoning, so filtering on
// the bare topic name would quietly pull in the wrong subject.
const sharedTopicName = selectQuestions(
  cfg({
    mode: 'quick10',
    subjects: ['english', 'verbal-reasoning'],
    topicKeys: [topicKey('english', 'Vocabulary')],
    length: 10,
  }),
  emptyProgress(),
  6,
)
check(
  'topic keys do not leak across subjects sharing a topic name',
  sharedTopicName.questions.length > 0 &&
    sharedTopicName.questions.every(
      (q) => q.subject === 'english' && q.topic === 'Vocabulary',
    ),
)

const multiTopic = selectQuestions(
  cfg({
    mode: 'quick10',
    subjects: ['maths'],
    topicKeys: [topicKey('maths', 'Fractions'), topicKey('maths', 'Geometry')],
    length: 10,
  }),
  emptyProgress(),
  7,
)
check(
  'several topics can be combined',
  multiTopic.questions.every((q) => q.topic === 'Fractions' || q.topic === 'Geometry'),
)
check(
  'a multi-topic session draws on both',
  new Set(multiTopic.questions.map((q) => q.topic)).size === 2,
)

const challenge = selectQuestions(cfg({ mode: 'challenge' }), emptyProgress(), 5)
check('challenge prefers difficulty >= 3', challenge.questions.every((q) => q.difficulty >= 3))

console.log('\n== empty / edge cases ==')
const emptyMistakes = selectQuestions(cfg({ mode: 'mistakes' }), emptyProgress(), 6)
check('mistakes mode empty on fresh profile', emptyMistakes.questions.length === 0)
check('empty pool is flagged', emptyMistakes.note === 'empty-pool')

const emptyWeak = selectQuestions(cfg({ mode: 'weak' }), emptyProgress(), 7)
check('weak mode empty on fresh profile', emptyWeak.questions.length === 0)

const oversized = selectQuestions(
  cfg({
    mode: 'subject',
    subjects: ['maths'],
    topicKeys: [topicKey('maths', 'Fractions')],
    length: 99,
  }),
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

console.log('\n== declining the practice question ==')
{
  const questions = selectQuestions(cfg({ length: 3 }), emptyProgress(), 61).questions
  let s: SessionState = createSession(cfg({ length: 3 }), questions)
  const first = currentQuestion(s)!
  const wrong = (first.answer + 1) % first.options.length

  s = sessionReducer(s, { type: 'answer', option: wrong, at: Date.now() })
  check('the explanation is shown first', s.phase === 'feedback')

  s = sessionReducer(s, { type: 'move-on', at: Date.now() })
  check('moving on skips the learning loop', s.phase === 'question' || s.phase === 'technique')
  check('it goes to the next question', s.index === 1)
  check('no follow-up was served', s.answers.every((a) => !a.isFollowUp))
  check('the mistake is still recorded', mainAnswers(s).filter((a) => !a.correct).length === 1)
  check('so it is there to review at the end', mainAnswers(s)[0].chosen === wrong)

  // Available from inside the loop too, not just at the first explanation.
  let t: SessionState = createSession(cfg({ length: 3 }), questions)
  const q0 = currentQuestion(t)!
  t = sessionReducer(t, { type: 'answer', option: (q0.answer + 1) % q0.options.length, at: Date.now() })
  t = sessionReducer(t, { type: 'continue', at: Date.now() })
  check('in the learning loop', t.phase === 'followup')
  const fu = currentQuestion(t)!
  t = sessionReducer(t, { type: 'answer', option: (fu.answer + 1) % fu.options.length, at: Date.now() })
  t = sessionReducer(t, { type: 'move-on', at: Date.now() })
  check('leaving the loop moves to the next question', t.index === 1)
  check('the loop state is cleared', t.followUp === null && t.followUpRound === 0)

  // It must not fire from anywhere else.
  let u: SessionState = createSession(cfg({ length: 3 }), questions)
  check(
    'moving on does nothing before an answer',
    sessionReducer(u, { type: 'move-on', at: Date.now() }) === u,
  )

  // The clock is handed back exactly as it is when continuing normally.
  const LIMIT = 60_000
  const t0 = 2_000_000
  let v = createSession(cfg({ length: 3, timed: true, timeLimitMs: LIMIT }), questions, t0)
  const q1 = currentQuestion(v)!
  v = sessionReducer(v, { type: 'answer', option: (q1.answer + 1) % q1.options.length, at: t0 + 1_000 })
  v = sessionReducer(v, { type: 'move-on', at: t0 + 21_000 })
  check('reading time is given back when moving on', v.pausedMs === 20_000)
  check('and the clock is running again', v.pausedAt === null)
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

console.log('\n== adjustable pace ==')
{
  check('the default is 45 seconds', emptyProgress().preferences.secondsPerQuestion === 45)
  check('a 10-question session at 45s is 7:30', formatDuration(timeLimitFor(10, 45)) === '7:30')
  check('the same session at exam pace is shorter', timeLimitFor(10, 37) < timeLimitFor(10, 45))
  check('20 questions at 37s is about 12 minutes', timeLimitFor(20, 37) === 740_000)
  check('every preset is a positive number of seconds', PACE_PRESETS.every((p) => p.seconds > 0))
  check('presets run slowest to fastest', PACE_PRESETS.every((p, i, a) => i === 0 || a[i - 1].seconds > p.seconds))
  check('the default is one of the presets', PACE_PRESETS.some((p) => p.seconds === 45))

  // Profiles saved before the setting existed, and damaged values, must not
  // produce a session with a nonsensical or zero time limit.
  const legacy = JSON.parse(exportProgress(emptyProgress()))
  delete legacy.progress.preferences.secondsPerQuestion
  const migrated = parseBackup(JSON.stringify(legacy))
  check(
    'an older profile gets the default pace',
    migrated.ok && migrated.progress.preferences.secondsPerQuestion === 45,
  )

  const damaged = JSON.parse(exportProgress(emptyProgress()))
  damaged.progress.preferences.secondsPerQuestion = 0
  const repaired = parseBackup(JSON.stringify(damaged))
  check(
    'a zero pace is repaired rather than used',
    repaired.ok && repaired.progress.preferences.secondsPerQuestion === 45,
  )
}

console.log('\n== the clock stops for explanations ==')
{
  const LIMIT = 10 * 60_000
  const questions = selectQuestions(cfg({ length: 4 }), emptyProgress(), 51).questions
  const conf = cfg({ length: 4, timed: true, timeLimitMs: LIMIT })
  const t0 = 1_000_000

  let s = createSession(conf, questions, t0)
  check('the clock starts running', s.pausedAt === null && s.pausedMs === 0)
  check('the first deadline is the plain limit', deadlineAt(s, LIMIT) === t0 + LIMIT)

  // Answer wrongly, then spend a minute reading the explanation.
  const q = currentQuestion(s)!
  s = sessionReducer(s, { type: 'answer', option: (q.answer + 1) % q.options.length, at: t0 + 5_000 })
  check('answering stops the clock', s.pausedAt === t0 + 5_000)
  check('the deadline has not moved yet', deadlineAt(s, LIMIT) === t0 + LIMIT)

  s = sessionReducer(s, { type: 'continue', at: t0 + 65_000 })
  check('entering the learning loop restarts it', s.pausedAt === null)
  check('the minute spent reading is given back', s.pausedMs === 60_000)
  check('the deadline moved by a minute', deadlineAt(s, LIMIT) === t0 + LIMIT + 60_000)

  // A correct follow-up, read for another 30 seconds.
  const fu = currentQuestion(s)!
  s = sessionReducer(s, { type: 'answer', option: fu.answer, at: t0 + 70_000 })
  s = sessionReducer(s, { type: 'continue', at: t0 + 100_000 })
  check('follow-up reading time is given back too', s.pausedMs === 90_000)
  check('the clock is running on the next question', s.pausedAt === null)

  // A correct answer still pauses while its explanation is on screen.
  let u = createSession(conf, questions, t0)
  u = sessionReducer(u, { type: 'answer', option: currentQuestion(u)!.answer, at: t0 + 1_000 })
  check('a correct answer stops the clock as well', u.pausedAt === t0 + 1_000)
  u = sessionReducer(u, { type: 'continue', at: t0 + 11_000 })
  check('and hands the time back on continue', u.pausedMs === 10_000)

  // Skipping is not reading time, so it must not earn any credit.
  let v = createSession(conf, questions, t0)
  v = sessionReducer(v, { type: 'skip', at: t0 + 3_000 })
  check('skipping does not stop the clock', v.pausedAt === null && v.pausedMs === 0)

  // A paused session that is saved and restored keeps the time it had left.
  let w = createSession(conf, questions, t0)
  w = sessionReducer(w, { type: 'answer', option: currentQuestion(w)!.answer, at: t0 + 5_000 })
  const stored = sessionStore.serialise(w, undefined, t0 + 6_000)
  const back = sessionStore.deserialise(stored, t0 + 6_000 + 120_000)!
  check(
    'a session restored mid-explanation is still paused',
    back.state.pausedAt !== null,
  )
  check(
    'and has exactly the time it had left',
    deadlineAt(back.state, LIMIT) - back.state.pausedAt! === LIMIT - 5_000,
  )
}

console.log('\n== technique cards ==')
{
  const questions = selectQuestions(cfg({ length: 10 }), emptyProgress(), 52).questions
  const answer = (s: SessionState) =>
    sessionReducer(
      sessionReducer(s, { type: 'answer', option: currentQuestion(s)!.answer, at: Date.now() }),
      { type: 'continue', at: Date.now() },
    )

  let s = createSession(cfg({ length: 10 }), questions)
  for (let i = 0; i < 6; i += 1) {
    s = answer(s)
    if (s.phase === 'technique') break
  }
  check('a tip appears after six answers', s.phase === 'technique')
  s = sessionReducer(s, { type: 'continue', at: Date.now() })

  // Skipping does not move the answered count, so without a guard the same
  // card would be offered again on every skip in a row.
  s = sessionReducer(s, { type: 'skip', at: Date.now() })
  check('skipping does not trigger a tip', s.phase === 'question')
  s = sessionReducer(s, { type: 'skip', at: Date.now() })
  check('nor does a second skip in a row', s.phase === 'question')
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

  // Schema 4 stored the chosen subjects as `mixedSubjects`; renaming the field
  // must not throw away a selection the child already made.
  const v4 = JSON.parse(exportProgress(emptyProgress()))
  delete v4.progress.preferences.practiceSubjects
  delete v4.progress.preferences.practiceTopics
  v4.progress.preferences.mixedSubjects = ['maths', 'english']
  const renamed = parseBackup(JSON.stringify(v4))
  check(
    'a schema 4 subject choice survives the rename',
    renamed.ok &&
      renamed.progress.preferences.practiceSubjects.join(',') === 'maths,english',
  )
  check(
    'a schema 4 profile gets an empty topic selection',
    renamed.ok &&
      Object.keys(renamed.progress.preferences.practiceTopics).length === 0,
  )
}

console.log('\n== free / paid split ==')
{
  check('the free half alone is not the whole bank', freeOnlyCount < QUESTIONS.length)
  check('the paid half installed', installed === paidBank.length, `installed=${installed}`)
  check('the two halves reassemble the bank', freeOnlyCount + installed === QUESTIONS.length)

  // Every topic must survive into the free tier, or a subject would look broken
  // to a non-paying visitor.
  const { free, paid } = partitionBank(QUESTIONS)
  const topicsOf = (qs: typeof QUESTIONS) => new Set(qs.map((q) => `${q.subject}::${q.topic}`))
  check('every topic is represented in the free half', topicsOf(free).size === topicsOf(QUESTIONS).size)
  check(
    'no topic gives away more than the cap',
    [...topicsOf(QUESTIONS)].every(
      (k) => free.filter((q) => `${q.subject}::${q.topic}` === k).length <= FREE_PER_TOPIC,
    ),
  )

  // A question in both halves would be served twice in one session.
  const freeIds = new Set(free.map((q) => q.id))
  check('the halves do not overlap', paid.every((q) => !freeIds.has(q.id)))
  check('the split loses nothing', free.length + paid.length === QUESTIONS.length)

  // Same bank in, same split out — a redeploy must not move questions between
  // tiers under a child who is part-way through the free one.
  const again = partitionBank(QUESTIONS)
  check(
    'the split is deterministic',
    again.free.map((q) => q.id).join() === free.map((q) => q.id).join(),
  )

  // Installing twice must not duplicate: the loader is called once at startup
  // today, but a retry or a re-auth would call it again.
  check('installing the paid half twice is a no-op', installPaidQuestions(paidBank) === 0)
}

console.log('\n== batched saving ==')
{
  // storage.ts talks to window.localStorage. Node has neither, so stand one up
  // and count what actually reaches it — the point of the batching is the
  // number of writes, which is only observable from the store's side.
  let writes = 0
  let removes = 0
  let stored: string | null = null
  ;(globalThis as any).window = {
    localStorage: {
      getItem: () => stored,
      setItem: (_k: string, v: string) => {
        writes += 1
        stored = v
      },
      removeItem: () => {
        removes += 1
        stored = null
      },
    },
  }

  let p: Progress = emptyProgress()
  for (let i = 0; i < 5; i += 1) {
    p = { ...p, totals: { answered: i + 1, correct: i } }
    saveProgress(p)
  }
  check('a burst of saves writes nothing yet', writes === 0, `writes=${writes}`)
  check(
    'but a read still sees the newest value',
    loadProgress().totals.answered === 5,
  )

  flushProgress()
  check('the flush collapses them into one write', writes === 1, `writes=${writes}`)
  check('and it is the last value that landed', loadProgress().totals.answered === 5)

  flushProgress()
  check('flushing again writes nothing', writes === 1, `writes=${writes}`)

  // A queued write landing after a reset would put the wiped history back.
  saveProgress({ ...p, totals: { answered: 99, correct: 99 } })
  clearProgress()
  check('a reset removes the stored profile', removes === 1)
  flushProgress()
  check('and the queued write is dropped, not replayed', writes === 1, `writes=${writes}`)
  check('so the profile stays empty', loadProgress().totals.answered === 0)

  delete (globalThis as any).window
}

console.log('\n== full paper ==')
{
  for (const paper of PAPERS) {
    const length = paperLength(paper)
    const result = selectQuestions(
      {
        mode: 'paper',
        length,
        subjects: [paper.subject],
        timed: true,
        timeLimitMs: paper.minutes * 60_000,
      },
      emptyProgress(),
    )
    check(
      `${paper.subject}: the bank can fill the paper`,
      result.questions.length === length,
      `got ${result.questions.length}/${length}`,
    )
    check(`${paper.subject}: not flagged short`, result.note !== 'short-pool')
    check(
      `${paper.subject}: every question is in the subject`,
      result.questions.every((q) => q.subject === paper.subject),
    )
    check(
      `${paper.subject}: no repeats`,
      new Set(result.questions.map((q) => q.id)).size === result.questions.length,
    )
    // Each section must get its full quota, in the booklet's order — that is
    // the whole difference between a paper and a long practice run.
    const quotasMet = paper.sections.every((section) => {
      const n = result.questions.filter((q) => section.topics.includes(q.topic)).length
      return n === section.count
    })
    check(`${paper.subject}: every section gets its quota`, quotasMet)
    const order = result.questions.map((q) =>
      paper.sections.findIndex((s) => s.topics.includes(q.topic)),
    )
    check(
      `${paper.subject}: sections are not interleaved`,
      order.every((s, i) => i === 0 || s >= order[i - 1]),
    )
  }

  // Sections sharing a topic would double-count in the breakdown and starve
  // one of the two quotas.
  const overlapping = PAPERS.some((p) => {
    const topics = p.sections.flatMap((s) => s.topics)
    return new Set(topics).size !== topics.length
  })
  check('no paper has a topic in two sections', !overlapping)

  // A paper runs straight through: no learning loop, no technique cards.
  {
    const paper = PAPERS[0]
    const config = {
      mode: 'paper' as const,
      length: paperLength(paper),
      subjects: [paper.subject],
      timed: true,
      timeLimitMs: paper.minutes * 60_000,
    }
    const picked = selectQuestions(config, emptyProgress())
    let s = createSession(config, picked.questions.slice(0, 8), Date.now())
    let sawFollowUp = false
    let sawTechnique = false
    let guard = 0
    while (s.phase !== 'complete' && guard++ < 200) {
      if (s.phase === 'technique') sawTechnique = true
      if (s.phase === 'followup' || s.phase === 'followup-feedback') sawFollowUp = true
      if (s.phase === 'question') {
        // Answer everything wrong — the case that would trigger the loop.
        const q = currentQuestion(s)!
        s = sessionReducer(s, { type: 'answer', option: (q.answer + 1) % 5, at: Date.now() })
      } else {
        s = sessionReducer(s, { type: 'continue', at: Date.now() })
      }
    }
    check('a paper completes', s.phase === 'complete')
    check('no learning loop in a paper', !sawFollowUp)
    check('no technique cards in a paper', !sawTechnique)
    check('all 8 answers are main-run answers', mainAnswers(s).length === 8)
  }
}

console.log('\n== error-spotting questions keep their option order ==')
{
  // The authored file, before the load-time shuffle, to compare against.
  const raw = JSON.parse(readFileSync('src/data/english.json', 'utf8')) as {
    id: string
    options: string[]
  }[]

  // Options are normally permuted at load time. These carry the sentence in
  // parts A-D, so a shuffle would scramble the sentence and move "No mistake"
  // out of E — the position the child is taught to consider last.
  const fixed = QUESTIONS.filter((q) => q.fixedOptions)
  check('the bank has error-spotting questions', fixed.length === 16, `got ${fixed.length}`)
  check(
    'every one still ends with "No mistake"',
    fixed.every((q) => q.options[q.options.length - 1] === 'No mistake'),
  )
  check(
    'and no other option is "No mistake"',
    fixed.every((q) => q.options.filter((o) => o === 'No mistake').length === 1),
  )
  check(
    'the served order matches the authored order',
    fixed.every((q) => {
      const authored = raw.find((r: { id: string }) => r.id === q.id)
      return authored && authored.options.every((o: string, i: number) => o === q.options[i])
    }),
  )
  check(
    'roughly one in five answers is "No mistake"',
    (() => {
      const share = fixed.filter((q) => q.options[q.answer] === 'No mistake').length / fixed.length
      return share >= 0.1 && share <= 0.3
    })(),
  )
  // Everything else must still be shuffled, or the always-pick-A problem is back.
  const shuffledSomewhere = QUESTIONS.filter((q) => !q.fixedOptions).some((q) => {
    const authored = raw.find((r: { id: string }) => r.id === q.id)
    return authored && authored.options.some((o: string, i: number) => o !== q.options[i])
  })
  check('ordinary questions are still shuffled', shuffledSomewhere)
}

console.log('\n== analytics ==')
{
  check('a perfect session lands in the top band', scoreBand(10, 10) === '80-100')
  check('a bad session lands in the bottom band', scoreBand(3, 10) === '0-39')
  check('band boundaries are inclusive from below', scoreBand(4, 10) === '40-59')
  check('an empty session has no band', scoreBand(0, 0) === 'none')
  // Both come from a division elsewhere, so neither is trusted to be sane.
  check('a negative score cannot escape the bands', scoreBand(-1, 10) === '0-39')
  check('an impossible score cannot escape the bands', scoreBand(20, 10) === '80-100')
  // No DOM here, so both calls hit their guards. Neither may throw:
  // `initAnalytics` runs at import time in main.tsx, and a counter that can
  // raise would take a practice session down with it.
  let threw = false
  try {
    initAnalytics()
    track('smoke-test')
  } catch {
    threw = true
  }
  check('analytics is inert outside a browser', !threw)
}

console.log('\n== migrating an older profile ==')
{
  // The highest-stakes untested path in the app: every child on an older schema
  // runs `migrate` on their next visit, and a mistake here silently throws away
  // months of practice. localStorage is stood up the same way as the batching
  // section above, but only `stored` is ever read.
  let stored: string | null = null
  ;(globalThis as any).window = {
    localStorage: {
      getItem: () => stored,
      setItem: () => {},
      removeItem: () => {
        stored = null
      },
    },
  }

  // A profile written by the first release: no streaks, no feedback, and none
  // of the preferences added since.
  stored = JSON.stringify({
    version: 1,
    questions: {
      'q-right': { attempts: 3, correct: 2, lastSeen: 111, lastCorrect: true },
      'q-wrong': { attempts: 1, correct: 0, lastSeen: 222, lastCorrect: false },
    },
    recentQuestionIds: ['q-right'],
    sessions: [{ finishedAt: 1, mode: 'quick10', subjects: [], total: 10, correct: 7 }],
    streak: { lastDate: '2024-01-01', current: 3, best: 5 },
    totals: { answered: 4, correct: 2 },
    preferences: { timed: true },
  })
  const v1 = loadProgress()

  check('the schema version is stamped forward', v1.version === SCHEMA_VERSION)
  check('lifetime totals survive', v1.totals.answered === 4 && v1.totals.correct === 2)
  check('the best streak survives', v1.streak.best === 5 && v1.streak.current === 3)
  check('per-question history survives', v1.questions['q-right']?.attempts === 3)
  check('finished sessions survive', v1.sessions.length === 1)
  check('the recently-served list survives', v1.recentQuestionIds[0] === 'q-right')
  check('an existing preference survives', v1.preferences.timed === true)
  // Pre-schema-2 records have no streak. A question last answered correctly
  // starts one rung up the review ladder rather than coming straight back.
  check('a correct answer earns a streak of 1', v1.questions['q-right']?.streak === 1)
  check('a wrong answer starts at 0', v1.questions['q-wrong']?.streak === 0)
  check('fields added since default rather than vanish', Array.isArray(v1.feedback))
  check(
    'the pace defaults',
    v1.preferences.secondsPerQuestion === DEFAULT_SECONDS_PER_QUESTION,
  )
  check('practice topics default', Object.keys(v1.preferences.practiceTopics).length === 0)

  // Schema 4 called this `mixedSubjects`. Losing it would silently reset a
  // child's chosen subjects on upgrade.
  stored = JSON.stringify({ version: 4, preferences: { mixedSubjects: ['maths', 'english'] } })
  check(
    'a schema-4 subject choice is carried forward',
    loadProgress().preferences.practiceSubjects.join() === 'maths,english',
  )

  // Hand-edited or half-written values must be repaired, not trusted — a pace
  // of 0 would produce a session with no time at all.
  for (const bad of [0, -5, 'fast', null]) {
    stored = JSON.stringify({ preferences: { secondsPerQuestion: bad } })
    check(
      `a pace of ${JSON.stringify(bad)} is repaired`,
      loadProgress().preferences.secondsPerQuestion === DEFAULT_SECONDS_PER_QUESTION,
    )
  }
  stored = JSON.stringify({ preferences: { practiceTopics: 'nonsense' } })
  check(
    'a damaged topic selection is repaired',
    Object.keys(loadProgress().preferences.practiceTopics).length === 0,
  )

  // Damaged storage must give a usable empty profile, never an exception — the
  // app cannot start at all if loading throws.
  for (const junk of ['{not json', 'null', '[]', '7', '"a string"']) {
    stored = junk
    let answered = -1
    try {
      answered = loadProgress().totals.answered
    } catch {
      answered = -1
    }
    check(`stored junk ${junk} yields a fresh profile`, answered === 0)
  }

  // Private browsing and full-quota devices throw on read.
  ;(globalThis as any).window.localStorage.getItem = () => {
    throw new Error('SecurityError')
  }
  let threw = false
  let recovered = false
  try {
    recovered = loadProgress().totals.answered === 0
  } catch {
    threw = true
  }
  check('unreadable storage falls back instead of throwing', !threw && recovered)

  delete (globalThis as any).window
}

console.log('\n== feedback ==')
{
  const sample = QUESTIONS[0]
  let p: Progress = emptyProgress()

  p = addFeedback(p, { kind: 'general', message: 'too many fractions' }, 1000)
  p = addFeedback(p, { kind: 'question', questionId: sample.id, reason: 'typo', message: 'spelling' }, 1000)

  check('feedback is kept newest first', p.feedback[0]?.message === 'spelling')
  check('both items are kept', p.feedback.length === 2)
  // Same timestamp, so only the counter separates them. Colliding ids would
  // make "delete this one" delete both.
  check('ids are unique even within the same millisecond', p.feedback[0].id !== p.feedback[1].id)

  const keep = p.feedback[0].id
  const gone = p.feedback[1].id
  const after = removeFeedback(p, gone)
  check('removing takes exactly one item', after.feedback.length === 1)
  check('and it is the right one', after.feedback[0].id === keep)
  check('removing an unknown id is harmless', removeFeedback(p, 'fb-nope').feedback.length === 2)
  check('clearing empties the list', clearFeedback(p).feedback.length === 0)
  check('the original is never mutated', p.feedback.length === 2)

  // A legacy profile predates the feedback field entirely.
  const legacy = { ...emptyProgress(), feedback: undefined as unknown as Progress['feedback'] }
  check(
    'feedback can be added to a profile that has none',
    addFeedback(legacy, { kind: 'general', message: 'first' }).feedback.length === 1,
  )

  // 200 is the cap. Without it a profile grows without bound in localStorage.
  let many: Progress = emptyProgress()
  for (let i = 0; i < 205; i += 1) {
    many = addFeedback(many, { kind: 'general', message: `note ${i}` }, 2000 + i)
  }
  check('the feedback list is capped at 200', many.feedback.length === 200)
  check('and it is the oldest that fall off', many.feedback[0].message === 'note 204')

  const md = feedbackToMarkdown(p)
  check('the export names the reported question', md.includes(sample.id))
  check('and quotes its text, so the bank can be fixed', md.includes(sample.question))
  check('and gives the marked answer', md.includes(sample.options[sample.answer]))
  check('and labels the reason in words', md.includes(reasonLabel('typo')))
  check('general notes are exported too', md.includes('too many fractions'))
  check('an empty export still says so', feedbackToMarkdown(emptyProgress()).includes('No feedback'))

  // Reports outlive the bank: a question can be deleted after being flagged.
  const orphan = addFeedback(emptyProgress(), {
    kind: 'question',
    questionId: 'deleted-question',
    reason: 'answer-wrong',
    message: '',
  })
  check(
    'a report on a deleted question still exports',
    feedbackToMarkdown(orphan).includes('no longer in the bank'),
  )
  check('an unknown reason still gets a label', reasonLabel(undefined) === 'Note')
}

console.log('\n== option shuffling keeps the right answer right ==')
{
  // Questions are authored with the correct answer first and permuted at load
  // time. If that permutation and the answer index ever drift apart, a child is
  // marked wrong for choosing correctly — the worst bug this app could have, and
  // an invisible one. So it is checked against every question in the bank.
  // The authored files, before the load-time shuffle: the four hand-written
  // subject banks plus the template output that `npm run generate` emits.
  type Authored = { id: string; options: string[]; answer: number }
  const authoredById = new Map<string, Authored>()
  for (const file of [
    'english',
    'maths',
    'verbal-reasoning',
    'non-verbal-reasoning',
    'generated',
  ]) {
    const bank = JSON.parse(readFileSync(`src/data/${file}.json`, 'utf8')) as Authored[]
    for (const q of bank) authoredById.set(q.id, q)
  }

  // A bank-wide failure can name hundreds of questions; a handful plus a count
  // is enough to start debugging and short enough to read.
  const someIds = (qs: readonly { id: string }[]) =>
    qs.slice(0, 5).map((q) => q.id).join(', ') +
    (qs.length > 5 ? ' (+' + (qs.length - 5) + ' more)' : '')

  const unmatched = QUESTIONS.filter((q) => !authoredById.has(q.id))
  check(
    'every served question comes from an authored file',
    unmatched.length === 0,
    someIds(unmatched),
  )

  const wrongAnswer = QUESTIONS.filter((q) => {
    const a = authoredById.get(q.id)
    return a && q.options[q.answer] !== a.options[a.answer]
  })
  check(
    'every served question still marks the authored answer',
    wrongAnswer.length === 0,
    someIds(wrongAnswer),
  )

  const notPermutation = QUESTIONS.filter((q) => {
    const a = authoredById.get(q.id)
    return a && [...q.options].sort().join(' ') !== [...a.options].sort().join(' ')
  })
  check(
    'and offers exactly the authored options, no more and no fewer',
    notPermutation.length === 0,
    someIds(notPermutation),
  )

  // The whole point of shuffling: the answer must not sit at A every time.
  const atA = QUESTIONS.filter((q) => !q.fixedOptions && q.answer === 0).length
  const shufflable = QUESTIONS.filter((q) => !q.fixedOptions).length
  check(
    'the answer is not parked at A',
    atA < shufflable * 0.4,
    `${atA} of ${shufflable}`,
  )

  // Stable across reloads and devices, because the seed is the question id.
  // If this drifts, a child sees the options move around between sessions.
  const sample = { id: 'shuffle-demo', options: ['right', 'b', 'c', 'd', 'e'], answer: 0 }
  const once = shuffleOptions(sample)
  const twice = shuffleOptions(sample)
  check('shuffling is deterministic', once.options.join() === twice.options.join())
  check('and the seed is the id, so a different id permutes differently', (() => {
    const other = shuffleOptions({ ...sample, id: 'shuffle-demo-2' })
    return other.options.join() !== once.options.join()
  })())
  check('the marked answer follows its text', once.options[once.answer] === 'right')

  // Parallel arrays must move with the options or an explanation ends up
  // attached to the wrong distractor.
  const withNotes = shuffleOptions({
    id: 'notes-demo',
    options: ['a', 'b', 'c', 'd', 'e'],
    answer: 0,
    distractorNotes: ['note-a', 'note-b', 'note-c', 'note-d', 'note-e'],
    optionFigures: ['fig-a', 'fig-b', 'fig-c', 'fig-d', 'fig-e'],
  })
  check(
    'distractor notes stay with their option',
    withNotes.options.every((o, i) => withNotes.distractorNotes![i] === `note-${o}`),
  )
  check(
    'option figures stay with their option',
    withNotes.options.every((o, i) => withNotes.optionFigures![i] === `fig-${o}`),
  )

  // Error-spotting items carry the sentence in their order — see the section above.
  const fixed = shuffleOptions({ ...sample, fixedOptions: true })
  check('a fixed-order question is left alone', fixed.options.join() === sample.options.join())
  check('and keeps its answer index', fixed.answer === sample.answer)

  check('hashing is stable', hashString('abc') === hashString('abc'))
  check('and separates different ids', hashString('abc') !== hashString('abd'))
  const rand = seededRandom(hashString('seed'))
  const draws = [rand(), rand(), rand(), rand(), rand()]
  check('random draws stay in [0, 1)', draws.every((n) => n >= 0 && n < 1))
  check('and do not repeat a single value', new Set(draws).size === 5)
  check(
    'the same seed replays the same draws',
    seededRandom(hashString('seed'))() === draws[0],
  )
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

