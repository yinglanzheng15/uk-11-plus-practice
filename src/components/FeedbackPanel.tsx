import { ReportProblem } from './ReportProblem'
import type { FeedbackReason, Question } from '../types'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

interface Props {
  question: Question
  correct: boolean
  chosen: number | null
  /** Copy varies slightly between the main run and the learning loop. */
  variant: 'main' | 'followup'
  exhausted: boolean
  onContinue: () => void
  continueLabel: string
  /**
   * Decline the practice question and carry on. Offered only after a mistake,
   * where the primary button starts the learning loop instead.
   */
  onMoveOn?: () => void
  moveOnLabel?: string
  onReport: (questionId: string, reason: FeedbackReason, message: string) => void
}

export function FeedbackPanel({
  question,
  correct,
  chosen,
  variant,
  exhausted,
  onContinue,
  continueLabel,
  onMoveOn,
  moveOnLabel,
  onReport,
}: Props) {
  // A practice question is offered, not imposed: the child can read the
  // explanation and move on, and every mistake is waiting in the summary.
  const offerMoveOn = Boolean(onMoveOn) && !correct && !exhausted
  // The chosen answer is called out separately above, so it is left out here
  // rather than repeated verbatim.
  const traps = (question.distractorNotes ?? [])
    .map((note, i) => ({ note, i }))
    .filter(
      ({ note, i }) => note.trim() !== '' && i !== question.answer && i !== chosen,
    )

  return (
    <div
      className={`feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}`}
      role="status"
      aria-live="polite"
    >
      {correct ? (
        <>
          <h3>{variant === 'followup' ? "Good — you've got it." : 'Correct!'}</h3>
          <p>{question.explanation}</p>
        </>
      ) : (
        <>
          <h3>Not quite.</h3>
          <p>
            <strong>
              Correct answer: {LETTERS[question.answer]} — {question.options[question.answer]}
            </strong>
          </p>
          <p>{question.explanation}</p>

          {chosen !== null && question.distractorNotes?.[chosen] && (
            <p>
              <strong>Your answer: </strong>
              {question.distractorNotes[chosen]}
            </p>
          )}

          <div className="remember">
            <strong>Remember</strong>
            {question.learningPoint}
          </div>

          {traps.length > 0 && (
            <dl>
              <dt>Why the other answers are traps</dt>
              {traps.map(({ note, i }) => (
                <dd key={i}>
                  <strong>{LETTERS[i]}:</strong> {note}
                </dd>
              ))}
            </dl>
          )}

          {!exhausted && (
            <p>
              <strong>
                {variant === 'main'
                  ? "Let's check you've got it."
                  : "Let's try one more."}
              </strong>
            </p>
          )}

          {exhausted && (
            <p>
              <strong>
                That's a tricky one — we'll come back to it another day. Well done for
                sticking with it.
              </strong>
            </p>
          )}
        </>
      )}

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onContinue} autoFocus>
          {continueLabel}
        </button>
        {offerMoveOn && (
          <button type="button" className="btn" onClick={onMoveOn}>
            {moveOnLabel ?? 'Next question'}
          </button>
        )}
      </div>

      {offerMoveOn && (
        <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
          Either way, you can look at this one again at the end.
        </p>
      )}

      <ReportProblem
        key={question.id}
        questionId={question.id}
        onSubmit={(reason, message) => onReport(question.id, reason, message)}
      />
    </div>
  )
}
