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
  "options": ["6/8", "5/8", "9/16", "12/20"],
  "answer": 0,                        // index into options — see note below

  "explanation": "3/4 is equivalent to 6/8 because both the numerator and denominator have been multiplied by 2.",
  "distractorNotes": [                // optional; same length as options
    "",                               // the correct option's entry is empty
    "The denominator has been doubled but the numerator only increased by 2.",
    "The numerator was multiplied by 3 but the denominator by 4.",
    "12/20 simplifies to 3/5, not 3/4."
  ],
  "learningPoint": "To make an equivalent fraction, multiply or divide the top and the bottom by the same number.",
  "followUpIds": ["maths-fractions-004"],  // optional; see Follow-ups below
  "tags": ["fractions", "equivalence"]
}
```

### Required fields

`id`, `subject`, `topic`, `skill`, `type`, `difficulty`, `question`, `options`, `answer`, `explanation`, `learningPoint`, `tags`.

### Always write the correct answer first

Set `"answer": 0` and put the correct option at the start of `options`. This makes questions much easier to write and review.

The app permutes the options at load time using a hash of the `id` (`src/data/shuffle.ts`), so the child never sees a pattern. The order is stable — the same question always looks the same to them — and `distractorNotes` are realigned automatically.

**Do not shuffle by hand.** If you do, `answer` must still point at the correct option, but you lose the reviewability benefit for no gain.

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

## Validation

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
- Fewer than 3 options
- `passageId` or `followUpIds` referencing something that doesn't exist
- `followUpIds` referencing itself
- Malformed JSON

Warnings (printed, don't fail the build):

- Correct option much longer than every distractor
- Explanation suspiciously short
- No tags
- One answer position dominating the bank after shuffling
- A question with no possible follow-up

## Adding questions

1. Open the relevant file in `src/data/`.
2. Append your objects, correct answer first, following the id convention.
3. Run `npm run validate`.
4. Run `npm run dev` and try them.

No code changes are needed — the bank is loaded and indexed automatically.
