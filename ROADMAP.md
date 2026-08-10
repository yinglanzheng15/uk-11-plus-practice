# Improvements and next steps

Ordered roughly by value for the child per unit of effort. Nothing here is required — the app is complete and usable as it stands.

---

## 1. Expand the question bank

**The single highest-value change.** Everything else is polish by comparison.

There are currently **296 questions** (112 Maths, 80 English, 104 VR) across 8 comprehension passages, **each with five options A–E** to match the papers these schools set. The anti-repetition logic remembers the last 60 questions served, so the bank is now comfortably above the point where that constraint has to keep relaxing.

### Done in the third pass (five options, 296)

- **Every question moved from four options to five**, matching the papers Latymer, QE Barnet and Dame Alice Owen's actually set. Each fifth option was written individually with a note on why it tempts; the validator now requires exactly five.
- **Eight new maths questions** in the style of a real sample paper: rearranging a volume or area formula, working backwards from a mean or a sale price, and — the pattern that was missing entirely — doing the sum in one unit and being asked for the answer in another.
- Two genuine content errors surfaced, both invisible to the old validator: a hidden-word question whose marked answer did not contain the hidden word, and a pair of maths questions with identical stems that differing options had masked. The validator now checks hidden words against every word boundary, so that class of error cannot recur.

### Done in the second expansion (156 → 288)

- Hit the **280 target** in the table below, with every subject at or above its figure.
- **Four new passages** — *The Sunflower Contest*, *Mooring at Dusk*, *The Birds That Almost Never Land* and *Why the Local Library Still Matters* — taking the total to 8. The last two are non-fiction and argument, which the bank previously had none of; the London consortium format uses both.
- **Difficulty 4 nearly doubled**, from 9 to 46 questions bank-wide. It remains the thinnest band and is still where new questions are most valuable.
- New maths questions carry a `verify` expression wherever the answer is a plain number, so their arithmetic is machine-proved.
- The letter sequences, codes and hidden words were additionally checked by script — every shift rule, alphabet position and word boundary was confirmed programmatically rather than by eye.

**Still outstanding: the human read-through.** `npm run validate` passes, but only the first 156 questions have been read by a person. Run `npm run review`, read `docs/review-sheet.md`, then `npm run review:accept`.

### Done in the first expansion (82 → 156)

- Every topic now has **at least 4 questions**, so topic practice and weak-area sessions no longer recycle immediately.
- **Foundation level fixed.** Difficulty 1 went from 4 questions bank-wide (and *none* in Verbal Reasoning) to a healthy share in all three subjects. This mattered more than the raw count: the difficulty ceiling drops when a child is struggling and the learning loop prefers an easier follow-up after a mistake — with no easy questions, neither had anywhere to go.
- **Two more passages** (`The Causeway`, `The New Girl`), each with 4–6 questions, and the existing thin passage topped up.
- **Vetting was built first** — see "Question vetting" in the README. Machine-verified arithmetic plus a generated review sheet.

### Remaining targets

| Stage | Maths | English | VR | Total | Roughly |
| --- | --- | --- | --- | --- | --- |
| ~~Start~~ | ~~32~~ | ~~20~~ | ~~30~~ | ~~82~~ | ~1 week of variety |
| ~~Then~~ | ~~63~~ | ~~41~~ | ~~52~~ | ~~156~~ | ~3 weeks |
| **Now** | **104** | **80** | **104** | **288** | ~1 month |
| Full | 300 | 250 | 300 | 850+ | a full year |

Still worth adding: more comprehension passages (8 now, **10–12** would be comfortable — passages are the fastest thing to memorise), and more difficulty-4 stretch questions, which remain the thinnest band despite nearly doubling.

Add them in batches by topic rather than scattering — it is easier to keep quality and difficulty consistent that way. See `docs/question-format.md`. The validator catches structural mistakes, and `npm run validate` should be run after every batch.

**Quality matters more than the number.** Ten well-written questions with realistic distractors and genuinely instructive explanations beat a hundred padded variations.

---

## 2. Getting it online — **done**

The app is live at **<https://yinglanzheng15.github.io/uk-11-plus-practice/>**.

The repository was made public and **Settings → Pages → Source** set to **GitHub Actions**; the `push:` trigger in `.github/workflows/deploy.yml` is now enabled, so every push to `main` republishes the site. The workflow runs `npm test` and `npm run validate` before building, so a failing test or a broken question bank stops the deploy instead of shipping it.

Nothing sensitive went public: the history was checked before the switch and contains only source files — no keys, and no progress data, which never leaves the browser.

### If you would rather it were private

Two alternatives, if the repository ever needs to go back to private:

- **GitHub Pro** — keeps the repository private and Pages working, as a paid plan.
- **Cloudflare Pages, Netlify or Vercel** — all deploy from a *private* GitHub repo on their free tiers. Connect the repo, set build command `npm run build` and output directory `dist`. One change is needed: these hosts serve from the domain root, so set `base: '/'` in `vite.config.ts`.

### On a tablet without any hosting

Still worth knowing. If the device is on the same wi-fi as the laptop:

```bash
npm run dev -- --host
```

Vite prints a **Network** address such as `http://192.168.1.42:5173/uk-11-plus-practice/`. Useful for trying an unreleased change on the sofa; the laptop has to stay on.

---

## 3. Resume a session after a refresh — **done**

Previously a refresh mid-quiz returned you to the home screen rather than question 7 of 20. Now `src/logic/sessionStorage.ts` snapshots the session on every transition and the home screen offers *"Carry on where you left off?"*.

Details worth knowing:

- Questions are stored as **ids** and rehydrated from the bank, so a snapshot cannot go stale against an edited question. If an id has vanished the snapshot is discarded rather than half-restored.
- A snapshot older than **24 hours** is not offered. Coming back the next morning is reasonable; coming back to last week's half-quiz is not.
- For a timed session the clock is **shifted, not restored** — a session saved with four minutes left resumes with four minutes left, rather than having burnt them while the tab was closed.
- Leaving is never destructive. "Stop this session" and the Home link both hand the session to the home screen's resume card rather than dropping it — half a Quick 20 is too much to lose to a mistapped link. Only starting something new clears it.

---

## 4. Space out revision over time — **done**

`src/logic/questionSelector.ts` now schedules revisits rather than merely preferring older questions. `QuestionRecord` gained a `streak` field (consecutive correct answers), and the interval ladder is `REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 21]`: right once means come back tomorrow, right four times running means come back in three weeks, and any mistake resets to due-immediately.

Two properties were worth preserving and are covered by tests:

- A question that is **not yet due** drops near the bottom of the ranking but stays in the pool, so a small bank or a narrow topic filter still fills a session.
- An **unseen** question still outranks an overdue one — scheduling must not crowd out new material.

Storage schema went to version 2. Profiles saved before this get `streak: 1` for anything last answered correctly, so they come round again tomorrow rather than all at once.

---

## 5. Smaller improvements

- ~~**Run the smoke test in CI.**~~ Done — `npm test` now runs in the workflow before the build.
- ~~**A "why was I wrong?" review list.**~~ Done in part — the session summary now shows the full working for every mistake and every question left unanswered: what was chosen and why it was tempting, the correct answer, the explanation and the learning point. Revisiting *last week's* explanations without re-answering is still not possible.
- ~~**Decline the practice question.**~~ Done — "Next question instead" sits beside "Try a practice question" after a mistake. The learning loop is the recommended path, not a compulsory one, and the end-of-session review carries the teaching for anyone who skips it.
- ~~**Skip a question.**~~ Done — **Skip for now** parks a question and re-offers it once the run reaches the end. A skip records nothing at all, and anything still unanswered is reported in the summary rather than counted as wrong. Skipping again on the second pass releases it, which is what guarantees the session terminates.
- ~~**Adjustable timing.**~~ Done — the Parent tab sets seconds per question for timed sessions (`src/logic/pace.ts`). The presets are anchored on a published paper where one could be verified. Schema went to version 3; older profiles and hand-edited backup files get the 45-second default rather than a zero limit.
- **Act on flagged questions.** The Feedback tab collects question reports with their ids; there is no script yet that takes an exported feedback file and lists the flagged questions alongside their bank entries. A small `npm run triage` would close that loop.
- ~~**Export and import progress.**~~ Done — the parent view has **Download progress** and **Restore from a file**. The file is plain JSON, produced in the browser and never uploaded. A restore is parsed and summarised (*"Saved on 10 August 2026: 412 questions answered across 38 sessions"*) before the parent confirms, because it replaces everything.
- **More than one child.** One browser currently means one child. A simple profile picker would let siblings share a device.
- **Per-question timing.** `elapsedMs` is already recorded but unused. The parent view could show which topics take longest — often more revealing than accuracy alone.
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
