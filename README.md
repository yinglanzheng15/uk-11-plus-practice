# 11+ Practice

A quick, repeatable revision app for UK 11+ entrance-exam preparation in **Maths**, **English** and **Verbal Reasoning**, aimed at Year 5 / Year 6 pupils (roughly ages 9–11).

It runs entirely in the browser as a static site. No backend, no database, no login, no API keys, no paid services. All progress is stored in `localStorage` on the child's own device.

> The questions are original, written in the style of UK 11+ familiarisation material. This app is **not** affiliated with or endorsed by any school, consortium or examination board, and it does not reproduce any real exam paper.

---

## Status (handoff summary)

**Working state:** feature-complete and passing all checks. `npm run validate`, `npm test` (184 checks) and `npm run build` are all green as of the latest commit. No known bugs.

> **Picking this up mid-stream (11 Aug 2026):** the app is being turned into a paid product.
> The free/paid seam is in place but **deliberately not closed** — the build still ships the
> whole bank to everyone, so nothing has changed for existing users. Read
> **[docs/commercialisation.md](docs/commercialisation.md)** first; it has the plan, what is
> done, and what to do next in order. `ROADMAP.md` §8 has the data and structure findings
> from the same day's repo scan.

**What's built:**
- Full quiz engine with the wrong-answer learning loop, mastery tracking, streaks, and all revision modes (Quick 5/10/20, subject/topic practice, mixed, mistakes, weak areas, challenge, timed sessions, and a **full timed paper** per subject with a section-by-section breakdown).
- **450 questions, each with five options A–E** (208 Maths, 96 English, 134 Verbal Reasoning, 12 Non-Verbal Reasoning) across 8 comprehension passages — 126 of them expanded from 12 *templates* (see below), the rest hand-written — every topic has at least 4 questions, and every subject has both Foundation (difficulty 1) and Stretch (difficulty 4) coverage. The 12 Non-Verbal Reasoning questions are a **taster** of a new visual (inline-SVG) subject — see `docs/latymer-alignment.md`.
- **Two-layer question vetting**: `npm run validate` catches structural issues and machine-verifies maths answers via an optional `verify` expression; `npm run review` generates `docs/review-sheet.md` for human read-through, with `npm run review:accept` to avoid re-reviewing.
- **Skip for now.** A question can be parked and comes back at the end of the run for a second look. A skip records nothing and never counts against the score.
- **Resume after a refresh.** An unfinished session is saved as you go and offered back — *"Carry on where you left off?"* — for up to 24 hours. A timed session keeps the time it had left rather than burning it while the tab was shut.
- **Spaced repetition.** A question answered correctly comes back after 1 day, then 3, then 7, then 21. A mistake resets it to the start of the ladder.
- **Adjustable timing.** A grown-up sets the pace of timed sessions in the Parent tab — from Gentle (90s a question) to Exam pace (37s, roughly Dame Alice Owen's verbal reasoning paper). The clock stops while an explanation is on screen, so reading the feedback never costs exam time.
- **Parent view** with Progress and Feedback tabs, plus **download and restore of progress** as a JSON file — the way to move a child's history to a new device, or to survive a cleared browser.
- **Live at [yinglanzheng15.github.io/uk-11-plus-practice](https://yinglanzheng15.github.io/uk-11-plus-practice/)**, redeployed by GitHub Actions on every push to `main`.

**Repo:** [github.com/yinglanzheng15/uk-11-plus-practice](https://github.com/yinglanzheng15/uk-11-plus-practice) — public, pushed and up to date.

**Not yet done / deliberately deferred:**
- **434 of the 450 questions have had a human read-through** (`docs/.review-seen`). The outstanding 16 are the new GL-style error-spotting spelling and punctuation questions — run `npm run review`, read them in `docs/review-sheet.md`, then `npm run review:accept`.
- **Question bank is at 450/850+** of the original stretch target. See `ROADMAP.md`.
- No multi-child profiles yet. **Non-Verbal Reasoning now has a 12-question taster** (odd-one-out, sequences, figure pairs) proving the inline-SVG format; growing it into a full section, plus a Problem-Solving section, are scoped in `ROADMAP.md`.
- **The Latymer / GL familiarisation papers** (added under `data/past papers/`) were analysed in `docs/latymer-alignment.md`, which lists the specific Maths/English/VR question types still worth adding. Those PDFs are © GL Assessment — do **not** commit them to the public repo.

**Where to pick this up:** `docs/commercialisation.md` for the paid-product work. `ROADMAP.md` has the full prioritised list, with the data and structure debt in §8. `docs/question-format.md` covers adding questions. `docs/review-sheet.md` is generated and **gitignored** — it is the whole bank with answers, so it stays local; run `npm run review` after any bank change.

---

## Next steps

Prioritised, grounded in the real GL/Latymer familiarisation papers. The content specifics are in [`docs/latymer-alignment.md`](docs/latymer-alignment.md). Suggested order: Maths numeric batch → VR batch → NVR expansion → multi-child profiles.

**Done since this list was written:** the English "No mistake" spelling and punctuation gap (16 questions), and Full-paper mode with the per-section breakdown.

**1. Close the remaining content-fidelity gaps** (highest value, fits the existing engine)
- **Maths missing types** — coordinates, Roman numerals, timetable/time-interval reading, function machines / simple algebra (~20 Q). All numeric and all template-shaped: write four templates in `src/data/templates.ts` rather than twenty objects, and the `verify` expressions come out of them for free. *Do this first.*
- **VR missing types** — "word with two meanings" (homographs) and "insert a letter that ends one word and starts the next" (~12 Q). Hand-written: the answer turns on the words, not on a number that can be varied.

**2. Sharpen full-paper mode**
- **The clock still stops while an explanation is on screen.** Right in practice, wrong in a paper — the real one keeps running. A paper should either run the clock through the feedback screen or skip the feedback screen entirely.
- **The papers are single-subject.** The real sitting is several booklets in a morning; a combined paper is the next step up.

**3. Grow NVR from taster to full section**
- Add rotation, reflection, matrix/grid completion (2×2 and 3×3), hidden shape, and cube nets.
- First build a reusable SVG shape library (`src/data/nvrShapes.ts`) so questions compose helpers instead of hand-drawn SVG.

**4. Product / UX**
- **Multi-child profiles** — the main structural gap; a family currently shares one localStorage history.
- A **printable revisit sheet** from the end-of-session review data.
- A home-screen picker mirroring the six real GL booklets.

**5. Quality & vetting (ongoing)**
- The 16 new error-spotting questions still need the human read-through (`npm run review` → read → `npm run review:accept`). The other 434 are done.
- Spot-check that topic *coverage* reflects the papers' actual weighting (comprehension and VR letter/number types are heavily represented). Maths is now the largest subject at 208 questions, roughly half of them template-generated — worth watching that the hand-written half still carries the harder multi-step reasoning.

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
| `npm run generate` | Expand `src/data/templates.ts` into `src/data/generated.json` |
| `npm run split` | Split the bank into `src/data/free.json` and `public/paid.json` |
| `npm run validate` | Check the question bank for errors and quality warnings |
| `npm run review` | Write `docs/review-sheet.md` for human vetting of questions |
| `npm run review:accept` | Mark the current questions as reviewed |
| `npm test` | Run the engine test suite (184 checks) |
| `npm run typecheck` | TypeScript check, no build |
| `npm run build` | Generate → split → validate → typecheck → build to `dist/` |
| `npm run preview` | Serve the production build locally |

`npm run build` runs the validator first, so a broken question bank cannot be deployed.

### The free / paid split

The client bundles only the free half of the bank (`src/data/free.json`, 99 questions —
three per topic, easiest first, per `src/data/access.ts`). The rest is fetched at runtime by
`loadPaidQuestions()` in `src/data/index.ts`, which `src/main.tsx` awaits before the first
render, so the rest of the app still sees one plain synchronous `QUESTIONS` array.

**This is the seam, not a paywall.** The build writes the paid half to `public/paid.json`,
so the deployed app is still the whole bank, free to everyone, exactly as before. Closing it
takes two changes: point `VITE_PAID_BANK_URL` at an authenticated endpoint, and stop
emitting `PUBLIC_PAID` in `scripts/split-bank.ts`.

Both outputs are generated and gitignored, as is `docs/review-sheet.md` — it is the entire
bank *with answers*, so it is kept local rather than published.

### Question vetting

Questions go through two layers before they count as done:

1. **`npm run validate`** — structure, duplicates, UK English, and *machine-verified arithmetic*: a maths question can carry a `verify` expression that the validator evaluates and checks against the marked answer, so the sums are proved rather than trusted.
2. **`npm run review`** — generates a readable sheet of every question, in the order the child sees them, for a person to check the things automation cannot judge: ambiguity, arguable distractors, and whether an explanation actually teaches.

### Growing the bank with templates

`src/data/templates.ts` holds *parameterised* questions: one style, plus the numbers it varies over. `npm run generate` expands each into a dozen concrete questions with computed distractors and a computed `verify` expression, writes them to `src/data/generated.json`, and the usual two layers of vetting then apply. Seeds are derived from the template id, so output is reproducible and ids are stable.

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
| **Subject practice** | Pick a subject, then a specific topic |
| **Mixed practice** | Every chosen subject, interleaved |
| **My mistakes** | Only questions previously answered incorrectly |
| **Weak areas** | Automatically targets topics below 70% mastery |
| **Challenge** | Prioritises difficulty 3–4 questions |
| **Full paper** | A whole subject paper in one sitting, timed like the real booklet |

### Full paper

The other modes ask *what should I practise?*. This one asks the question a parent actually has — **can my child hold it together for fifty minutes?** — which is a different skill from getting questions right, and one a ten-question run cannot rehearse.

Maths (50 questions), English (54) and Verbal Reasoning (80) each have a paper, all timed at 50 minutes, matching the GL familiarisation papers described in `docs/latymer-alignment.md`. Each is built section by section to a fixed quota — a run of 50 that happens to contain no geometry is not a maths paper, however well the questions were chosen — and the sections are never interleaved. Within a section, the ordinary rules still apply: spaced repetition, the difficulty ceiling, avoiding recently served questions.

**A paper runs straight through.** No learning loop, no technique cards: up to two extra questions per mistake would turn a 50-question paper into a 150-question one, and sitting it unaided is the thing being rehearsed. The teaching is not lost — the end-of-session review still carries the full explanation for every question got wrong.

The summary reports **section by section** ("Spelling 7/12"), including sections the child never reached, which is how a real paper reports back and what tells a parent where the next fortnight should go. These are raw marks, deliberately **not** a scaled or standardised score: a real 11+ scaled score is worked out against how everyone else sitting that paper did, which this app cannot know and should not pretend to.

Non-Verbal Reasoning has no paper — 12 questions is a taster, not a section. `PAPERS` in `src/logic/papers.ts` is keyed by subject, so adding one is a single entry.

**Choose what to practise** on the home screen narrows the Quick 5/10/20 and Mixed sessions to any combination of subjects, and to particular topics within them — Maths and English but not the reasoning papers, say, or fractions and geometry alone. The panel shows how many questions the current selection leaves, and warns when that is too few for a full session. The choice is remembered between visits. *My mistakes* and *Weak areas* deliberately ignore it: those are scoped by what the child has actually answered, and quietly filtering them would hide questions they got wrong.

Any session can optionally be timed. **The pace is set by a grown-up in the Parent tab** — Gentle (90s a question), Steady (60s), Standard (45s, the default), Exam pace (37s) or Fast (30s). Exam pace is roughly that of Dame Alice Owen's verbal reasoning paper, 80 questions in 50 minutes. Timings differ between schools and change from year to year, so check the school's own admissions material for the year being sat. The timer never fails the child — when it expires, the session ends gracefully and shows results for the questions reached.

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
  generate-questions.ts        expands templates into generated.json
  split-bank.ts                splits the bank into free.json + public/paid.json
  validate-questions.ts        question-bank validator
  review-sheet.ts              writes docs/review-sheet.md for human vetting
  smoke-test.ts                engine tests
public/
  paid.json                    generated, gitignored — fetched at runtime
src/
  types.ts                     Question, Progress, SessionConfig …
  data/
    maths.json                 the authored question banks
    english.json
    verbal-reasoning.json
    non-verbal-reasoning.json
    templates.ts               parameterised question styles
    generated.json             expanded from templates — do not hand-edit
    free.json                  generated, gitignored — the bundled free half
    access.ts                  the free/paid split rule
    passages.json              comprehension passages
    subjects.ts                subject registry
    shuffle.ts                 deterministic option shuffling
    techniqueCards.ts          exam-technique tips
    index.ts                   loads and indexes the bank
  logic/
    questionSelector.ts        which questions to serve, and when they are due
    papers.ts                  full-paper structure: sections, quotas, timings
    session.ts                 quiz + learning-loop state machine
    sessionStorage.ts          saving and resuming an unfinished session
    mastery.ts                 topic and subject mastery
    progress.ts                attempts, streaks, mistakes
    storage.ts                 localStorage with safe fallbacks
    backup.ts                  progress export and restore
  components/                  React UI
.github/workflows/deploy.yml   GitHub Pages deployment
```

See **[docs/question-format.md](docs/question-format.md)** for the question schema and instructions for adding more questions, **[ROADMAP.md](ROADMAP.md)** for planned improvements and known limitations, **[docs/commercialisation.md](docs/commercialisation.md)** for the paid-product plan, and **[sources.md](sources.md)** for the material consulted when designing the skill taxonomy.

### Adding a new subject

The app does not hard-code the three current subjects. To add Non-Verbal Reasoning, Problem Solving or Creative Comprehension:

1. Add `src/data/<subject>.json`
2. Import it in `scripts/split-bank.ts` — that is what feeds both halves of the bank now
3. Add an entry to `SUBJECTS` in `src/data/subjects.ts`
4. Add the id to `VALID_SUBJECTS` in `scripts/validate-questions.ts`

Nothing else needs to change. `src/data/index.ts` imports only the generated `free.json`, so
it does not need touching for a new subject — the validator picks up any `.json` in
`src/data/` automatically.

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
