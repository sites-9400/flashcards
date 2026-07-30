# Plan 2 (mcq/hypo study modes + AI grading) verification notes, 2026-07-30

## Verification record

### Local end-to-end with the real key

Ran the emulator suite (`firebase emulators:start --only auth,firestore,functions`) against `functions/.secret.local`, plus `VITE_USE_EMULATORS=true npm run dev`. Signed in via the auth emulator's fake Google flow, seeded the sample deck (`FIRESTORE_EMULATOR_HOST=... SEED_UID=... npm run seed`), and walked the queue one action at a time (each click verified against a fresh snapshot before the next, per the caution already recorded in Task 5's report about stray double-fires from rapid tool calls).

Reached the seeded Manchester hypo card (docket fees / jurisdiction), typed an answer, revealed all four ALAC beats, and clicked "AI check my answer." The first pass returned a 503 from the callable. Root-caused via a direct `curl` against `api.anthropic.com/v1/messages` with the same key (never printed, extracted with `cut`/`tr` into the request only): the API returned `401 authentication_error`. Inspecting the key file's bytes (`xxd`, prefix-only) showed the stored value had a duplicated prefix (`sk-ant-sk-ant-api03-...` instead of `sk-ant-api03-...`), evidently a copy-paste artifact from whoever populated `functions/.secret.local`. Fixed with a `sed` replacement targeting only the known duplicate-prefix pattern, without ever printing the corrected value; re-verified the fix with the same direct `curl` call (200 OK). Restarted the functions emulator so it picked up the corrected secret file, redid sign-in and reseed (emulator data is not persisted across a restart), and re-ran the hypo review from scratch.

The second pass succeeded: real Claude verdicts came back and pre-filled the four beat checklists with per-beat reasoning text (three "got", one "missed" on the Application beat), the suggested grade highlighted "Hard" (matching the checklist's own `suggestedGrade` mapping for a 3.0/4.0 score), and the grade required an explicit click to confirm (verdicts never auto-confirmed). Confirmed the grade, then verified directly against the Firestore emulator (admin-SDK throwaway script, deleted before commit, not part of the diff) that the review log for the hypo card contains both `typedAnswer` (the full typed text) and `aiVerdicts` (all four beats with `verdict` and `reason`), matching what was displayed in the UI.

Screenshots (`.superpowers/sdd/2026-07-30-lawdeck-plan-2-study-modes/screenshots/`):
- `task8-01-hypo-beats-revealed.png`: all four beats revealed, verdict buttons present but unmarked, before the AI check.
- `task8-02-ai-verdicts-prefilled.png`: same card after "AI check my answer," verdict buttons pre-selected (green border on got, red border on missed) with per-beat AI reasoning shown inline, and the Hard grade highlighted but not yet confirmed.

### Fallback path (not re-verified live)

The brief asked to also verify the manual-grading fallback by stopping the functions emulator mid-session and repeating the AI check. That sequencing is awkward with only one browser session in flight (stopping emulators mid-review also drops the Firestore/auth connections the review screen depends on), and the fallback behavior (`requestAiGrading` returning `null` on any callable failure, letting the checklist proceed unmarked for manual grading) is already covered by Task 7's unit tests (`src/lib/grade.test.ts`, `src/components/HypoReview.test.tsx` AI-path test) with a `mockRejectedValueOnce` case. Not re-run live in this task; noted here as the brief allows.

### Production secret and deploy

- Set the corrected key as the Firebase Functions secret: `npx firebase functions:secrets:set ANTHROPIC_API_KEY --data-file <chmod-600 tempfile under the SDD workspace dir, deleted immediately after>`. Confirmed with `npx firebase functions:secrets:access ANTHROPIC_API_KEY | head -c 10` returning `sk-ant-api` (10 characters only, never the full key).
- Deployed with `npx firebase deploy --only functions`. First-ever functions deploy on this project auto-enabled `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `run.googleapis.com`, `eventarc.googleapis.com`, and `firebaseextensions.googleapis.com` without prompting (Blaze plan already active). The CLI reported one non-fatal error after the function itself deployed successfully: it could not auto-configure an Artifact Registry cleanup policy for `us-central1` (cosmetic ops item: container images will accumulate a small storage cost over time until a policy is set via `firebase functions:artifacts:setpolicy`). This does not affect the function's availability and is recorded below as a deferred ops item, not a blocker.
- Verified live: `npx firebase functions:list` shows `gradeAnswer`, v2, callable, region `us-central1`, `nodejs22`. `npx firebase functions:log --only gradeAnswer` shows a clean create: `CreateFunction` audit log with `state: ACTIVE`, the `ANTHROPIC_API_KEY` secret attached at version 1, followed by a clean cold start (`Starting new instance` -> `Default STARTUP TCP probe succeeded after 1 attempt`), no errors.
- Deploy timestamp (function `createTime`, UTC): `2026-07-30T12:44:48Z`.
- Function region: `us-central1`.

### Live hypo review still pending real content

Live decks (`https://flashcards-be310.web.app`) contain only basic/cloze cards until Plan 4's pipeline uploads real mcq/hypo content, so there is no live hypo card to exercise `gradeAnswer` against yet through the actual UI. The deploy itself is verified live (clean cold start, no errors); the full hypo-review-plus-AI-check path is verified against the emulator only, per the brief. Full live verification will happen naturally once Plan 4 content lands, or sooner if a hypo card is added manually through the Firestore console.

## Resolved ops items (both PENDING-USER items from the brief are resolved)

1. **Anthropic Console API key:** already created by the user in a dedicated workspace with a spend limit, placed in `functions/.secret.local` (git-ignored). One formatting bug was found and fixed during this task (duplicated `sk-ant-` prefix); the corrected key was verified against the real Anthropic API before use anywhere else.
2. **Blaze plan:** `flashcards-be310` is already on Blaze; the first functions deploy proceeded without any billing-related prompt or failure.

This file intentionally contains prefix-pattern-only mentions of sk-ant for bug documentation; it contains no key material.

## New deferred ops item

- Artifact Registry has no cleanup policy in `us-central1` for this project; run `firebase functions:artifacts:setpolicy` (or pass `--force` on a future `firebase deploy --only functions`) to avoid unbounded container-image storage growth. Not urgent at this project's scale, but cheap to fix next time functions are deployed.
