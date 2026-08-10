/**
 * Deterministic per-question option shuffling.
 *
 * Questions are authored with the correct answer first, which makes them far
 * easier to write and review. If they were served that way the child would soon
 * learn to always pick A, so options are permuted at load time using a hash of
 * the question id as the seed.
 *
 * Because the seed is the id, the order is stable: the same question always
 * looks the same to the child across sessions and devices, and stored progress
 * stays meaningful.
 */

interface Shufflable {
  id: string
  options: string[]
  answer: number
  distractorNotes?: string[]
  /** Parallel to options; realigned alongside them when present (NVR figures). */
  optionFigures?: string[]
}

function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Returns a copy with options, answer index and distractor notes all realigned. */
export function shuffleOptions<T extends Shufflable>(question: T): T {
  const rand = seededRandom(hashString(question.id))
  const order = question.options.map((_, i) => i)

  // Fisher–Yates over the index list, so every parallel array moves together.
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  return {
    ...question,
    options: order.map((i) => question.options[i]),
    answer: order.indexOf(question.answer),
    distractorNotes: question.distractorNotes
      ? order.map((i) => question.distractorNotes![i])
      : undefined,
    optionFigures: question.optionFigures
      ? order.map((i) => question.optionFigures![i])
      : undefined,
  }
}
