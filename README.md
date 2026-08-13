# 11+ Practice

A revision app for UK 11+ entrance-exam preparation in **Maths**, **English**, **Verbal Reasoning** and a Non-Verbal Reasoning taster, for Year 5 / Year 6 pupils. Static site, no backend, no login; all progress lives in `localStorage` on the child's own device.

**Live:** <https://yinglanzheng15.github.io/uk-11-plus-practice/> — redeployed by GitHub Actions on every push to `main`.

> Questions are original, written in the style of UK 11+ familiarisation material. Not affiliated with any school, consortium or examination board, and no real exam paper is reproduced.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173/uk-11-plus-practice/
```

| Command | What it does |
| --- | --- |
| `npm run generate` | Expand `src/data/templates.ts` into `src/data/generated.json` |
| `npm run split` | Split the bank into `src/data/free.json` and `public/paid.json` |
| `npm run validate` | Check the question bank (structure + machine-verified maths) |
| `npm run review` / `review:accept` | Write `docs/review-sheet.md` for human vetting / mark as seen |
| `npm test` | Engine test suite (184 checks) |
| `npm run typecheck` / `build` / `preview` | TS check / full build to `dist/` / serve the build |

`build` and the deploy workflow both run the validator and tests first, so a broken bank cannot ship.

## Status

Feature-complete, all checks green. 450 questions across 4 subjects; 434 human-reviewed (the 16 outstanding are the new GL-style error-spotting questions).

**Pick it up here:** [`docs/commercialisation.md`](docs/commercialisation.md) for the paid-product work in progress — the free/paid seam exists but is deliberately open, so the deployed app still ships the whole bank to everyone. [`ROADMAP.md`](ROADMAP.md) has the prioritised next steps (§8 is the data/structure debt), and [`docs/latymer-alignment.md`](docs/latymer-alignment.md) lists the question types still worth adding. The GL PDFs under `data/past papers/` are © GL Assessment — do **not** commit them.

## Where things are

| Topic | Where |
| --- | --- |
| Question schema, adding questions | [`docs/question-format.md`](docs/question-format.md) |
| Templates (parameterised questions) | `src/data/templates.ts`, `scripts/generate-questions.ts` |
| Free/paid split rule and runtime fetch | `src/data/access.ts`, `scripts/split-bank.ts`, `src/data/index.ts` |
| Which question is served next, spaced repetition | `src/logic/questionSelector.ts` |
| Full-paper mode: sections, quotas, timings | `src/logic/papers.ts` |
| Quiz + learning-loop state machine | `src/logic/session.ts`, `sessionStorage.ts` |
| Mastery bands, progress, streaks | `src/logic/mastery.ts`, `progress.ts` |
| Progress export / restore | `src/logic/backup.ts` |
| Anonymous usage counts (GoatCounter) | `src/logic/analytics.ts` — empty `SITE` to switch off |
| Subject registry (adding a subject) | `src/data/subjects.ts` + `VALID_SUBJECTS` in `scripts/validate-questions.ts` |
| GitHub Pages base path (if the repo is renamed) | `base` in `vite.config.ts` |
| Deployment | `.github/workflows/deploy.yml` |
| Skill taxonomy sources | [`sources.md`](sources.md) |

## Design decisions worth knowing

- **Wrong answers teach.** A mistake gives the correct answer, why it is right, why each distractor is tempting, a *Remember* rule, and an optional related question — up to twice, then it moves on. Follow-ups never count against the session score. The end-of-session review repeats all of it for every question got wrong or left unanswered.
- **Skipping is exam technique.** A skipped question is parked and comes back at the end; it records nothing either way.
- **Full paper runs straight through** — no learning loop, and marks are raw, deliberately not a scaled score.
- **Mastery bands are an in-app indicator**, not a standardised score, and the app says so wherever they appear.
- **Privacy:** nothing leaves the browser except cookieless GoatCounter pageviews and two coarse events (mode, score band).
- **Accessibility:** full keyboard use (1–4 + Enter), 44px targets, never colour alone, `aria-live` feedback, respects `prefers-reduced-motion`, no horizontal scroll from 320px.
