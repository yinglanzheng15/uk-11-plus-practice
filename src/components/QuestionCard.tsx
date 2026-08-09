import { useEffect, useRef } from 'react'
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
  const groupRef = useRef<HTMLDivElement>(null)

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

      <div
        className="options"
        role="group"
        aria-label="Answer options"
        ref={groupRef}
      >
        {question.options.map((option, i) => (
          <button
            key={i}
            type="button"
            className={optionClass(i)}
            disabled={revealed}
            aria-pressed={selected === i}
            onClick={() => onSelect(i)}
          >
            <span className="option-letter" aria-hidden="true">
              {LETTERS[i]}
            </span>
            <span>{option}</span>
            {/* Correctness is never signalled by colour alone. */}
            {revealed && i === question.answer && (
              <span className="option-mark">✓ Correct answer</span>
            )}
            {revealed && i === selected && i !== question.answer && (
              <span className="option-mark">✗ Your answer</span>
            )}
          </button>
        ))}
      </div>
    </>
  )
}
