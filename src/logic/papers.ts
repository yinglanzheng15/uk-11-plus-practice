/**
 * Full-paper mode: a whole subject paper in one sitting, with the section
 * structure and the timing of the real booklet.
 *
 * Every other mode answers "what should I practise?". This one answers the
 * question a parent actually has — *can my child hold it together for fifty
 * minutes?* — which is a different skill from getting questions right, and the
 * one a shorter session cannot rehearse.
 *
 * Lengths and timings come from the GL familiarisation papers described in
 * docs/latymer-alignment.md: Maths ~50 min / 50 Q, English ~50 min / ~54 Q,
 * Verbal Reasoning ~50 min / 80 Q. Sections are the app's own topic groupings
 * — GL's booklets are built from exercises rather than named sections, and the
 * point here is a breakdown a parent can act on, not a facsimile.
 *
 * Non-Verbal Reasoning has no paper: 12 questions is a taster, not a section.
 * PAPERS is keyed by subject, so adding one later is a single entry.
 */
import { topicKey } from '../data'
import type { SubjectId } from '../types'

export interface PaperSection {
  /** Shown in the end-of-paper breakdown. */
  name: string
  /** Topic names within the paper's subject. */
  topics: string[]
  /** How many questions this section contributes. */
  count: number
}

export interface Paper {
  subject: SubjectId
  minutes: number
  sections: PaperSection[]
}

export const PAPERS: Paper[] = [
  {
    subject: 'maths',
    minutes: 50,
    sections: [
      {
        name: 'Number',
        topics: [
          'Place value',
          'Factors and multiples',
          'Order of operations',
          'Negative numbers',
        ],
        count: 10,
      },
      {
        name: 'Fractions, decimals and percentages',
        topics: ['Fractions', 'Decimals', 'Percentages'],
        count: 12,
      },
      {
        name: 'Ratio and measures',
        topics: ['Ratio and proportion', 'Measurement'],
        count: 8,
      },
      { name: 'Geometry', topics: ['Geometry'], count: 8 },
      { name: 'Data handling', topics: ['Data handling'], count: 6 },
      { name: 'Word problems', topics: ['Word problems'], count: 6 },
    ],
  },
  {
    subject: 'english',
    minutes: 50,
    sections: [
      { name: 'Comprehension', topics: ['Comprehension'], count: 20 },
      { name: 'Spelling', topics: ['Spelling'], count: 12 },
      { name: 'Punctuation', topics: ['Punctuation'], count: 10 },
      { name: 'Grammar', topics: ['Grammar'], count: 6 },
      { name: 'Vocabulary', topics: ['Vocabulary'], count: 6 },
    ],
  },
  {
    subject: 'verbal-reasoning',
    minutes: 50,
    sections: [
      {
        name: 'Words and meanings',
        topics: ['Synonyms', 'Antonyms', 'Vocabulary'],
        count: 14,
      },
      {
        name: 'Word relationships',
        topics: ['Analogies', 'Word classification', 'Word relationships'],
        count: 14,
      },
      { name: 'Letters and codes', topics: ['Letter sequences', 'Codes'], count: 20 },
      {
        name: 'Numbers',
        topics: ['Number and letter relationships'],
        count: 12,
      },
      {
        name: 'Word puzzles',
        topics: ['Hidden words', 'Word building', 'Word sequences'],
        count: 14,
      },
      { name: 'Logic', topics: ['Logical reasoning'], count: 6 },
    ],
  },
]

export function paperFor(subject: SubjectId): Paper | undefined {
  return PAPERS.find((p) => p.subject === subject)
}

export function paperLength(paper: Paper): number {
  return paper.sections.reduce((n, s) => n + s.count, 0)
}

/** `subject::topic` keys for one section, the filter selectQuestions expects. */
export function sectionTopicKeys(paper: Paper, section: PaperSection): string[] {
  return section.topics.map((t) => topicKey(paper.subject, t))
}

/**
 * Which section a question belongs to, or undefined if it is not in this paper.
 * Sections never share a topic, so the first match is the only one.
 */
export function sectionOf(paper: Paper, topic: string): PaperSection | undefined {
  return paper.sections.find((s) => s.topics.includes(topic))
}
