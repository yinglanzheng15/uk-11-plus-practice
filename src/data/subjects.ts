import type { SubjectId } from '../types'

export interface SubjectMeta {
  id: SubjectId
  label: string
  shortLabel: string
  /** CSS custom-property colour token used for accents and progress bars. */
  colour: string
  description: string
}

/**
 * The subject registry. To add a new section (e.g. Non-Verbal Reasoning):
 *   1. add a JSON bank at src/data/<id>.json
 *   2. import it in src/data/index.ts
 *   3. add an entry here
 * Nothing else in the app hard-codes the three current subjects.
 */
export const SUBJECTS: SubjectMeta[] = [
  {
    id: 'maths',
    label: 'Maths',
    shortLabel: 'Maths',
    colour: '#1f6feb',
    description: 'Number, fractions, percentages, geometry, data and word problems.',
  },
  {
    id: 'english',
    label: 'English',
    shortLabel: 'English',
    colour: '#9333ea',
    description: 'Comprehension, grammar, punctuation, spelling and vocabulary.',
  },
  {
    id: 'verbal-reasoning',
    label: 'Verbal Reasoning',
    shortLabel: 'VR',
    colour: '#0f9d58',
    description: 'Word relationships, codes, sequences, analogies and logic.',
  },
]

const bySubjectId = new Map(SUBJECTS.map((s) => [s.id, s]))

export function getSubject(id: SubjectId): SubjectMeta {
  return (
    bySubjectId.get(id) ?? {
      id,
      label: id,
      shortLabel: id,
      colour: '#6b7280',
      description: '',
    }
  )
}
