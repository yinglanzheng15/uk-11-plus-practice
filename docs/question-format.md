# Question bank format

Questions live in `src/data/` as plain JSON arrays, one file per subject. They are deliberately kept separate from the application logic, so adding questions never means touching the code.

## Schema

```jsonc
{
  "id": "maths-fractions-001",        // unique, kebab-case: <subject>-<topic>-<nnn>
  "subject": "maths",                 // maths | english | verbal-reasoning
  "topic": "Fractions",               // shown to the child; groups mastery
  "skill": "equivalent_fractions",    // snake_case; used to find follow-up questions
  "type": "fractions",                // question family, e.g. analogies, word-problem
  "difficulty": 2,                    // 1 Foundation, 2 Standard, 3 Challenging, 4 Stretch
  "passageId": "passage-lighthouse",  // optional; English comprehension only

  "question": "Which fraction is equivalent to 3/4?",
  "options": ["6/8", "5/8", "9/16", "12/20", "4/5"],   // exactly five
  "answer": 0,                        // index into options — see note below

  "explanation": "3/4 is equivalent to 6/8 because both the numerator and denominator have been multiplied by 2.",
  "distractorNotes": [                // optional; same length as options
    "",                               // the correct option's entry is empty
    "The denominator has been doubled but the numerator only increased by 2.",
    "The numerator was multiplied by 3 but the denominator by 4.",
    "12/20 simplifies to 3/5, not 3/4.",
    "This adds 1 to the top and 1 to the bottom, which changes the value."
  ],
  "learningPoint": "To make an equivalent fraction, multiply or divide the top and the bottom by the same number.",
  "followUpIds": ["maths-fractions-004"],  // optional; see Follow-ups below
  "tags": ["fractions", "equivalence"]
}
```

### Required fields

`id`, `subject`, `topic`, `skill`, `type`, `difficulty`, `question`, `options`, `answer`, `explanation`, `learningPoint`, `tags`.

### Exactly five options

Every question has **five** options, A to E — the shape the papers these schools set actually use. Four is easier in a way that matters: a blind guess is worth 25% rather than 20%, and eliminating two leaves a choice of two rather than three. The validator rejects anything that is not exactly five.

The fifth option has to be a *real* mistake, like the others. A padded fifth that nobody would pick restores the four-option question and wastes a line.

### Always write the correct answer first

Set `"answer": 0` and put the correct option at the start of `options`. This makes questions much easier to write and review.

The app permutes the options at load time using a hash of the `id` (`src/data/shuffle.ts`), so the child never sees a pattern. The order is stable — the same question always looks the same to them — and `distractorNotes` are realigned automatically.

**Do not shuffle by hand.** If you do, `answer` must still point at the correct option, but you lose the reviewability benefit for no gain.

### `fixedOptions`: when the order *is* the question

Set `"fixedOptions": true` and the load-time shuffle is skipped, so the authored order is the served order — and `answer` then points at the true position, not 0.

Use it only where the order carries meaning. The one shape in the bank today is GL's **error-spotting** items (`type: "spelling-error-spotting"` and `"punctuation-error-spotting"`): a sentence split into parts A–D read left to right, with **E always "No mistake"**. Shuffling those would scramble the sentence and hide the option the child is being taught to consider last. There is no always-pick-A risk, because the answer position varies with where the author put the mistake.

Roughly **one in five** of these should be "No mistake" — that is the real papers' rate, and a child who never sees it correct learns never to pick it. Spread the rest across A–D. A smoke-test check enforces both the trailing "No mistake" and the 10–30% band.

## Follow-ups: the learning loop

When a question is answered incorrectly, the app serves a *related* question. It looks for one in this order:

1. An unused entry in `followUpIds`
2. Another question with the **same `skill`**, closest in difficulty
3. Another question in the **same topic**, preferring an easier one
4. Anything in the same subject at the same difficulty or below

So `followUpIds` is optional — the `skill` field does the work by default. Set it explicitly when a specific pairing teaches better, for example:

- "What is 25% of £80?" → "What is 10% of £60?"

Because of fallback rules 2–4, **give at least two questions the same `skill`** wherever you can. The validator warns when a question has no possible follow-up.

## Writing good questions

- **One unambiguous correct answer.** If a reasonable child could argue for another option, rewrite it.
- **Distractors must be realistic mistakes.** If the correct answer requires dividing before adding, one distractor should be the result of adding first.
- **No accidental clues.** Avoid `12 / 13 / 14 / 1000`, and don't make the correct option noticeably longer or more detailed than the others — the validator warns about this.
- **Explain, don't just state.** The explanation should teach the method, not merely assert the answer.
- **`learningPoint` is a rule, not a recap.** "Divide by the bottom, multiply by the top" — something worth remembering next time.
- **`distractorNotes` are where exam technique is taught.** Say *why* each wrong answer is tempting.
- **UK conventions throughout:** UK spelling, £, metric units, "maths", "year group", "football". Never "math", "grade", "soccer".
- **Age-appropriate but not babyish** — Year 5/6 level, aimed at selective-school entry.

### Difficulty is not just bigger numbers

| Level | Meaning |
| --- | --- |
| 1 | Foundation — single step, familiar wording |
| 2 | Standard 11+ |
| 3 | Challenging — multiple steps, less obvious distractors |
| 4 | Very challenging — competing plausible answers, unfamiliar phrasing, subtle reasoning |

Difficulty should come from the reasoning required, not the size of the digits.

## Comprehension passages

Passages live in `src/data/passages.json`:

```jsonc
{
  "id": "passage-lighthouse",
  "title": "The Keeper's Daughter",
  "text": ["First paragraph…", "Second paragraph…"]
}
```

Questions reference one with `passageId`. Several questions should share a passage — that mirrors how comprehension is actually assessed and rewards reading it properly. Passages must be **original writing**, never extracts from published work.

## Templates: one style, many numbers

A **template** is a question style plus the numbers it varies over. It lives in `src/data/templates.ts` and is expanded by `npm run generate` into `src/data/generated.json` — an ordinary bank file that is validated, reviewed, shuffled and served like any hand-written question.

```ts
{
  id: 'maths-percentages-sale-price',   // variants become …-v01, -v02, …
  count: 12,
  subject: 'maths', topic: 'Percentages', skill: 'percentage_decrease',
  type: 'percentages', difficulty: 2, tags: ['percentages', 'money'],
  build(r) {
    const price = 20 * r.int(3, 25)          // r is a seeded RNG: int() and pick()
    const cut = r.pick([10, 15, 20, 25, 40])
    const discount = price * cut / 100
    return {
      question: `A tent costs £${price}. Its price is reduced by ${cut}%. …`,
      options: [ …correct first… ],
      distractorNotes: [ … ],
      explanation: …, learningPoint: …,
      verify: `${price} - ${price} * ${cut} / 100`,
    }
  },
}
```

What makes this worth doing rather than just pasting more JSON:

- **Distractors are computed from the same numbers as the answer**, so every variant still catches the misconception it was designed around — "found the discount but not the price paid" stays wrong in exactly that way at any price.
- **`verify` is generated too**, so the arithmetic of all twelve variants is proved by the validator.
- **Seeds come from the template id and variant number**, so output is reproducible: the same twelve questions every run, with stable ids, so progress and spaced repetition keep working.

Rules:

- Put the correct option first, as everywhere else — the app shuffles.
- Keep values integer and pick ranges that stay realistic (a £47 bicycle in a 17% sale is not an 11+ question).
- A `build` may throw or return colliding options; the generator discards that draw and re-rolls, so ranges do not need to be collision-proof.
- Editing a `build` deliberately re-rolls its variants. The ids survive but the numbers change, which resets what a child had learnt about *those* questions — prefer adding a new template to rewriting a popular one.
- Do not hand-edit `generated.json`; it is overwritten on every build.

A template is the wrong tool when the reasoning itself is what varies — comprehension, most verbal reasoning, anything where a good distractor depends on the specific words. Those stay hand-written.

## Vetting new questions

Two layers, because they catch different things.

### Layer 1 — automated (`npm run validate`)

Catches anything mechanically checkable. Runs as the first step of `npm run build`, so a broken bank cannot be deployed.

The strongest check is **`verify`**: an optional arithmetic expression that must evaluate to the correct option.

```jsonc
"question": "A jacket costs £60. Its price rises by 10%. What is the new price?",
"options": ["£66", "£6", "£70", "£54"],
"answer": 0,
"verify": "60 + 60 / 10"
```

The validator computes `60 + 60 / 10 = 66`, reads `£66` from the marked answer, and fails the build if they disagree. This means the arithmetic is *proved*, not merely asserted by whoever wrote the question. **Add `verify` to every maths question whose answer is a plain number.** It costs one line and removes a whole category of mistake.

It only accepts digits and `+ - * / ( ) .`, so there is no way to smuggle code into it.

### Layer 2 — human (`npm run review`)

Writes **`docs/review-sheet.md`**: every question in the shuffled order the child actually sees, with the correct answer marked, the distractor notes inline, and the explanation underneath.

This exists because automation cannot judge whether a question is *fair*. Read it looking for:

- Could a bright child argue for a different answer?
- Is a distractor accidentally correct, or so silly it can be dismissed on sight?
- Is the wording clear on first reading? Is the vocabulary fair for Year 5/6?
- Does the explanation teach the method, or just restate the answer?
- Is the difficulty label about right?

Once you have read it:

```bash
npm run review:accept     # records every current id in docs/.review-seen
npm run review -- new     # next time, shows only questions added since
```

So a growing bank never means re-reading questions you have already approved.

### Why both layers

Every structural mistake I have made in this bank was caught by layer 1. Every *reasoning* mistake — a code question whose rule did not actually hold, a compound-word question where the answer only worked for two of the three words — was invisible to it and only found by reading. Run both.

## Validation reference

```bash
npm run validate
```

Errors (these fail the build):

- Missing required fields
- Duplicate ids
- Duplicate question text **and** options
- `answer` index out of range
- Duplicate options
- Invalid subject or difficulty
- `distractorNotes` length not matching `options`
- Not exactly 5 options
- `passageId` or `followUpIds` referencing something that doesn't exist
- `followUpIds` referencing itself
- **`verify` not matching the marked answer**, or not being valid arithmetic
- **A hidden-word answer that does not really span a word boundary** — the letters are checked against every join in the sentence, and the wrong options are checked for accidentally hiding it too
- **American usage** — "math", "soccer", "grade", "color", "$", `-ize` endings and similar
- Malformed JSON

Warnings (printed, don't fail the build):

- Correct option much longer than every distractor
- Explanation suspiciously short, or no tags
- One answer position dominating the bank after shuffling
- A question with no possible follow-up
- Two identical distractor notes, or a note on the correct option
- Options mixing numeric and non-numeric values, or inconsistent units
- A subject with under 12% Foundation (difficulty 1) questions
- A topic with fewer than 4 questions
- A passage used by fewer than 3 questions
- Three or more questions sharing an identical learning point

## Adding questions

**One question at a time** — comprehension, vocabulary, anything where the distractors depend on the words:

1. Open the relevant file in `src/data/`.
2. Append your objects, correct answer first, following the id convention.
3. Run `npm run validate`.
4. Run `npm run dev` and try them.

No code changes are needed — the bank is loaded and indexed automatically.

**A dozen at a time** — anything where the numbers are what vary:

1. Add a template to `src/data/templates.ts` (see [Templates](#templates-one-style-many-numbers) above).
2. Run `npm run generate`, then `npm run validate`.
3. Read a variant or two in `docs/review-sheet.md` before trusting the other ten.

The rule of thumb: if you find yourself copying a question and changing the numbers, write a template instead.
