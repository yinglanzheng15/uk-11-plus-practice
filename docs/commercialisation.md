# Turning this into a business

Working notes for making the app a paid product. Written 11 August 2026, on the day the
free/paid seam went in. This is the pick-up-here document — start at **Where this stands**.

The model chosen: a **parent subscription** (~£5–10/mo) with **parent-only accounts**. A
parent signs up with their own email; children are named profiles under that account, with
no child logins and no child personal data. Free tier stays genuinely useful rather than a
teaser.

> **This reverses `ROADMAP.md` §7**, which ruled out accounts and cloud sync. That was the
> right call for a free local-only tool. Taking money changes it, and §7 has been amended
> rather than left to contradict this file.

---

## Where this stands

**Done:**

- **`docs/review-sheet.md` is out of the public repo** (untracked and gitignored). It is the
  entire bank *with answers* — it was the single largest content leak. Still generated
  locally by `npm run review`, unchanged.
- **The free/paid seam is in.** The client bundles only `src/data/free.json` (99 questions,
  three per topic, easiest first — the rule lives in `src/data/access.ts`). The rest is
  fetched at runtime by `loadPaidQuestions()` in `src/data/index.ts`, awaited by
  `src/main.tsx` before the first render, so every other consumer still sees one plain
  synchronous `QUESTIONS` array. `scripts/split-bank.ts` emits both halves at build time.
  9 new smoke-test checks cover the split.
- **Progress writes are batched** (`SAVE_DEBOUNCE_MS` in `src/logic/storage.ts`). Every answer
  produced a new `Progress` object and serialised the child's *entire* history, so a 20-question
  session meant 20 full-blob writes. They now collapse into one write every 2s, flushed on
  `pagehide` and on `visibilitychange`. Locally this bought nothing measurable — it was done
  ahead of step 3, where that same call becomes a network round trip and 20 writes a session
  per child turns into real cost and real conflict surface. `clearProgress()` cancels any
  queued write, so a reset cannot be undone by a save landing after it. 8 checks cover it.

**Deliberately still open:** the build writes the paid half to `public/paid.json`, so the
deployed app is still the whole 434-question bank, free to everyone, exactly as before. It is
the seam, not the paywall — no existing user lost anything.

**Still leaking:** the authored banks (`src/data/maths.json` and friends) remain in the
public repo, so the paid content is readable there regardless of the split. Moving them to a
private repo is step 2 below and only you can make that call.

---

## What to do next, in order

Each step is independently shippable, and the early ones are reversible.

### 1. Hosting and domain — half a day, no product change

GitHub Pages cannot serve authenticated content or a webhook, so it has to go before
anything else can land. Cloudflare Pages, Netlify and Vercel are all free at this scale and
deploy from the same repo.

- Set `base` in `vite.config.ts` back to `'/'` (README §*If you rename the repository*
  already flags this as the one line).
- Buy a real domain. A `github.io` URL will cost conversions from parents deciding whether
  to trust you with a card.
- Keep the existing workflow's `npm test && npm run build` gate.

### 2. Move the authored banks to a private repo

`src/data/*.json` are the product. Options, cheapest first:

- Private repo pulled in as a git submodule or an npm dependency at build time.
- Or keep one private repo for everything and publish only `dist/`.

`scripts/split-bank.ts` and `scripts/validate-questions.ts` do not care where the JSON comes
from — only the import paths change.

### 3. Supabase — auth and progress sync, still free for everyone

Ship this *before* payments. The product genuinely improves (sync, multi-child), there is no
payment risk, and you learn whether anyone signs up at all.

- **Auth: email magic link.** No passwords to store, reset or leak. Parent email is then the
  only personal data you hold.
- **Schema:**
  - `parents` — id from auth, plus the comp columns in step 4
  - `children` — id, parent_id, display name only (a first name or nickname; never a full
    name, DOB or school)
  - `progress` — child_id, and a JSONB blob that is *exactly* today's `Progress` type
  - `subscriptions` — parent_id, stripe ids, status, current_period_end
- **Row-level security so a parent can only read their own rows.** This is the whole
  authorization model, and it is the reason to use Supabase rather than hand-rolling a server.
- **Reuse what exists.** `SCHEMA_VERSION` and `migrate()` in `src/logic/storage.ts` already
  version and forward-migrate the blob — store the identical JSON server-side and keep
  `migrate()` as the single upgrade path. Do **not** normalise progress into relational
  tables: it is small, always read and written whole, and the migration code already works.
- `src/logic/storage.ts` gains remote read/write behind the *same* `loadProgress` /
  `saveProgress` signatures, with today's `localStorage` path as the offline fallback and
  last-write-wins on conflict. Every caller in `App.tsx` stays as-is. **The batching is
  already in place** — put the network write inside `flushProgress()`, not `saveProgress()`,
  and the round trips stay batched for free. Raise `SAVE_DEBOUNCE_MS` if the server write
  turns out slow; the flush-on-`pagehide` is what keeps that safe.
- Child switcher hangs off the existing tab structure in `src/components/ParentView.tsx`, and
  `src/logic/backup.ts` already knows how to export/import a whole profile — which is most of
  what "add a child" and "move a child" need.

### 4. Stripe — and close the gate

- **Stripe Checkout** (hosted page) + **Stripe Customer Portal** (hosted cancel/update).
  Between them you write no payment UI, handle no cards, and stay out of PCI scope.
- Enable **Stripe Tax**. UK VAT registration only bites above £90k, but digital services sold
  into the EU have no threshold.
- One webhook (a Supabase edge function) writes subscription status. **Verify the Stripe
  signature** — this is a trust boundary.
- **Closing the gate is two changes:** point `VITE_PAID_BANK_URL` at the authenticated
  endpoint, and stop writing `PUBLIC_PAID` in `scripts/split-bank.ts`.

**Comped accounts (friends, testers, your own use).** One nullable column on `parents`:

```sql
comped_until  timestamptz   -- non-null and in the future = full access, no Stripe needed
comped_reason text          -- 'friend' | 'test' | 'beta-2026' — so future-you knows why
```

Access is then a single server-side check:

```
has_access = comped_until > now() OR subscription.status IN ('active','trialing')
```

Grant one by setting the column in the Supabase dashboard. No admin UI, no invite codes, no
promo-code plumbing. A date rather than a boolean so tester grants expire on their own
instead of quietly becoming lifetime freebies; use a far-future date for the few people who
really should keep access forever.

Two things to get right, because they are the usual bugs in this pattern:

- **The check must live server-side only** — in the edge function that serves paid questions
  and in the RLS policy. A client-side `isComped` flag is a variable an inspector can flip,
  and it would defeat the whole gate.
- **Never let a comped account reach Stripe Checkout.** Show "You have full access" in the
  Parent view instead of an upgrade button, or you will eventually charge a friend.

<!-- ponytail: one column + a server-side check. Move to a real entitlements table only if
     you ever need per-feature grants or partial tiers. -->

### 5. What actually makes it worth renewing

A subscription needs a reason to still be there next month. From `ROADMAP.md`, in order of
commercial value:

1. **Full-paper timed mode** with a per-section breakdown and a score. This is the thing
   parents actually buy — *"is my child ready?"* — and it is already scoped.
2. **Multi-child profiles.** Falls out of step 3 and doubles the value to a two-child family.
3. **The English "No mistake" gap** — `docs/latymer-alignment.md` calls it the biggest
   fidelity gap against the real GL papers, ~16 questions.
4. **A weekly parent email**: what your child practised, what they are strong at, what to
   work on. Cheap to build on the existing `Progress` blob, and the single best retention
   mechanic for a parent-paid product — it makes the subscription visible.

Everything else (PWA offline, printable revisit sheets, NVR expansion) is nice, later.

---

## Legal and compliance

Not optional, and cheap if done early.

- **Business entity.** Sole trader is fine to start. A limited company is worth it once
  revenue is real, mostly for liability separation.
- **ICO registration.** Once you process personal data as a business you must register
  (~£52/yr for a small organisation). Small, mandatory, easy to forget.
- **Privacy policy + terms of service.** Must exist before you take a payment. Say plainly:
  parent email only, no child personal data, no ads, no third-party tracking, deletion on
  request. That is a genuinely strong story for this audience — sell it rather than bury it.
- **UK Age Appropriate Design Code.** Applies to services likely to be accessed by children.
  Parent-only accounts, no ad profiling, no nudge-to-share, no dark patterns, high privacy by
  default — the app already complies with the spirit of nearly all of it. Write that down.
- **Consumer Contracts Regulations.** UK consumers get a 14-day cancellation right on digital
  services. You need the standard *"I want access now and waive my cancellation right"*
  checkbox at checkout, or you owe refunds on demand for 14 days.
- **Add a LICENSE file.** There is none, so the public repo is all-rights-reserved but fully
  readable. Decide deliberately — the usual split for this shape of business is open code,
  closed question bank — and state it.
- **The GL Assessment PDFs.** `data/past papers/` is gitignored and must stay that way.
  ✅ **Verified 11 Aug 2026:** `git rev-list --all --objects` finds no PDF blob anywhere in
  history, across all refs. `sources.md`'s claim that no past-paper question was copied is
  intact — keep it accurate.
- **Finish the human read-through.** 278 of 434 questions have never been read by a person.
  Free users tolerate a wrong answer; paying parents of exam candidates do not, and one
  Mumsnet thread about a bad answer key is worse than a slow launch. See `ROADMAP.md` §8 for
  the specific data gaps found in the 11 Aug scan.

---

## Verification

- **After any bank change:** `npm run build` (generate → split → validate → typecheck →
  build) and `npm test` must both be green. The 147-check smoke test is the regression net.
- **After the gate closes:** confirm in a browser that a logged-out visitor sees 99 questions
  and a subscriber sees 434.
- **After sync:** sign in on two browsers, answer in one, confirm it appears in the other.
  Then go offline mid-session and confirm the `localStorage` fallback still records answers
  and reconciles on reconnect.
- **After Stripe:** test mode end to end — subscribe, confirm the webhook flips access on,
  cancel via the Customer Portal, confirm access drops at period end and *not* immediately.
  Then on a comped account with no Stripe customer at all: full access, no upgrade button,
  and access drops when `comped_until` is set to the past.
