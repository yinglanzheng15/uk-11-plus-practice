# Scope: written answers

**Status:** proposal, not built. Branch `written-answers` contains this document and one runnable spike (`scripts/spike-answer-matching.ts`). No application code has been changed.

## Why

The app is entirely multiple choice: 288 questions, four options each, answered by tapping. That matches GL Assessment's multiple-choice papers, the ISEB Common Pre-Test and consortium-style computerised tests.

It does not match **GL standard-format papers**, where the answer is written into the booklet, or the papers many independent schools set themselves. The difference is not cosmetic. With four options a pupil can work backwards from them, eliminate two and guess between the rest, or recognise an answer they could not have produced. Typing `£43.20` from nothing is a harder task, and it is the task some schools actually set.

**Check which format the target school uses before building this.** If they sit a multiple-choice paper, this work has little value and the effort is better spent on the question bank.

---

## The finding that shapes everything

I expected the hard part to be marking free text. It is not — see the spike below. The hard part is that **most questions in the bank cannot be asked without their options at all.**

A stem like *"Which of these numbers is a prime number?"* is meaningless with the options removed. So is *"Which sentence contains a subordinate clause?"* These are not multiple-choice presentations of an underlying question; the options **are** the question.

Measured across the bank (`npx tsx scripts/spike-answer-matching.ts`):

| Subject | Usable as written answers with no rewriting | Total |
| --- | --- | --- |
| Maths | **83** | 104 |
| Verbal Reasoning | **42** | 104 |
| English | **9** | 80 |
| **Total** | **134** | **288** |

A question counts as usable only if its stem stands alone *and* the answer is a short, typeable string.

This splits the subjects sharply:

- **Maths converts well.** 83 of 104 already read as *"Round 34 962 to the nearest thousand."* — a question with one right answer that a pupil can produce unaided. This is also where written answers matter most, since written maths papers are the common case.
- **Verbal Reasoning converts partially.** Codes, letter sequences and number series work (*"If CAT is written as DBU, what is the code for DOG?"*). Synonyms, antonyms and odd-one-out do not, and cannot be fixed by rewording: *"Which word means most nearly the same as 'begin'?"* has many defensible answers — start, commence, initiate — and is only well-posed because it offers four.
- **English barely converts at all.** 9 of 80. Comprehension answers are sentences; grammar and punctuation questions ask you to *choose* between forms. This is inherent, not a defect of how they were written.

**Consequence:** this is essentially a maths feature, with some VR. Do not scope it as covering the whole app.

---

## The spike: marking free text

`scripts/spike-answer-matching.ts` is a runnable prototype of the matcher, tested against real answers from the bank. It passes 30 cases.

The rule it implements: **generous about presentation, strict about substance.**

Accepted as the same answer:

| Typed | Marked answer | Why |
| --- | --- | --- |
| `35000`, `35,000` | `35 000` | thousands separators are noise |
| `43.2`, `43.20` | `£43.20` | currency symbol and trailing zero optional |
| `350`, `350cm` | `350 cm` | unit optional when the question named it |
| `70` | `70°` | degree symbol is hard to type |
| `-8` | `−8` | nobody types a Unicode minus |

Rejected:

| Typed | Marked answer | Why |
| --- | --- | --- |
| `3500` | `35 000` | wrong value |
| `350 mm` | `350 cm` | right number, **wrong unit** — the mistake worth catching |
| `4/8` | `1/2` | equivalent, but the question asked to simplify |
| `shelfs` | `shelves` | spelling is the point of the question |

### What normalisation cannot do

Six cases in the spike are wrongly rejected by the matcher alone and only pass when the question supplies a list of alternatives: `two thirds` for `2/3`, `half` for `1/2`, `five` for `5`, and three different ways of writing `07:25`.

So the schema needs a per-question field:

```jsonc
"answerText": "07:25",
"accept": ["7:25", "7.25", "25 past 7"]
```

This cannot be automated away and cannot be skipped: without it, a child who types a correct answer in a reasonable form is told they are wrong, which is worse than not having the feature. **Every converted question needs a human to think about what else a Year 5 pupil might legitimately type.** That, not the code, is the bulk of the work.

---

## What would change

### Data (`src/types.ts`, `src/data/*.json`)

```jsonc
{
  "answerFormat": "written",   // absent means "choice", so all 288 existing questions are untouched
  "answerText": "35 000",
  "accept": ["35000"],
}
```

`options`, `answer` and `distractorNotes` stay. A written question should keep them so it can **fall back to multiple choice** — which matters for the learning loop, where a pupil who has just failed twice should be offered the easier form.

### Validator (`scripts/validate-questions.ts`)

- `answerText` required when `answerFormat` is `written`
- `answerText` must match `options[answer]` after normalisation, so the two forms cannot drift apart
- the existing `verify` arithmetic check should run against `answerText` too
- warn when a numeric `answerText` has no `accept` entries and the value has a unit or a decimal — the cases most likely to be typed a different way

### Logic (`src/logic/answerMatching.ts`, new)

Promote the spike. Pure functions, no React, directly testable — this is where the smoke tests go.

### UI (`src/components/QuestionCard.tsx`)

A text input instead of the option buttons: `inputmode="decimal"` for numeric answers so tablets show a number pad, Enter to submit, no autocorrect or autocapitalise on spelling questions. The number-key shortcuts (1–4) must be disabled in this mode — they would type into the box.

### Session (`src/logic/session.ts`)

`SessionAnswer.chosen` is an option index. A written answer needs `typed: string` alongside it, and everything reading `chosen` needs auditing — the summary review, the mistake list, the distractor note lookup. A written answer has no distractor note, so the feedback panel needs a different branch: explain the correct answer, and where possible say something about the specific error (right number, wrong unit).

### Home

A setting, since it is a different kind of practice rather than a strict upgrade: *"Type my answers (Maths and Verbal Reasoning)"*, sitting next to the timer toggle.

---

## Effort

| Piece | Rough size |
| --- | --- |
| Matcher, promoted from the spike, with tests | small — mostly done |
| Types, validator rules, session/summary changes | medium |
| Text input, feedback panel branch, home setting | medium |
| **Converting ~83 maths questions**, each needing `accept` reviewed by a person | **the bulk of it** |
| Converting ~42 VR questions | moderate |

The code is perhaps a day. The content review is the real cost, and it cannot be rushed: a written-answer mode that marks correct answers wrong will be abandoned after one session, and it will damage the child's trust in everything else the app says.

---

## Risks

- **False negatives are worse than no feature.** Being told you are wrong when you are right is demoralising in a way that a hard question is not. Every rejection must be defensible.
- **Spelling becomes a hidden tax.** In a maths question, marking `fourty` wrong tests spelling rather than maths. Numeric questions should stay numeric; word answers should be limited to questions where the word *is* the point.
- **Typing speed is not maths ability.** In a timed session a slow typist is penalised for something the exam does not test. Consider giving written mode a more generous time allowance, or leaving the timer off by default.
- **It halves the bank.** 134 of 288 questions, and only 9 in English. A child switching this on sees far less variety and much more maths. The setting must say so.

---

## Recommendation

Build it **only if the target school sets a written paper.** If so, scope it as **maths-first**: convert the 83 maths questions, ship it, and see whether it gets used before touching Verbal Reasoning. Leave English as multiple choice permanently — the conversion rate of 9 out of 80 says that is what the material wants to be.

If the school sets a multiple-choice paper, the same effort spent on the question bank (288 → 400, and the human read-through that is still outstanding) is worth considerably more.

---

## Open questions

1. **Which paper does the target school actually set?** Everything above depends on this.
2. Should a wrong written answer offer the same question again as multiple choice, or go straight to the explanation? The first is gentler and uses the options that are already there.
3. Should written mode apply per session, per subject, or per question? A *"Maths: typed / Verbal Reasoning: choice"* split may be closer to real exam conditions than one global switch.
