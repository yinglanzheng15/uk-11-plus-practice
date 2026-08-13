/**
 * Anonymous usage counts, via GoatCounter.
 *
 * The app is a single page, so pageviews alone say almost nothing — the URL
 * never changes when a child picks Maths or finishes a paper. Everything
 * interesting therefore goes through `track()` as a custom event.
 *
 * Nothing here identifies anyone. Events carry a mode, a subject list and a
 * score *band* — never a score, a question, an answer or a timestamp beyond
 * what the server sees anyway. The users are children; keep it that way.
 *
 * Unset `SITE` (the default) disables the whole thing: no script is loaded and
 * every `track()` call is a no-op, so local development and forks stay silent.
 */

/**
 * Your GoatCounter site code — the `xxx` in `https://xxx.goatcounter.com`.
 * Register a free site at https://www.goatcounter.com and paste the code here.
 */
const SITE = 'elevenplus'

const ENDPOINT = 'https://gc.zgo.at/count.js'

interface GoatCounter {
  count(vars: { path: string; title?: string; event?: boolean }): void
}

declare global {
  interface Window {
    goatcounter?: GoatCounter & { no_onload?: boolean }
  }
}

/**
 * Load the counter and record the one pageview. Safe to call more than once;
 * a second call does nothing.
 */
export function initAnalytics(): void {
  if (!SITE || typeof document === 'undefined') return
  if (document.getElementById('goatcounter')) return

  const script = document.createElement('script')
  script.id = 'goatcounter'
  script.async = true
  script.src = ENDPOINT
  script.dataset.goatcounter = `https://${SITE}.goatcounter.com/count`
  document.head.appendChild(script)
}

/**
 * Record one event. Silent when analytics is off, still loading, or blocked —
 * a counter must never be able to break a practice session, so the call is
 * wrapped rather than trusted.
 */
export function track(name: string): void {
  try {
    window.goatcounter?.count({ path: name, event: true })
  } catch {
    /* analytics is never worth an exception */
  }
}

/**
 * Coarse enough that no single session is identifiable, fine enough to answer
 * "are the questions the right difficulty". Anything below 0 or above 100 is
 * clamped rather than trusted, since it comes from a division.
 */
export function scoreBand(correct: number, total: number): string {
  if (total <= 0) return 'none'
  const pct = Math.min(100, Math.max(0, (correct / total) * 100))
  if (pct < 40) return '0-39'
  if (pct < 60) return '40-59'
  if (pct < 80) return '60-79'
  return '80-100'
}
