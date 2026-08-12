# Aligning the question bank to the Latymer / GL papers

Written after reading the familiarisation papers added under `data/past papers/`.
This is a **gap analysis and plan**, not a set of changes — the text banks
(Maths, English, VR) were left untouched pending your decision on each item
below. The Non-Verbal Reasoning taster **was** built (see the last section).

## What the papers are

The added papers are **GL Assessment "Familiarisation" papers** — the format
the Latymer School and many other GL-consortium grammar schools set at 11+.
They cover six booklets: Maths, English, Verbal Reasoning, Non-Verbal
Reasoning, a combined Non-Verbal Reasoning & Maths, and Verbal Skills.

Key facts that shape the app:

- **Every section is 5-option multiple choice (A–E)** marked on a separate
  answer sheet — including Maths. The app already moved to five options, so this
  matches.
- Rough timings: Maths ~50 min / 50 Q; English ~50 min / ~54 Q; VR ~50 min / 80 Q.
- Difficulty "varies between schools" (their words) — so exact mimicry isn't the
  goal; matching **question _types_** is.

> ⚠️ **Copyright.** The PDFs under `data/past papers/` are © GL Assessment and
> are **not** licensed for redistribution. Do not commit them to the public
> repo or reproduce their wording. All app questions stay original, written in
> the style of these types. This document describes formats only.

---

## Maths — mostly aligned, four missing question types

The app's topics (place value, factors/multiples, order of operations, negative
numbers, fractions, decimals, percentages, ratio, measurement, geometry, data,
word problems) cover most of the paper well. Types seen in the real paper that
the bank has **no** questions for:

| Missing type | Example from the paper | Suggested topic | Effort |
| --- | --- | --- | --- |
| **Coordinates on a grid** | "The lighthouse is at ( , )" — read/plot points | new `Coordinates` topic, or fold into Geometry | ~6 Q |
| **Roman numerals** | answer "MLXVI" | add to `Place value` | ~4 Q |
| **Timetables & time intervals** | train timetable; "10:20 → 11:15, how many minutes?" | add to `Measurement` (or new `Time`) | ~5 Q |
| **Function machines / simple algebra** | "×2 then −4 = 10, find the number"; `a − 9 = 10` | new `Algebra` topic | ~5 Q |

Also common and worth a few more of: **pictograms** (a symbol = N items),
**area by counting unit squares**, and **"about how much/long"** estimation of
sensible units. These fit existing topics.

**Recommendation:** add ~20 questions across the four gaps. All are numeric, so
each can carry a `verify` expression and be machine-checked by `npm run validate`.

All four are also **template-shaped** — the reasoning is fixed and only the
numbers move — so each is one entry in `src/data/templates.ts` rather than five
or six hand-written objects, and the `verify` expression comes out of the
template for free. Roman numerals need a conversion helper; the other three are
a dozen lines each. See [question-format.md](question-format.md#templates-one-style-many-numbers).

---

## English — one structural gap: the GL "spot the error / N" format

The real English paper is built from **exercises**, not loose questions:

1. Two **comprehension passages** (one fiction, one non-fiction) — the app's 8
   passages and 36 comprehension questions already match this well.
2. A **Spelling exercise** and a **Punctuation exercise** in GL's signature
   format: a sentence is split into labelled parts and the child picks the part
   containing the mistake — **or option N = "No mistake"**. Roughly 1 in 5
   answers is N.

The app's spelling and punctuation questions instead ask "which sentence is
correct?" / "which prefix…". That tests similar knowledge but is a **different
task** from what the child meets on the day.

**Recommendation (per item):**

- Add a set of **error-spotting** spelling questions: one sentence, five options
  where A–D are candidate error sites and **E is "No mistake"**. ~8 Q.
- Add the same for **punctuation** (missing comma, apostrophe, capital, speech
  marks, or "No mistake"). ~8 Q.
- Keep the existing spelling/punctuation questions — they're still useful; this
  adds the exam-shaped variant alongside them.
- The engine needs no change: "No mistake" is just option E. Worth a shared note
  in the explanation so the child learns that N is a real, correct answer.

Grammar and vocabulary in the app are fine as-is (GL folds these into the
comprehension and cloze items).

---

## Verbal Reasoning — well matched; two GL types to add

The 80-question VR paper cycles through ~21 short GL types. The app's 13 topics
already cover most: synonyms, antonyms, analogies, classification, letter
sequences, codes, hidden words, word building, word relationships,
number/letter relationships, logic, vocabulary, word sequences.

Two classic GL types have no clear home in the bank:

| Missing type | What it is | Suggested topic |
| --- | --- | --- |
| **Word with two meanings (homograph)** | pick the word that fits both bracketed clues — e.g. _spring, bark, let, counter, plot_ | new `Two meanings` topic (~6 Q) |
| **Insert a letter** | one letter ends the first word **and** starts the second: `boo(?)ar` → k | could extend `Word building` (~6 Q) |

Everything else in the paper (letter-for-number codes, number series, number
logic, move-a-letter, compound words) maps onto existing topics.

**Recommendation:** add ~12 VR questions for the two missing types. Both are
hand-written work — the answer depends on the *words*, not on a number that can
be varied. (The bank's letter codes, letter sequences and number series are now
template-generated; the word-based types are not, and should not be.)

---

## Non-Verbal Reasoning — taster built ✅

NVR was absent entirely and is purely visual, so a **12-question taster** was
added as a new subject to prove the format end-to-end:

- New bank `src/data/non-verbal-reasoning.json`, 3 topics × 4 questions:
  **Odd one out**, **Sequences**, **Figure pairs** (analogies).
- Shapes are **inline SVG** using `currentColor`, so they track light/dark theme.
- Rendering support added to `Question` (`figure`, `optionFigures`), the option
  shuffler, and `QuestionCard`; each option keeps a text description as its
  screen-reader label and review-sheet fallback.
- Registered in `subjects.ts`, `index.ts`, and the validator. Passes
  `validate`, `typecheck`, `test`, and `build`.

**To grow it into a full section** (a larger, later piece): more types
(rotation, reflection, completing a matrix/grid, hidden shape, nets of cubes),
and ideally a small library of reusable SVG shape helpers so authoring each
question isn't hand-drawn from scratch. NVR is inherently inaccessible to
screen-reader-only users; the text descriptions mitigate but don't remove this.

---

## Suggested order if you pick these up

1. English "No mistake" spelling + punctuation (highest fidelity gain, ~16 Q).
2. Maths coordinates / Roman numerals / timetables / algebra (~20 Q, all
   machine-verifiable, and all four best written as templates).
3. VR two-meanings + insert-a-letter (~12 Q, hand-written).
4. Grow NVR beyond the taster.

Every batch: `npm run generate` if it touched a template, `npm run validate`,
then `npm run review` and read `docs/review-sheet.md`, then `npm run review:accept`.
