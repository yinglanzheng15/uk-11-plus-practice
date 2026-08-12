/**
 * Parameterised question templates.
 *
 * A template is one *style* of question plus the numbers it varies over. The
 * generator (`npm run generate`) expands each into `count` concrete questions
 * with deterministic seeds, writing them to `generated.json` — which is then
 * validated, reviewed and served exactly like a hand-written question.
 *
 * The point is that distractors are *computed from the same numbers as the
 * answer*, so every variant keeps the misconception it was built to catch
 * instead of degrading into arbitrary wrong values.
 *
 * Rules: put the correct option first (the app shuffles), keep variants
 * integer-valued, and add `verify` whenever the answer is a plain number.
 * The generator discards any variant with repeated options or repeated
 * question text, so a template may safely produce the occasional collision.
 */
import type { Difficulty } from '../types'

export interface Rand {
  /** Inclusive both ends. */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

export interface Variant {
  question: string
  /** Exactly five, correct first. */
  options: string[]
  distractorNotes?: string[]
  explanation: string
  learningPoint: string
  verify?: string
  /** Overrides the template's difficulty when the numbers make it harder. */
  difficulty?: Difficulty
}

export interface Template {
  /** Id stem; variants become `<id>-v01`, `-v02`, … */
  id: string
  count: number
  subject: string
  topic: string
  skill: string
  type: string
  difficulty: Difficulty
  tags: string[]
  build(r: Rand): Variant
}

const money = (n: number) => `£${n.toLocaleString('en-GB')}`

const SHOP_ITEMS = [
  'bicycle',
  'tent',
  'guitar',
  'winter coat',
  'pair of football boots',
  'telescope',
  'games console',
  'sewing machine',
]

const NAMES = ['Amira', 'Tom', 'Priya', 'Callum', 'Nadia', 'Jonah', 'Esme', 'Rafiq']

/** Pounds from a whole number of pence, so money arithmetic stays exact. */
const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`

/** Trims trailing zeros: 0.024, not 0.0240. */
const decimal = (n: number) => String(Number(n.toFixed(6)))

const letter = (i: number) => String.fromCharCode(65 + i)
const shiftWord = (word: string, by: number) =>
  [...word].map((c) => letter((c.charCodeAt(0) - 65 + by + 26) % 26)).join('')

/**
 * Words whose letters all sit at or before V, so a forward shift of up to four
 * never wraps past Z — the rule stays visible to the child.
 */
const CODE_WORDS = [
  'CAT',
  'DOG',
  'HAND',
  'LAMP',
  'ROSE',
  'MILK',
  'FROG',
  'GATE',
  'BOOK',
  'FISH',
  'NEST',
  'RAIN',
  'COIN',
  'DESK',
  'FARM',
  'MOON',
  'SHIP',
  'CARD',
]

export const TEMPLATES: Template[] = [
  {
    id: 'maths-percentages-sale-price',
    count: 12,
    subject: 'maths',
    topic: 'Percentages',
    skill: 'percentage_decrease',
    type: 'percentages',
    difficulty: 2,
    tags: ['percentages', 'money', 'generated'],
    build(r) {
      const price = 20 * r.int(3, 25)
      const rates = [10, 15, 20, 25, 40]
      const cut = r.pick(rates)
      const otherCut = r.pick(rates.filter((v) => v !== cut))
      const discount = (price * cut) / 100
      return {
        question: `A ${r.pick(SHOP_ITEMS)} costs ${money(price)}. In a sale its price is reduced by ${cut}%. What is the sale price?`,
        options: [
          money(price - discount),
          money(discount),
          money(price + discount),
          money(price - cut),
          money(price - (price * otherCut) / 100),
        ],
        distractorNotes: [
          '',
          `This is the discount itself — the amount taken off, not the price paid.`,
          `This adds the ${cut}% instead of taking it off.`,
          `This treats ${cut}% as ${money(cut)}. A percentage is a fraction of the price, not a fixed number of pounds.`,
          `This takes off ${otherCut}% rather than the ${cut}% given in the question.`,
        ],
        explanation: `${cut}% of ${money(price)} is ${money(price)} ÷ 100 × ${cut} = ${money(discount)}. The sale price is what is left: ${money(price)} − ${money(discount)} = ${money(price - discount)}.`,
        learningPoint:
          'Find the percentage first, then decide whether the question wants that amount or what remains.',
        verify: `${price} - ${price} * ${cut} / 100`,
      }
    },
  },

  {
    id: 'maths-ratio-share',
    count: 12,
    subject: 'maths',
    topic: 'Ratio and proportion',
    skill: 'sharing_in_a_ratio',
    type: 'ratio',
    difficulty: 3,
    tags: ['ratio', 'money', 'generated'],
    build(r) {
      const [first, second] = r.pick([
        [2, 3],
        [3, 4],
        [3, 5],
        [4, 5],
        [2, 5],
        [5, 7],
        [3, 7],
      ] as const)
      const part = 5 * r.int(2, 24)
      const total = part * (first + second)
      const [a, b] = [r.pick(NAMES), r.pick(NAMES)]
      if (a === b) throw new Error('same name')
      return {
        question: `${money(total)} is shared between ${a} and ${b} in the ratio ${first} : ${second}. How much does ${a} receive?`,
        options: [
          money(part * first),
          money(part * second),
          money(part),
          money(total / 2),
          money(part * (second - first)),
        ],
        distractorNotes: [
          '',
          `This is ${b}'s share — the ratio is ${first} : ${second}, so ${a} takes the ${first} parts.`,
          `This is the value of a single part, not of ${a}'s ${first} parts.`,
          'This shares the money equally, ignoring the ratio.',
          `This is the difference between the two shares, not the share itself.`,
        ],
        explanation: `The ratio ${first} : ${second} makes ${first} + ${second} = ${first + second} equal parts. One part is ${money(total)} ÷ ${first + second} = ${money(part)}, so ${a}'s ${first} parts are worth ${first} × ${money(part)} = ${money(part * first)}.`,
        learningPoint:
          'Add the numbers in the ratio to get the number of parts, divide to find one part, then multiply.',
        verify: `${total} / ${first + second} * ${first}`,
      }
    },
  },

  {
    id: 'maths-geometry-perimeter',
    count: 12,
    subject: 'maths',
    topic: 'Geometry',
    skill: 'area_and_perimeter',
    type: 'geometry',
    difficulty: 2,
    tags: ['geometry', 'perimeter', 'generated'],
    build(r) {
      const width = r.int(3, 14)
      const length = width + r.int(2, 11)
      const perimeter = 2 * (length + width)
      return {
        question: `A rectangular ${r.pick(['vegetable patch', 'notice board', 'rug', 'paddock', 'photograph', 'flower bed'])} is ${length} cm long and ${width} cm wide. What is its perimeter?`,
        options: [
          `${perimeter} cm`,
          `${length * width} cm`,
          `${length + width} cm`,
          `${2 * length + width} cm`,
          `${4 * length} cm`,
        ],
        distractorNotes: [
          '',
          'This multiplies the sides, which gives the area rather than the distance round the edge.',
          'This adds one long side and one short side — only half of the way round.',
          'This counts both long sides but only one short side.',
          'This treats the shape as a square with all sides the length of the longer one.',
        ],
        explanation: `A rectangle has two sides of ${length} cm and two of ${width} cm, so the perimeter is 2 × (${length} + ${width}) = ${perimeter} cm.`,
        learningPoint:
          'Perimeter is the distance all the way round: add the two different sides, then double.',
        verify: `2 * (${length} + ${width})`,
      }
    },
  },

  {
    id: 'maths-fractions-of-amount',
    count: 10,
    subject: 'maths',
    topic: 'Fractions',
    skill: 'fraction_of_quantity',
    type: 'fractions',
    difficulty: 2,
    tags: ['fractions', 'generated'],
    build(r) {
      const bottom = r.pick([3, 4, 5, 6, 8])
      const top = r.int(2, bottom - 1)
      // 2/6 is really 1/3 — an unsimplified fraction reads as a mistake.
      const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y))
      if (gcd(top, bottom) !== 1) throw new Error('not in lowest terms')
      // A multiple of both parts keeps every distractor a whole number too.
      const total = bottom * top * r.int(2, 8)
      const part = total / bottom
      return {
        question: `What is ${top}/${bottom} of ${total}?`,
        options: [
          `${part * top}`,
          `${part}`,
          `${part * (bottom - top)}`,
          `${(total / top) * bottom}`,
          `${part * (top + 1)}`,
        ],
        distractorNotes: [
          '',
          `This is 1/${bottom} of ${total} — one part, when the question asks for ${top}.`,
          `This is the ${bottom - top} parts left over, not the ${top} parts asked for.`,
          'This divides by the top number and multiplies by the bottom — the wrong way round.',
          `This counts ${top + 1} parts instead of ${top}.`,
        ],
        explanation: `Divide by the bottom to find one part: ${total} ÷ ${bottom} = ${part}. Then multiply by the top: ${part} × ${top} = ${part * top}.`,
        learningPoint: 'Divide by the bottom, multiply by the top.',
        verify: `${total} / ${bottom} * ${top}`,
        difficulty: top === 1 ? 1 : 2,
      }
    },
  },

  {
    id: 'maths-order-of-operations',
    count: 10,
    subject: 'maths',
    topic: 'Order of operations',
    skill: 'bidmas',
    type: 'number',
    difficulty: 2,
    tags: ['bidmas', 'order of operations', 'generated'],
    build(r) {
      const a = r.int(3, 19)
      const b = r.int(2, 9)
      const c = r.int(3, 9)
      return {
        question: `Work out ${a} + ${b} × ${c}`,
        options: [
          `${a + b * c}`,
          `${(a + b) * c}`,
          `${a + b + c}`,
          `${a * b + c}`,
          `${b * c}`,
        ],
        distractorNotes: [
          '',
          'This works left to right, adding before multiplying.',
          'This adds all three numbers, ignoring the multiplication sign.',
          `This multiplies the wrong pair — the × applies to ${b} and ${c}.`,
          `This does the multiplication but forgets to add the ${a}.`,
        ],
        explanation: `Multiplication comes before addition, so work out ${b} × ${c} = ${b * c} first, then add: ${a} + ${b * c} = ${a + b * c}.`,
        learningPoint:
          'Do multiplication and division before addition and subtraction, whatever order they are written in.',
        verify: `${a} + ${b} * ${c}`,
        difficulty: a > 9 ? 3 : 2,
      }
    },
  },

  {
    id: 'maths-unit-conversion',
    count: 10,
    subject: 'maths',
    topic: 'Measurement',
    skill: 'unit_conversion',
    type: 'measurement',
    difficulty: 2,
    tags: ['measurement', 'units', 'generated'],
    build(r) {
      const [big, small, factor] = r.pick([
        ['m', 'cm', 100],
        ['km', 'm', 1000],
        ['kg', 'g', 1000],
        ['litres', 'ml', 1000],
      ] as const)
      const value = r.int(11, 99) / 10
      const answer = Math.round(value * factor)
      const bigOne = big === 'litres' ? 'litre' : big
      return {
        question: `How many ${small} are there in ${decimal(value)} ${big}?`,
        options: [
          `${answer} ${small}`,
          `${answer / 10} ${small}`,
          `${answer * 10} ${small}`,
          `${decimal(value / factor)} ${small}`,
          `${decimal(value)} ${small}`,
        ],
        distractorNotes: [
          '',
          `This multiplies by ${factor / 10} instead of ${factor}.`,
          `This multiplies by ${factor * 10} instead of ${factor}.`,
          `This divides by ${factor}. Going from a big unit to a small one gives *more* of them, so multiply.`,
          'This changes the label without changing the number.',
        ],
        explanation: `There are ${factor} ${small} in 1 ${bigOne}, so multiply: ${decimal(value)} × ${factor} = ${answer} ${small}.`,
        learningPoint:
          'Changing to a smaller unit always gives a bigger number, so multiply — and check the size of your answer makes sense.',
        verify: `${value} * ${factor}`,
      }
    },
  },

  {
    id: 'maths-mean-of-five',
    count: 10,
    subject: 'maths',
    topic: 'Data handling',
    skill: 'mean',
    type: 'statistics',
    difficulty: 2,
    tags: ['average', 'mean', 'generated'],
    build(r) {
      const values = Array.from({ length: 5 }, () => r.int(2, 40))
      const total = values.reduce((s, v) => s + v, 0)
      const sorted = [...values].sort((x, y) => x - y)
      const range = sorted[4] - sorted[0]
      const midpoint = (sorted[0] + sorted[4]) / 2
      // Whole-number answers only — the mean of five scores should not need a
      // decimal at this level, and the distractors must be tidy as well.
      if (total % 5 !== 0 || !Number.isInteger(midpoint)) throw new Error('untidy')
      const context = r.pick([
        'test scores',
        'lengths in centimetres',
        'numbers of goals scored in a season',
        'temperatures in °C',
        'weights in kilograms',
      ])
      return {
        question: `Five ${context} are ${values.join(', ')}. What is the mean?`,
        options: [
          `${total / 5}`,
          `${sorted[2]}`,
          `${range}`,
          `${total}`,
          `${midpoint}`,
        ],
        distractorNotes: [
          '',
          'This is the median — the middle value once they are in order.',
          'This is the range — the difference between largest and smallest.',
          'This is the total. The mean is the total shared between the five.',
          'This is halfway between the largest and smallest, which is not the mean.',
        ],
        explanation: `Add them up: ${values.join(' + ')} = ${total}. There are 5 values, so the mean is ${total} ÷ 5 = ${total / 5}.`,
        learningPoint: 'Mean = total ÷ how many. Check you have divided by the number of values.',
        verify: `(${values.join(' + ')}) / 5`,
      }
    },
  },

  {
    id: 'maths-temperature-rise',
    count: 10,
    subject: 'maths',
    topic: 'Negative numbers',
    skill: 'temperature_difference',
    type: 'number',
    difficulty: 2,
    tags: ['negative numbers', 'temperature', 'generated'],
    build(r) {
      const below = r.int(2, 14)
      const above = r.int(2, 16)
      const place = r.pick([
        'Aviemore',
        'the school field',
        'a mountain hut',
        'the allotment',
        'Sheffield',
        'the car park',
      ])
      return {
        question: `At midnight the temperature at ${place} was −${below} °C. By noon it had risen to ${above} °C. By how many degrees did it rise?`,
        options: [
          `${below + above} °C`,
          `${Math.abs(above - below)} °C`,
          `${below} °C`,
          `${above} °C`,
          `${below + above - 1} °C`,
        ],
        distractorNotes: [
          '',
          'This subtracts the two numbers, which ignores the crossing of zero.',
          'This counts only the rise up to 0 °C.',
          'This counts only the rise from 0 °C, missing the part below zero.',
          'This misses one degree — count the step from −1 °C to 0 °C as well.',
        ],
        explanation: `The temperature climbs ${below} degrees to reach 0 °C, then a further ${above} degrees. Altogether that is ${below} + ${above} = ${below + above} degrees.`,
        learningPoint:
          'To find a change that crosses zero, add the two distances from zero rather than subtracting.',
        verify: `${below} + ${above}`,
        difficulty: below + above > 20 ? 3 : 2,
      }
    },
  },

  {
    id: 'maths-money-change',
    count: 10,
    subject: 'maths',
    topic: 'Word problems',
    skill: 'multi_step_money',
    type: 'word-problem',
    difficulty: 3,
    tags: ['money', 'multi-step', 'generated'],
    build(r) {
      const count = r.int(3, 6)
      const each = r.int(8, 30) * 10 // pence, always a neat 10p amount
      const extraItem = r.pick(['pencil case', 'ruler', 'sketchpad', 'glue stick', 'folder'])
      const item = r.pick(['notebook', 'gel pen', 'highlighter', 'eraser', 'protractor'])
      const extra = r.int(12, 60) * 10
      const paid = r.pick([1000, 2000, 2000, 5000])
      const spent = count * each + extra
      if (spent >= paid - 50) throw new Error('no change worth asking about')
      // Every distractor has to be a believable amount of change, so the
      // "multiplied everything" one must not come out negative.
      if (count * (each + extra) >= paid) throw new Error('distractor goes negative')
      return {
        question: `${r.pick(NAMES)} buys ${count} ${item}s at ${pounds(each)} each and one ${extraItem} costing ${pounds(extra)}, and pays with a £${paid / 100} note. How much change should there be?`,
        options: [
          pounds(paid - spent),
          pounds(spent),
          pounds(paid - count * each),
          pounds(paid - (each + extra)),
          pounds(paid - count * (each + extra)),
        ],
        distractorNotes: [
          '',
          'This is what she spends, not the change she gets back.',
          `This forgets the ${extraItem}.`,
          `This pays for only one ${item} instead of ${count}.`,
          `This multiplies the ${extraItem} by ${count} as well, but she buys only one.`,
        ],
        explanation: `${count} × ${pounds(each)} = ${pounds(count * each)}, plus ${pounds(extra)} for the ${extraItem}, giving ${pounds(spent)}. The change is £${paid / 100} − ${pounds(spent)} = ${pounds(paid - spent)}.`,
        learningPoint:
          'In a multi-step money question, work out the total spent first, then take it away from what was handed over.',
        verify: `(${paid} - (${count} * ${each} + ${extra})) / 100`,
      }
    },
  },

  {
    id: 'vr-letter-shift-code',
    count: 10,
    subject: 'verbal-reasoning',
    topic: 'Codes',
    skill: 'letter_codes',
    type: 'codes',
    difficulty: 3,
    tags: ['codes', 'letter shifts', 'generated'],
    build(r) {
      const shift = r.int(2, 4)
      const example = r.pick(CODE_WORDS)
      const target = r.pick(CODE_WORDS.filter((w) => w !== example))
      const coded = shiftWord(target, shift)
      const firstOnly = letter((target.charCodeAt(0) - 65 + shift) % 26) + target.slice(1)
      const lastTooFar =
        coded.slice(0, -1) + letter((target.charCodeAt(target.length - 1) - 65 + shift + 1) % 26)
      return {
        question: `If ${example} is written in code as ${shiftWord(example, shift)}, how would ${target} be written in the same code?`,
        options: [
          coded,
          shiftWord(target, shift - 1),
          shiftWord(target, -shift),
          lastTooFar,
          firstOnly,
        ],
        distractorNotes: [
          '',
          `This moves each letter forward only ${shift - 1} place${shift - 1 === 1 ? '' : 's'}.`,
          'This moves the letters backwards instead of forwards.',
          `The last letter has moved ${shift + 1} places rather than ${shift}.`,
          'Only the first letter has been coded — the rule applies to every letter.',
        ],
        explanation: `Each letter moves forward ${shift} places: ${[...example].map((c, i) => `${c} → ${shiftWord(example, shift)[i]}`).join(', ')}. Doing the same to ${target} gives ${coded}.`,
        learningPoint:
          'Work out the rule from the example first, then apply exactly the same rule to every letter of the new word.',
      }
    },
  },

  {
    id: 'vr-letter-sequence-pairs',
    count: 10,
    subject: 'verbal-reasoning',
    topic: 'Letter sequences',
    skill: 'letter_patterns',
    type: 'letter-sequence',
    difficulty: 2,
    tags: ['letter sequence', 'patterns', 'generated'],
    build(r) {
      const step = r.int(2, 3)
      const gap = r.int(1, 3)
      const start = r.int(0, 25 - 5 * step - gap)
      const pair = (i: number) => letter(start + i * step) + letter(start + i * step + gap)
      const shown = [0, 1, 2, 3].map(pair).join(', ')
      const nextStart = start + 4 * step
      return {
        question: `What comes next in this sequence? ${shown}, ___`,
        options: [
          letter(nextStart) + letter(nextStart + gap),
          letter(nextStart - 1) + letter(nextStart - 1 + gap),
          letter(nextStart + 1) + letter(nextStart + 1 + gap),
          letter(nextStart) + letter(nextStart + gap + 1),
          letter(nextStart + step) + letter(nextStart + step + gap),
        ],
        distractorNotes: [
          '',
          `This moves on only ${step - 1} letter${step - 1 === 1 ? '' : 's'} instead of ${step}.`,
          `This moves on ${step + 1} letters instead of ${step}.`,
          `The first letter is right, but the pair should be ${gap} apart, as in ${pair(0)}.`,
          'This jumps two pairs ahead rather than one.',
        ],
        explanation: `Each pair starts ${step} letters after the last: ${[0, 1, 2, 3, 4].map((i) => letter(start + i * step)).join(' → ')}. Within a pair the second letter is ${gap} on from the first, so the answer is ${letter(nextStart)}${letter(nextStart + gap)}.`,
        learningPoint:
          'Look at the first letters as their own sequence, then the second letters as another.',
      }
    },
  },

  {
    id: 'vr-number-series-growing',
    count: 10,
    subject: 'verbal-reasoning',
    topic: 'Number and letter relationships',
    skill: 'number_series',
    type: 'number-series',
    difficulty: 3,
    tags: ['number series', 'patterns', 'generated'],
    build(r) {
      const start = r.int(2, 12)
      const gap = r.int(2, 6)
      const growth = r.int(1, 4)
      // Gaps of gap, gap+growth, gap+2·growth, … so the differences themselves
      // form a sequence — the step up from a constant-difference series.
      const terms = [start]
      for (let i = 0; i < 3; i += 1) terms.push(terms[i] + gap + i * growth)
      const last = terms[3]
      const lastGap = gap + 2 * growth
      const answer = last + gap + 3 * growth
      return {
        question: `What is the next number in this sequence? ${terms.join(', ')}, ___`,
        options: [
          `${answer}`,
          `${last + lastGap}`,
          `${last + gap}`,
          `${answer + growth}`,
          `${last * 2}`,
        ],
        distractorNotes: [
          '',
          `This repeats the last gap of ${lastGap} instead of letting it grow by ${growth} again.`,
          `This uses the first gap of ${gap}, which only fitted the first step.`,
          `This grows the gap by ${growth} twice over.`,
          'This doubles the last number, but the sequence does not multiply.',
        ],
        explanation: `The gaps are ${[0, 1, 2].map((i) => gap + i * growth).join(', ')} — each ${growth} more than the one before. The next gap is ${gap + 3 * growth}, so the next number is ${last} + ${gap + 3 * growth} = ${answer}.`,
        learningPoint:
          'If the gaps are not equal, write them down and look for a pattern in the gaps themselves.',
        verify: `${last} + ${gap + 3 * growth}`,
      }
    },
  },
]
