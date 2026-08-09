interface Props {
  label: string
  /** 0–100, or null when there is nothing to show yet. */
  value: number | null
  /** Text shown at the right-hand end; defaults to the percentage. */
  valueText?: string
  colour?: string
}

export function ProgressBar({ label, value, valueText, colour }: Props) {
  const shown = value ?? 0
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-value">
        {valueText ?? (value === null ? 'Not started' : `${value}%`)}
      </span>
      <div
        className="bar-track"
        role="img"
        aria-label={`${label}: ${value === null ? 'not started' : `${value} per cent`}`}
      >
        <div
          className="bar-fill"
          style={{ width: `${shown}%`, background: colour ?? undefined }}
        />
      </div>
    </div>
  )
}
