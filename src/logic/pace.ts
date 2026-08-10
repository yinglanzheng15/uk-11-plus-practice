/**
 * How long a timed session allows per question.
 *
 * Real papers differ enough that one fixed figure suits nobody, so the parent
 * view sets this. The presets below are anchored on a published paper wherever
 * one could be verified, and described plainly where they could not.
 *
 * Always check the school's own admissions material for the year being sat —
 * formats and timings change, and these are a practice aid, not a spec.
 */
export interface PacePreset {
  seconds: number
  label: string
  detail: string
}

export const PACE_PRESETS: PacePreset[] = [
  {
    seconds: 90,
    label: 'Gentle',
    detail: 'Plenty of thinking time — for a child new to timed work.',
  },
  {
    seconds: 60,
    label: 'Steady',
    detail: 'A minute a question. A comfortable first step into working against a clock.',
  },
  {
    seconds: 45,
    label: 'Standard',
    detail: 'The default. Brisk but not pressured.',
  },
  {
    seconds: 37,
    label: 'Exam pace',
    detail:
      "About the pace of Dame Alice Owen's verbal reasoning paper — 80 questions in 50 minutes.",
  },
  {
    seconds: 30,
    label: 'Fast',
    detail: 'Tighter than most papers. Useful for building speed, not for a first attempt.',
  },
]

/** Total time allowed for a session of `length` questions, in ms. */
export function timeLimitFor(length: number, secondsPerQuestion: number): number {
  return length * secondsPerQuestion * 1000
}

export function paceLabel(seconds: number): string {
  return PACE_PRESETS.find((p) => p.seconds === seconds)?.label ?? 'Custom'
}
