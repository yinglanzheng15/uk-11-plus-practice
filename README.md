# 11+ Practice

A quick, repeatable revision app for UK 11+ entrance-exam preparation in **Maths**, **English** and **Verbal Reasoning**, aimed at Year 5 / Year 6 pupils (roughly ages 9–11).

It runs entirely in the browser as a static site. No backend, no database, no login, no API keys, no paid services. All progress is stored in `localStorage` on the child's own device.

> The questions are original, written in the style of UK 11+ familiarisation material. This app is **not** affiliated with or endorsed by any school, consortium or examination board, and it does not reproduce any real exam paper.

---

## What makes it different

Most quiz apps show the right answer and move on. This one doesn't.

When a question is answered incorrectly, the child gets:

1. **Not quite.** — clear, unambiguous, and never unkind
2. The correct answer, spelled out
3. **Why** that answer is correct
4. **Why the other answers are traps** — each distractor represents a realistic mistake
5. A short **Remember** rule
6. A **related follow-up question** they must get right before continuing

If the follow-up is also wrong, they get a second explanation and a second related question. After two attempts the app moves on with an encouraging message and flags the topic to revisit later — the child is never trapped.

Follow-up questions are recorded against topic mastery but **never count against the session score**, so engaging with the learning loop can only help.

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
| `npm test` | Run the engine test suite (47 checks) |
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

## Publishing to GitHub Pages (not enabled yet)

The code lives at <https://github.com/yinglanzheng15/uk-11-plus-practice>, currently **private**.

GitHub Pages is not available for a private repository on the free plan, so the deployment workflow is set to **manual-only** and does not run on push. Everything needed to publish is already in place and the build is known to pass in CI.

To go live later, pick one:

- **Make the repository public** — free. `gh repo edit yinglanzheng15/uk-11-plus-practice --visibility public`
- **Upgrade to GitHub Pro** — keeps the repository private.

Then:

1. In `.github/workflows/deploy.yml`, uncomment the `push:` trigger.
2. On GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. `git push` — or run the workflow manually from the **Actions** tab.

The site will then be at **https://yinglanzheng15.github.io/uk-11-plus-practice/**, updating on every push.

### If you rename the repository

The site is served from a sub-path, so Vite must know the repository name. It is set in `vite.config.ts`:

```ts
base: '/uk-11-plus-practice/',
```

Change that one line to match the new name — it must have a slash at each end. For a user site hosted at `https://yinglanzheng15.github.io/` (a repo named `yinglanzheng15.github.io`), use `base: '/'` instead.

A `public/.nojekyll` file is included so GitHub Pages serves Vite's hashed asset filenames correctly.

---

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

---

## How question selection works

Deterministic weighted scoring in `src/logic/questionSelector.ts` — no AI involved.

```
never seen           very high priority
answered incorrectly high priority
weak topic           bonus, scaled to how weak
answered right once  low priority
answered right often very low priority
```

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
    questionSelector.ts        which questions to serve
    session.ts                 quiz + learning-loop state machine
    mastery.ts                 topic and subject mastery
    progress.ts                attempts, streaks, mistakes
    storage.ts                 localStorage with safe fallbacks
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
