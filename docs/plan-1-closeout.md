# Plan 1 (Foundation) closeout — 2026-07-30

All 10 tasks complete; final whole-branch review (8f3e871..69c0b6e) verdict: **With fixes**, 0 Critical. Fix wave landed as aa251b2 (brand favicon, TypeScript strict mode, ids.ts comment); scoped re-review clean. Suite 24/24 green under strict.

## Recorded deferral (explicit debt)

- **I3 — unbounded reviewLogs read:** `fetchDeckBundle` (src/lib/data.ts) fetches the deck's entire append-only reviewLogs history on every session open just to count today's new cards. Deferred to Plan 3 by ruling: spec section 9 blesses client-side log reads for v1, and Plan 3's stats work touches this exact query. Fix there with a `ts >=` study-day lower bound plus composite index (deckId + ts), or a per-day counter doc under users/{uid}. Do not let Plan 3 planning skip this.

## Deferred minors, routed

**Plan 2 pickups (review screen / study UX work):**
- persistReview is fire-and-forget with no `.catch`; add one with a quiet sync-failure indicator (offline cache makes it safe today, server rejection is silently unhandled).
- cardSchema does not require a cloze card's own `clozeIndex` to have a matching `{{cN::}}` marker in `text`; add a `superRefine` (silent bad-card risk, especially once Plan 4 generates siblings mechanically).
- Test batch: hard-hard-good scheduler regression case + the hypo-skipped-then-cheaper-fits queue path (about 5 lines each).
- Review.tsx load effect has no cancellation flag; rapid deck switches can display a stale deck's queue. Standard `let cancelled` cleanup.
- One-line comment in grade() noting re-entrancy is unreachable (React discrete-event flush + GradeBar unmount).

**Plan 4 pickups (deck pipeline / uploader):**
- deckSchema.description is plain `z.string()`, not the house-rule clean string. Must fix before the uploader parses decks with it. Use a no-em-dash/no-emoji refine WITHOUT `min(1)` (descriptions may be empty).

**CI / ops, whenever next touched:**
- firebase-tools is not a devDependency; `test:rules` and rules deploys rely on a global install. Fresh clone breaks.
- CI never runs the rules tests (spec section 10 says the multi-user boundary must never regress). Add a job with setup-java + `npm run test:rules`.
- deploy.yml has no concurrency group; add `concurrency: { group: deploy, cancel-in-progress: true }`.
- tests/rules.test.ts, scripts/seed.mts, vitest.rules.config.ts sit outside every tsconfig project (type errors surface only at runtime); widen an include so `tsc -b` covers them.

**Scheduler cosmetics (whenever scheduler.ts is next touched):** clampToEvents boundary comment, studyDay DST caveat note (theoretical: Philippines has no DST), label() rounding note, dead `as number` cast.

**On-device check:** sign-in is popup-only (src/lib/auth.tsx); popup OAuth inside an installed iOS PWA is historically unreliable and installed-app storage is isolated. When verifying Add to Home Screen, explicitly test Google sign-in inside the installed app; fall back to `signInWithRedirect` if it fails.

## Pending user ops (gates first green deploy)

Run in a terminal, in order:

```
gh auth login
npx firebase init hosting:github   # repo sites-9400/flashcards, workflow overwrite NO (keep ours), no PR workflow
gh variable set VITE_FB_API_KEY -R sites-9400/flashcards -b "AIzaSyDb8ACKIV6VRJ4zArCAdox02OYwD48hY_Q"
gh variable set VITE_FB_AUTH_DOMAIN -R sites-9400/flashcards -b "flashcards-be310.firebaseapp.com"
gh variable set VITE_FB_PROJECT_ID -R sites-9400/flashcards -b "flashcards-be310"
gh variable set VITE_FB_APP_ID -R sites-9400/flashcards -b "1:30911096236:web:961df37c7bcde9d449c609"
```

Then re-run the failed GitHub Actions deploy (push or "Re-run all jobs"), verify live-URL Google sign-in, and do the phone Add to Home Screen check (see popup-OAuth note above).

## Next plans (write from docs/spec.md via superpowers:writing-plans)

- **Plan 2:** mcq/hypo UIs + ALAC checklist + gradeAnswer Cloud Function (Haiku; Firebase secret ANTHROPIC_API_KEY). Include the Plan 2 pickups above.
- **Plan 3:** events/prep/stats. Include the I3 reviewLogs fix.
- **Plan 4:** make-deck pipeline in the Law School workspace + publishing. Include the deckSchema clean fix.
