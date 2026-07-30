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

## Ops: DONE 2026-07-30

gh auth (sites-9400), the four VITE_FB_* repo variables, and `firebase init hosting:github` (secret FIREBASE_SERVICE_ACCOUNT_FLASHCARDS_BE310) are all set. Two CI-environment fixes were needed for the first green deploy: workflow Node 20 -> 24 (undici markAsUncloneable crash) and vitest `env: { TZ: 'Asia/Manila' }` (studyDay tests assert Manila-local rollover; CI runs UTC).

**Live URL: https://flashcards-be310.web.app** (deploy green, site verified serving).

Still on the user: on the phone, verify Google sign-in on the live URL, Add to Home Screen, then sign-in INSIDE the installed app (see popup-OAuth note above). Optional: revoke the Firebase CLI GitHub OAuth app at https://github.com/settings/connections/applications/89cf50f02ac6aaed3484.

## Next plans (write from docs/spec.md via superpowers:writing-plans)

- **Plan 2:** mcq/hypo UIs + ALAC checklist + gradeAnswer Cloud Function (Haiku; Firebase secret ANTHROPIC_API_KEY). Include the Plan 2 pickups above.
- **Plan 3:** events/prep/stats. Include the I3 reviewLogs fix.
- **Plan 4:** make-deck pipeline in the Law School workspace + publishing. Include the deckSchema clean fix.
