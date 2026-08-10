import { useEffect, useState } from 'react'

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

interface Props {
  /** Epoch ms at which the time runs out. */
  deadlineAt: number
  /** When the clock is stopped, the moment it stopped — otherwise null. */
  pausedAt: number | null
  onExpire: () => void
}

export function Timer({ deadlineAt, pausedAt, onExpire }: Props) {
  const paused = pausedAt !== null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [paused])

  // While paused the display holds at whatever was left when it stopped.
  const remaining = deadlineAt - (pausedAt ?? now)

  useEffect(() => {
    if (!paused && remaining <= 0) onExpire()
  }, [remaining, paused, onExpire])

  const low = remaining <= 60_000
  return (
    <span className={low ? 'timer-low' : undefined}>
      {/* Announced politely so it never interrupts the question itself. */}
      <span aria-hidden="true">Time left: {formatDuration(remaining)}</span>
      <span className="sr-only" aria-live="polite">
        {low ? `Under a minute remaining` : ''}
      </span>
    </span>
  )
}
