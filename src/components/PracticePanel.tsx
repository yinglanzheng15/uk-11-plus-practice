import { useState } from 'react'
import { SUBJECTS, getSubject } from '../data/subjects'
import { QUESTIONS, topicKey, topicsForSubject } from '../data'
import type { SubjectId } from '../types'

interface Props {
  /** Chosen subjects. Empty means "all subjects". */
  subjects: SubjectId[]
  /** Chosen topics per subject. A missing or empty entry means "all topics". */
  topics: Record<SubjectId, string[]>
  onSetSubjects: (subjects: SubjectId[]) => void
  onSetTopics: (topics: Record<SubjectId, string[]>) => void
}

/** The longest session the home screen offers, used to warn about a thin pool. */
const LONGEST_SESSION = 20

/** Chosen subjects, resolving the "empty means all" convention. */
export function selectedSubjects(subjects: SubjectId[]): SubjectId[] {
  return subjects.length === 0 ? SUBJECTS.map((s) => s.id) : subjects
}

/** Chosen topics for one subject, resolving the "empty means all" convention. */
export function selectedTopics(
  subject: SubjectId,
  topics: Record<SubjectId, string[]>,
): string[] {
  const chosen = topics[subject]
  return chosen && chosen.length > 0 ? chosen : topicsForSubject(subject)
}

/**
 * The `subject::topic` keys a session should be restricted to, or undefined
 * when the selection covers every topic of every chosen subject — in which
 * case there is nothing to filter and the session behaves as it always did.
 */
export function practiceTopicKeys(
  subjects: SubjectId[],
  topics: Record<SubjectId, string[]>,
): string[] | undefined {
  const chosenSubjects = selectedSubjects(subjects)
  const narrowed = chosenSubjects.some(
    (id) => selectedTopics(id, topics).length < topicsForSubject(id).length,
  )
  if (!narrowed) return undefined
  return chosenSubjects.flatMap((id) =>
    selectedTopics(id, topics).map((topic) => topicKey(id, topic)),
  )
}

/** How many questions the current selection leaves to draw from. */
export function availableCount(
  subjects: SubjectId[],
  topics: Record<SubjectId, string[]>,
): number {
  const chosenSubjects = new Set(selectedSubjects(subjects))
  const keys = practiceTopicKeys(subjects, topics)
  const allowed = keys ? new Set(keys) : null
  return QUESTIONS.filter(
    (q) =>
      chosenSubjects.has(q.subject) &&
      (allowed === null || allowed.has(topicKey(q.subject, q.topic))),
  ).length
}

/**
 * Narrows what quick and mixed sessions draw from, by subject and by topic.
 *
 * Collapsed by default: the tiles above it work perfectly well untouched, and
 * a child who just wants to practise should not have to walk past a wall of
 * options to get there.
 */
export function PracticePanel({ subjects, topics, onSetSubjects, onSetTopics }: Props) {
  const [open, setOpen] = useState(false)
  const chosenSubjects = selectedSubjects(subjects)
  const available = availableCount(subjects, topics)

  const summary = (() => {
    const subjectPart =
      subjects.length === 0
        ? 'All subjects'
        : chosenSubjects.map((id) => getSubject(id).shortLabel).join(', ')
    const narrowed = chosenSubjects.filter(
      (id) => selectedTopics(id, topics).length < topicsForSubject(id).length,
    )
    if (narrowed.length === 0) return `${subjectPart} · all topics`
    const count = chosenSubjects.reduce(
      (n, id) => n + selectedTopics(id, topics).length,
      0,
    )
    return `${subjectPart} · ${count} topic${count === 1 ? '' : 's'}`
  })()

  function toggleSubject(id: SubjectId) {
    const isSelected = chosenSubjects.includes(id)
    // Never allow deselecting down to zero — that would leave nothing to practise.
    if (isSelected && chosenSubjects.length === 1) return
    const next = isSelected
      ? chosenSubjects.filter((s) => s !== id)
      : [...chosenSubjects, id]
    onSetSubjects(next.length === SUBJECTS.length ? [] : next)
  }

  function toggleTopic(subject: SubjectId, topic: string) {
    const current = selectedTopics(subject, topics)
    const isSelected = current.includes(topic)
    // As with subjects, a chosen subject can never end up with no topics.
    if (isSelected && current.length === 1) return
    const next = isSelected
      ? current.filter((t) => t !== topic)
      : [...current, topic]
    const all = topicsForSubject(subject)
    const rest = { ...topics }
    // Storing [] for "all of them" keeps the saved profile stable when a new
    // topic is added to the bank later.
    if (next.length === all.length) delete rest[subject]
    else rest[subject] = next
    onSetTopics(rest)
  }

  return (
    <div className="card">
      <button
        type="button"
        className="panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="panel-toggle-title">Choose what to practise</span>
          <span className="muted small panel-toggle-sub">{summary}</span>
        </span>
        <span className="panel-toggle-mark" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="panel-body">
          <p className="muted small" style={{ marginTop: 0, marginBottom: 8 }}>
            This applies to Quick 5, 10 and 20 and to Mixed practice. Reviewing
            mistakes and weak areas always uses everything you have answered.
          </p>

          <div className="chip-row" role="group" aria-label="Subjects to practise">
            {SUBJECTS.map((s) => {
              const selected = chosenSubjects.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  className={selected ? 'chip-toggle chip-toggle-active' : 'chip-toggle'}
                  style={{ ['--tile-colour' as string]: s.colour }}
                  aria-pressed={selected}
                  onClick={() => toggleSubject(s.id)}
                >
                  {s.shortLabel}
                </button>
              )
            })}
          </div>

          {chosenSubjects.map((id) => {
            const subject = getSubject(id)
            const all = topicsForSubject(id)
            const chosen = selectedTopics(id, topics)
            return (
              <div key={id} className="topic-group">
                <p className="topic-group-label">
                  <span
                    className="tile-dot"
                    aria-hidden="true"
                    style={{ ['--tile-colour' as string]: subject.colour }}
                  />
                  {subject.label}
                </p>
                <div
                  className="chip-row"
                  role="group"
                  aria-label={`${subject.label} topics`}
                >
                  {all.map((topic) => {
                    const selected = chosen.includes(topic)
                    return (
                      <button
                        key={topic}
                        type="button"
                        className={
                          selected
                            ? 'chip-toggle chip-toggle-small chip-toggle-active'
                            : 'chip-toggle chip-toggle-small'
                        }
                        style={{ ['--tile-colour' as string]: subject.colour }}
                        aria-pressed={selected}
                        onClick={() => toggleTopic(id, topic)}
                      >
                        {topic}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>
            {available} question{available === 1 ? '' : 's'} to draw from.
            {available < LONGEST_SESSION &&
              ' A longer session will be shorter than usual — add a subject or a topic for a full one.'}
          </p>
        </div>
      )}
    </div>
  )
}
