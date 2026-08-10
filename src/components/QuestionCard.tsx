import { useEffect } from 'react'
import { getPassage } from '../data'
import type { Question } from '../types'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

interface Props {
  question: Question
  /** null while the child is still choosing. */
  selected: number | null
  revealed: boolean
  onSelect: (index: number) => void
}

export function QuestionCard({ question, selected, revealed, onSelect }: Props) {
  const passage = getPassage(question.passageId)

  // Number keys 1–4 pick an answer; a small speed-up that also helps
  // keyboard-only users avoid tabbing through every option.
  useEffect(() => {
    if (revealed) return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= question.options.length) {
        onSelect(n - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [question, revealed, onSelect])

  function optionClass(i: number): string {
    if (!revealed) return 'option'
    if (i === question.answer) return 'option option-correct'
    if (i === selected) return 'option option-wrong'
    return 'option'
  }

  return (
    <>
      {passage && (
        <div className="passage" tabIndex={0} aria-label={`Passage: ${passage.title}`}>
          <h3>{passage.title}</h3>
          {passage.text.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      <p className="question-text">{question.question}</p>

      {question.figure && (
        <div
          className="figure figure-stem"
          role="img"
          aria-label="Question figure"
          dangerouslySetInnerHTML={{ __html: question.figure }}
        />
      )}

      <div
        className="options"
        role="group"
        aria-label="Answer options"
      >
        {question.options.map((option, i) => {
          const figure = question.optionFigures?.[i]
          return (
          <button
            key={i}
            type="button"
            className={figure ? `${optionClass(i)} option-visual` : optionClass(i)}
            disabled={revealed}
            aria-pressed={selected === i}
            onClick={() => onSelect(i)}
          >
            <span className="option-letter" aria-hidden="true">
              {LETTERS[i]}
            </span>
            {figure ? (
              <>
                {/* The shape is the answer; its text description is the
                    accessible name and the review-sheet fallback. */}
                <span
                  className="figure option-figure"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: figure }}
                />
                <span className="sr-only">{option}</span>
              </>
            ) : (
              <span>{option}</span>
            )}
            {/* Correctness is never signalled by colour alone. */}
            {revealed && i === question.answer && (
              <span className="option-mark">✓ Correct answer</span>
            )}
            {revealed && i === selected && i !== question.answer && (
              <span className="option-mark">✗ Your answer</span>
            )}
          </button>
          )
        })}
      </div>
    </>
  )
}
