import { PACE_PRESETS, timeLimitFor } from '../logic/pace'
import { formatDuration } from './Timer'

interface Props {
  secondsPerQuestion: number
  onChange: (seconds: number) => void
}

/** Session lengths the home screen offers, so the effect can be shown concretely. */
const EXAMPLE_LENGTHS = [10, 20]

/**
 * Sets the pace of a timed session.
 *
 * In the parent view rather than the home screen because it is a judgement
 * about how much pressure is useful right now — and because a child tempted to
 * set it to 90 seconds before every session is not practising for anything.
 */
export function PacePanel({ secondsPerQuestion, onChange }: Props) {
  const current =
    PACE_PRESETS.find((p) => p.seconds === secondsPerQuestion) ?? PACE_PRESETS[2]

  return (
    <div className="card">
      <h2 className="section-title">Timing</h2>
      <p className="muted small">
        How long a timed session allows per question. This only applies when the timer
        is switched on — untimed practice is unaffected.
      </p>

      <div role="radiogroup" aria-label="Seconds per question">
        {PACE_PRESETS.map((preset) => {
          const selected = preset.seconds === secondsPerQuestion
          return (
            <label
              key={preset.seconds}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 0',
                fontWeight: selected ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="pace"
                checked={selected}
                onChange={() => onChange(preset.seconds)}
                style={{ width: 20, height: 20, marginTop: 2, flex: '0 0 auto' }}
              />
              <span>
                {preset.label} — {preset.seconds} seconds a question
                <span className="muted small" style={{ display: 'block' }}>
                  {preset.detail}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
        At {current.seconds} seconds a question, that is{' '}
        {EXAMPLE_LENGTHS.map(
          (n, i) =>
            `${formatDuration(timeLimitFor(n, current.seconds))} for ${n} questions${
              i < EXAMPLE_LENGTHS.length - 1 ? ', ' : ''
            }`,
        )}
        .
      </p>

      <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
        Timings differ between schools and change from year to year. Check the school's
        own admissions material for the year being sat — these presets are a practice
        aid, not a specification.
      </p>
    </div>
  )
}
