export const APP_VERSION = '1.5'

export interface ChangelogEntry {
  version: string
  date: string
  highlights: string[]
}

/** Newest first. Add an entry here (and bump APP_VERSION + package.json) on each release. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.5',
    date: '2026-08-11',
    highlights: [
      'Question bank expanded to 434 questions',
      'New maths practice: fractions of an amount, order of operations, unit conversion, averages, temperatures below zero and multi-step money',
      'New verbal reasoning practice: letter codes, letter sequences and number series',
      'Questions of the same style now come with fresh numbers each time',
    ],
  },
  {
    version: '1.4',
    date: '2026-08-10',
    highlights: [
      'Visual design refresh across the home and progress screens',
      'Non-Verbal Reasoning taster (odd-one-out, sequences, figure pairs)',
      'Whole question bank moved to five options (A–E)',
      'A grown-up can set the pace of timed sessions',
      '"Skip for now" — a skipped question returns at the end of the run',
      'Practice questions are optional, with a fuller end-of-quiz review',
    ],
  },
  {
    version: '1.3',
    date: '2026-08-10',
    highlights: [
      'Resume an unfinished session after a refresh',
      'Spaced repetition brings questions back on a 1/3/7/21-day ladder',
      'Download and restore progress as a JSON file',
      'Feedback tab for reporting problems with a question',
      'Question bank expanded to 288 questions',
    ],
  },
  {
    version: '1.2',
    date: '2026-08-10',
    highlights: [
      'Two-layer question vetting: automated validation plus a human review sheet',
      'Question bank expanded to 156 questions',
    ],
  },
  {
    version: '1.1',
    date: '2026-08-09',
    highlights: ['Roadmap of planned improvements added'],
  },
  {
    version: '1.0',
    date: '2026-08-09',
    highlights: [
      'Initial release: quiz engine, mastery tracking, streaks',
      'Quick 5/10/20, subject/topic practice, mixed, mistakes, weak areas and challenge modes',
    ],
  },
]
