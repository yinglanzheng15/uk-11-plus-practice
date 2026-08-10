# 11+ Practice

A quick, repeatable revision app for UK 11+ entrance-exam preparation in **Maths**, **English** and **Verbal Reasoning**, aimed at Year 5 / Year 6 pupils (roughly ages 9–11).

It runs entirely in the browser as a static site. No backend, no database, no login, no API keys, no paid services. All progress is stored in `localStorage` on the child's own device.

> The questions are original, written in the style of UK 11+ familiarisation material. This app is **not** affiliated with or endorsed by any school, consortium or examination board, and it does not reproduce any real exam paper.

---

## Status (handoff summary)

**Working state:** feature-complete and passing all checks. `npm run validate`, `npm test` (121 checks) and `npm run build` are all green as of the latest commit. No known bugs.

**What's built:**
- Full quiz engine with the wrong-answer learning loop, mastery tracking, streaks, and all revision modes (Quick 5/10/20, subject/topic practice, mixed, mistakes, weak areas, challenge, timed sessions).
- **288 questions** (104 Maths, 80 English, 104 Verbal Reasoning) across 8 comprehension passages — every topic has at least 4 questions, and every subject has both Foundation (difficulty 1) and Stretch (difficulty 4) coverage.
- **Two-layer question vetting**: `npm run validate` catches structural issues and machine-verifies maths answers via an optional `verify` expression; `npm run review` generates `docs/review-sheet.md` for human read-through, with `npm run review:accept` to avoid re-reviewing.
- **Skip for now.** A question can be parked and comes back at the end of the run for a second look. A skip records nothing and never counts against the score.
- **Resume after a refresh.** An unfinished session is saved as you go and offered back — *"Carry on where you left off?"* — for up to 24 hours. A timed session keeps the time it had left rather than burning it while the tab was shut.
- **Spaced repetition.** A question answered correctly comes back after 1 day, then 3, then 7, then 21. A mistake resets it to the start of the ladder.
- **Parent view** with Progress and Feedback tabs, plus **download and restore of progress** as a JSON file — the way to move a child's history to a new device, or to survive a cleared browser.
- **Live at [yinglanzheng15.github.io/uk-11-plus-practice](https://yinglanzheng15.github.io/uk-11-plus-practice/)**, redeployed by GitHub Actions on every push to `main`.

**Repo:** [github.com/yinglanzheng15/uk-11-plus-practice](https://github.com/yinglanzheng15/uk-11-plus-practice) — public, pushed and up to date.

**Not yet done / deliberately deferred:**
- **The 288 new-and-existing questions have passed `npm run validate` but only the first 156 have had a human read-through.** The letter sequences, codes and hidden words in the new batch were additionally checked by script. Run `npm run review` and read `docs/review-sheet.md` before treating the bank as vetted; then `npm run review:accept`.
- **Question bank is at 288/850+** of the original stretch target. See `ROADMAP.md`.
- No multi-child profiles, no NVR/problem-solving sections yet — both scoped in `ROADMAP.md` with rough effort/value notes.

**Where to pick this up:** `ROADMAP.md` has the full prioritised list. `docs/question-format.md` covers adding questions. `docs/review-sheet.md` is generated, not hand-edited — run `npm run review` after any bank change.

---

## What makes it different

Most quiz apps show the right answer and move on. This one doesn't.

When a question is answered incorrectly, the child gets:

1. **Not quite.** — clear, unambiguous, and never unkind
2. The correct answer, spelled out
3. **Why** that answer is correct
4. **Why the other answers are traps** — each distractor represents a realistic mistake
5. A short **Remember** rule
6. A **related follow-up question** — offered, not imposed

If the follow-up is also wrong, they get a second explanation and a second related question. After two attempts the app moves on with an encouraging message and flags the topic to revisit later — the child is never trapped.

Follow-up questions are recorded against topic mastery but **never count against the session score**, so engaging with the learning loop can only help.

### Or leave it to the end

Alongside *"Try a practice question"* there is a quieter **"Next question instead"**. Sitting through a practice question is the right thing when the child is working through a topic; it is the wrong thing when they are doing a timed run and want to keep going. Declining costs nothing — the mistake is recorded either way.

Whatever they choose, the session summary ends with **"Go through these"**: every question got wrong *and* every one left unanswered, each with what they picked and why it was tempting, the correct answer, the full explanation and the rule to remember. That is the review, and it is where the teaching lands if the practice questions were declined.

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173/uk-11-plus-practice/
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run validate` | Check the question bank for errors and quality warnings |
| `npm run review` | Write `docs/review-sheet.md` for human vetting of questions |
| `npm run review:accept` | Mark the current questions as reviewed |
| `npm test` | Run the engine test suite (121 checks) |
| `npm run typecheck` | TypeScript check, no build |
| `npm run build` | Validate → typecheck → build to `dist/` |
| `npm run preview` | Serve the production build locally |

`npm run build` runs the validator first, so a broken question bank cannot be deployed.

### Question vetting

Questions go through two layers before they count as done:

1. **`npm run validate`** — structure, duplicates, UK English, and *machine-verified arithmetic*: a maths question can carry a `verify` expression that the validator evaluates and checks against the marked answer, so the sums are proved rather than trusted.
2. **`npm run review`** — generates a readable sheet of every question, in the order the child sees them, for a person to check the things automation cannot judge: ambiguity, arguable distractors, and whether an explanation actually teaches.

Full details in [docs/question-format.md](docs/question-format.md).

---

## Running it

Day to day, run it locally:

```bash
npm install     # first time only
npm run dev
```

Then open **http://localhost:5173/uk-11-plus-practice/**. Progress is saved in that browser, so the child can pick up where they left off.

## The live site

**<https://yinglanzheng15.github.io/uk-11-plus-practice/>**

The repository is public and **Settings → Pages → Source** is set to **GitHub Actions**. Every push to `main` runs `.github/workflows/deploy.yml`, which runs the engine tests and the question-bank validator before building — so a broken bank or a failing test stops the deployment rather than shipping it. A deployment can also be re-run by hand from the **Actions** tab.

The site is free to host and has no backend. The URL is public to anyone who has it, which is fine here: there is no login, no personal data and no way to identify a user. Each child's progress lives in their own browser and is visible only on their own device.

### If you rename the repository

The site is served from a sub-path, so Vite must know the repository name. It is set in `vite.config.ts`:

```ts
base: '/uk-11-plus-practice/',
```

Change that one line to match the new name — it must have a slash at each end. For a user site hosted at `https://yinglanzheng15.github.io/` (a repo named `yinglanzheng15.github.io`), use `base: '/'` instead.

A `public/.nojekyll` file is included so GitHub Pages serves Vite's hashed asset filenames correctly.

---

## Feedback

The **Parent** screen has two tabs: **Progress** and **Feedback**.

Underneath every answer there is a quiet *"Report a problem with this question"* link. It offers a short list of reasons — *I think the answer is wrong*, *the question was confusing*, *a spelling mistake*, *too hard*, *too easy* — plus an optional comment. Reports collect in the Feedback tab together with any notes you add yourself.

Each report is stored against the question's id, so the tab shows the question text, the marked answer and the comment side by side. **Copy** and **Download** produce a Markdown summary containing those ids, which is exactly what someone needs to correct the bank — the ids match the ones in `docs/review-sheet.md`.

Like all the other data, feedback is stored only in that browser and is never sent anywhere. Sharing it is a deliberate copy-and-paste.

## Modes

| Mode | Description |
| --- | --- |
| **Quick 5 / 10 / 20** | Mixed-subject sessions of increasing length |
| **Subject practice** | Pick Maths, English or Verbal Reasoning, then a specific topic |
| **Mixed practice** | All three subjects, interleaved |
| **My mistakes** | Only questions previously answered incorrectly |
| **Weak areas** | Automatically targets topics below 70% mastery |
| **Challenge** | Prioritises difficulty 3–4 questions |

Any session can optionally be timed (about 45 seconds per question). The timer never fails the child — when it expires, the session ends gracefully and shows results for the questions reached.

**The clock stops while an explanation is on screen**, and while the child works through a follow-up question. A timed session measures time spent *answering*, not time spent reading — otherwise engaging with the learning loop would cost time, which is exactly backwards.

### Skipping a question

Every question has a **Skip for now** button. This is deliberate exam technique rather than a way out: the app already tells the child *"if a question is taking too long, make your best choice and move on"*, and until now there was no way to act on that advice.

A skipped question is **parked, not lost**. Once the run reaches the end, the skipped ones come back — *"Back to the ones you skipped"* — for a second look now the rest have been seen. Skipping on that second pass lets the question go for good, so the session always terminates.

Leaving a quiz is not destructive either: **Stop this session** and the **Home** link both keep the session, and the home screen offers it straight back. Only starting something new clears it.

A skip records nothing: no answer, no mastery change, no mark against the score. Anything still unanswered at the end is reported in the summary ("You left 2 questions") and excluded from the accuracy figure, so leaving a question never looks like getting it wrong. It stays unseen in the bank and comes round again another day.

---

## How question selection works

Deterministic weighted scoring in `src/logic/questionSelector.ts` — no AI involved.

```
never seen           very high priority
answered incorrectly high priority
due for review       moderate, rising the longer it is overdue
weak topic           bonus, scaled to how weak
not yet due          very low priority
```

**Spaced repetition** decides when a question is due. Each correct answer moves it one rung up a ladder of intervals — 1 day, 3 days, 7 days, 21 days — and a single mistake drops it straight back to the bottom, due immediately. This is why a question answered right three times running is deliberately left alone for a week even though it is the oldest thing in the bank: the aim is retention, not coverage.

On top of that:

- A question is **never repeated within a session**.
- The last 60 questions served are remembered **across** sessions and avoided.
- A **difficulty ceiling** rises with topic mastery, so harder questions appear gradually.
- If a filter leaves too few questions, constraints are relaxed in tiers rather than erroring, and the UI explains that the session is shorter than usual.
- Mixed sessions interleave subjects so the child isn't given all the maths at once.

## Mastery

Each topic gets a score from the child's accuracy on that topic, weighting their most recent attempt on each question equally with its whole history — so improvement shows up quickly.

| Score | Band |
| --- | --- |
| 0–39% | Needs work |
| 40–59% | Developing |
| 60–79% | Good |
| 80–94% | Strong |
| 95–100% | Mastered |

**Strong** and **Mastered** additionally require at least 4 attempts in the topic — one lucky answer is not mastery.

These bands are an in-app learning indicator to guide practice. They are **not** a standardised score and say nothing about performance in a real 11+ assessment. The app states this on screen wherever the figures appear.

---

## Project structure

```
index.html
vite.config.ts                 base path for GitHub Pages
scripts/
  validate-questions.ts        question-bank validator
  smoke-test.ts                engine tests
src/
  types.ts                     Question, Progress, SessionConfig …
  data/
    maths.json                 the question banks
    english.json
    verbal-reasoning.json
    passages.json              comprehension passages
    subjects.ts                subject registry
    shuffle.ts                 deterministic option shuffling
    techniqueCards.ts          exam-technique tips
    index.ts                   loads and indexes the bank
  logic/
    questionSelector.ts        which questions to serve, and when they are due
    session.ts                 quiz + learning-loop state machine
    sessionStorage.ts          saving and resuming an unfinished session
    mastery.ts                 topic and subject mastery
    progress.ts                attempts, streaks, mistakes
    storage.ts                 localStorage with safe fallbacks
    backup.ts                  progress export and restore
  components/                  React UI
.github/workflows/deploy.yml   GitHub Pages deployment
```

See **[docs/question-format.md](docs/question-format.md)** for the question schema and instructions for adding more questions, **[ROADMAP.md](ROADMAP.md)** for planned improvements and known limitations, and **[sources.md](sources.md)** for the material consulted when designing the skill taxonomy.

### Adding a new subject

The app does not hard-code the three current subjects. To add Non-Verbal Reasoning, Problem Solving or Creative Comprehension:

1. Add `src/data/<subject>.json`
2. Import it in `src/data/index.ts`
3. Add an entry to `SUBJECTS` in `src/data/subjects.ts`
4. Add the id to `VALID_SUBJECTS` in `scripts/validate-questions.ts`

Nothing else needs to change.

---

## Accessibility

- Full keyboard navigation; press **1–4** to choose an answer and **Enter** to continue
- Minimum 44px touch targets throughout
- Correctness is shown with a tick/cross **and** text, never by colour alone
- `aria-live` announcements on feedback, labelled progress bars, visible focus rings
- Respects `prefers-reduced-motion`
- No horizontal scrolling at any width from 320px upwards

## Privacy

Everything stays on the device. There is no account, no analytics, no network request after the page loads. The parent view can delete all stored progress at any time.

Progress can be **downloaded as a JSON file** and restored on another device. That file is produced entirely in the browser and is never uploaded anywhere — it goes wherever you choose to put it, and nowhere else.
