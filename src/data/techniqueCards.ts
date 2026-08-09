export interface TechniqueCard {
  id: string
  title: string
  body: string
}

/**
 * Shown occasionally between questions. Deliberately short and infrequent —
 * this is a practice tool first, a teaching tool second.
 */
export const TECHNIQUE_CARDS: TechniqueCard[] = [
  {
    id: 'tech-read-whole',
    title: 'Read the whole question',
    body: 'The last line usually tells you what is actually being asked. Read it twice before you look at the options.',
  },
  {
    id: 'tech-eliminate',
    title: 'Cross out what cannot be right',
    body: 'If you are unsure, remove the answers you know are wrong first. Two options left is a much better position than four.',
  },
  {
    id: 'tech-estimate',
    title: 'Estimate before you calculate',
    body: 'A rough answer tells you roughly where the real one should be, so you will spot a silly slip straight away.',
  },
  {
    id: 'tech-units',
    title: 'Check the units',
    body: 'Metres or centimetres? Pounds or pence? Many marks are lost by getting the maths right and the units wrong.',
  },
  {
    id: 'tech-context',
    title: 'Use the sentence around the word',
    body: 'If a word is unfamiliar, read the whole sentence. The words nearby usually hint at whether it is positive or negative.',
  },
  {
    id: 'tech-move-on',
    title: 'Do not get stuck',
    body: 'If a question is taking too long, make your best choice and move on. An easy question later is worth just as much.',
  },
  {
    id: 'tech-answers-question',
    title: 'Does it answer the question?',
    body: 'Before choosing, check that your answer is the thing that was asked for — not a number you worked out along the way.',
  },
]
