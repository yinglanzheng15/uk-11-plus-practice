# Improvements and next steps

Ordered roughly by value for the child per unit of effort. Nothing here is required — the app is complete and usable as it stands.

---

## 1. Expand the question bank

**The single highest-value change.** Everything else is polish by comparison.

There are currently **82 questions**. A child doing a Quick 10 most days will start seeing repeats within about a week. The anti-repetition logic remembers the last 60 questions served, so once the bank is smaller than that the "avoid recent" rule has to relax constantly.

### Current coverage

| | Total | Weakest topics (question count) |
| --- | --- | --- |
| **Maths** | 32 | Factors and multiples (2), Order of operations (2), Negative numbers (2), Decimals (2), Ratio and proportion (2), Measurement (2), Data handling (2) |
| **English** | 20 | Punctuation (2), Vocabulary (3), Spelling (4) |
| **Verbal Reasoning** | 30 | Antonyms (2), Letter sequences (2), Codes (2), Hidden words (2), Word relationships (2), Number/letter relationships (2), Logical reasoning (2), Word sequences (2) |

### Two specific gaps worth fixing first

**a) Almost no Foundation-level questions.** Difficulty 1 is barely represented: 3 in Maths, 1 in English, **none at all** in Verbal Reasoning.

This matters more than it sounds. The difficulty ceiling starts at 3 for an untouched topic and drops to 2 when a topic is going badly — but if there are no easy questions to drop to, a struggling child gets no gentler on-ramp. The learning loop also prefers an *easier* question after a mistake, and often can't find one.

**Aim for roughly 20% of each subject at difficulty 1.**

**b) Only two comprehension passages.** Six English questions share them. A child will memorise both passages within a fortnight, after which those questions test recall rather than comprehension. **Aim for 8–10 passages**, 4–6 questions each.

### Suggested targets

| Stage | Maths | English | VR | Total | Roughly |
| --- | --- | --- | --- | --- | --- |
| Now | 32 | 20 | 30 | 82 | ~1 week of variety |
| Next | 100 | 80 | 100 | 280 | ~1 month |
| Full | 300 | 250 | 300 | 850+ | a full year |

Add them in batches by topic rather than scattering — it is easier to keep quality and difficulty consistent that way. See `docs/question-format.md`. The validator catches structural mistakes, and `npm run validate` should be run after every batch.

**Quality matters more than the number.** Ten well-written questions with realistic distractors and genuinely instructive explanations beat a hundred padded variations.

---

## 2. Getting it online

Right now the app only runs on this laptop while `npm run dev` is going. Three routes, cheapest first.

### a) On a tablet or phone today, no hosting needed

If the device is on the same wi-fi as this laptop:

```bash
npm run dev -- --host
```

Vite then prints a **Network** address such as `http://192.168.1.42:5173/uk-11-plus-practice/`. Open that on the tablet.

Costs nothing and takes ten seconds. The catch: the laptop must be on and running the server, and it only works at home. Good for trying it out on the sofa; not good as the everyday setup.

### b) GitHub Pages — free, but the repo must be public

Already fully configured; blocked only because the repository is private and Pages needs a paid plan for private repos.

```bash
gh repo edit yinglanzheng15/uk-11-plus-practice --visibility public
```

Then uncomment the `push:` trigger in `.github/workflows/deploy.yml` and set **Settings → Pages → Source: GitHub Actions**. Live at `https://yinglanzheng15.github.io/uk-11-plus-practice/` within a couple of minutes, updating on every push.

There is nothing sensitive in the repository — no keys, and no progress data, which never leaves the browser.

### c) Keep the repo private and still host it free

**Cloudflare Pages**, **Netlify** and **Vercel** all deploy from a *private* GitHub repo on their free tiers. Connect the repo, set build command `npm run build` and output directory `dist`, and it deploys on push like the GitHub workflow does.

One change is needed: these hosts serve from the domain root, so set `base: '/'` in `vite.config.ts`.

This is probably the best option if you want it private **and** online.

### Worth knowing either way

Once hosted, the URL is public to anyone who has it. That is fine here — there is no login, no personal data, and no way to identify a user. Progress stays in each browser, so the child's results are visible only on their own device.

---

## 3. Resume a session after a refresh

**Known limitation.** Individual answers are saved as they happen, so nothing is lost from mastery or streaks. But the *session itself* lives only in memory — refresh or close the tab mid-quiz and you return to the home screen rather than question 7 of 20.

For a 20-question timed session that is genuinely annoying. Fix: persist the session state to `localStorage` on each transition and offer "Carry on where you left off?" on load. Moderate effort, contained in `src/App.tsx` and `src/logic/session.ts`.

---

## 4. Space out revision over time

The selector currently favours questions that were answered wrong or not seen recently, with a mild bonus as time passes. It does not schedule deliberate revisit intervals.

Proper spaced repetition — revisit a correctly-answered question after 1 day, then 3, then 7, then 21 — is well matched to the app's stated goal of *retention over volume*, and the data needed (`lastSeen`, `lastCorrect`, `attempts`) is already stored. Contained almost entirely in `src/logic/questionSelector.ts`.

---

## 5. Smaller improvements

- **Run the smoke test in CI.** The workflow validates and builds, but `scripts/smoke-test.ts` isn't run. One line in `deploy.yml` would catch engine regressions before deployment.
- **Export and import progress.** Since everything is local, a lost browser profile or a new device means starting from zero. A "download my progress" / "restore" pair of buttons in the parent view would fix that, and would also make moving from laptop to tablet painless.
- **More than one child.** One browser currently means one child. A simple profile picker would let siblings share a device.
- **Per-question timing.** `elapsedMs` is already recorded but unused. The parent view could show which topics take longest — often more revealing than accuracy alone.
- **A "why was I wrong?" review list.** Mistakes can be reviewed right after a session, but there is no way to revisit last week's explanations without re-answering.
- **Offline use (PWA).** A service worker would let the app run with no connection at all — useful on a tablet in the car or on a train. The app is already fully self-contained, so this is mostly configuration.
- **Sound and animation are absent by design.** If the child finds it dry, a small correct/incorrect chime (with a mute setting) would be the least distracting addition.

---

## 6. New sections

The architecture already supports extra subjects — a JSON file, an import, and a registry entry, as described in the README. The London 11+ Consortium format also includes:

- **Non-Verbal Reasoning** — the significant one, and the hardest to add: it needs shapes and patterns, so questions would need inline SVG rather than text. Worth designing an `svg` field on the question model before starting.
- **Problem solving** — largely multi-step reasoning; fits the existing text-based model with no changes.
- **Creative comprehension** — open-ended writing, which does not fit multiple choice at all. Would need a different answer type and, realistically, a parent to mark it.

Problem solving is the natural next section. NVR is the most valuable but the most work.

---

## 7. Deliberately not recommended

- **Adding an AI question generator.** A curated bank with hand-written explanations and realistic distractors is more reliable than generated questions, and generation would reintroduce the API keys, costs and network dependency the app was specified to avoid.
- **Accounts, leaderboards or cloud sync.** Local-only storage is a feature here, not a limitation.
- **More gamification.** Points, badges and streak pressure tend to shift motivation away from learning. The current light touch is the right level.
