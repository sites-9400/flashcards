# Plan 2 (MCQ and Hypo Study Modes + AI Grading) closeout — 2026-07-30

All 8 tasks complete; final whole-branch review (0c3017d..f635546) verdict: **With fixes**, 0 Critical. Fix wave landed as 7db7b5a (gradingUsage rules carve-out with denial tests, functions predeploy hook, server-side error logging, timezone-independent Manila-anchored gradingDay, doc acknowledgment); scoped re-review clean with all suites independently re-run (root 45/45, functions 3/3 across four timezones, rules 6/6).

**Shipped and live:** all four card types reviewable; hypo session cap (3) with interleaving that never leads with a hypo; skip-hypos toggle; ALAC checklist with suggested grades (>=3.5 good, >=2 hard, else again); `gradeAnswer` deployed to us-central1 (claude-haiku-4-5, auth-gated, 50/day cap now client-tamper-proof, ANTHROPIC_API_KEY as Firebase secret); AI verdicts pre-fill but never auto-confirm; every AI failure degrades silently to manual grading. Real-key emulator E2E verified real Claude verdicts and log persistence.

**Two mid-execution plan amendments** (both in docs/plan-2.md, synced): the interleave invariant (never start a session with a hypo when a non-hypo exists; tail clumping acceptable when hypos outnumber others) and the per-grade remount key pattern (`key={card.id + '-' + round}`) on all interaction components.

## Recorded deferrals, routed

**Plan 3 pickups (stats/events touch these areas):**
- The unbounded reviewLogs read in `fetchDeckBundle` (carried from Plan 1; Plan 3's stats work must fix with a `ts >=` bound + composite index or per-day counter).
- Review.tsx DOM test for the last-card-again reveal reset (currently guarded by the remount pattern, verified by trace only).
- GradeBar shows keyboard hints "(2)(3)(4)" on mcq/hypo confirm bars where keyboard grading is not wired; either wire keys or hide hints there.
- Minor test nits: learningSteps midpoint assertion; fully-empty-extras DOM test; navigator.onLine spy restore.

**Whenever functions/ is next touched:**
- `verdictsSchema` should enforce one verdict per beat via `.refine()` (duplicates currently degrade the client safely to manual, verified).

**Plan 4 pickups:** deckSchema house-rule clean string (carried from Plan 1).

**Ops (carry-forward list):**
- Artifact Registry cleanup policy: `firebase functions:artifacts:setpolicy` (cosmetic warning each functions deploy).
- CI runs the root suite only; rules tests remain local-only (Plan 1 M4 still open; add setup-java + `npm run test:rules` job when CI is next touched); firebase-tools not a devDependency (Plan 1 M3); no deploy concurrency group (Plan 1 M7).
- Key rotation caution: on any future ANTHROPIC_API_KEY rotation, verify the stored value starts with a single `sk-ant-` prefix (a duplicated-prefix paste bug was caught and fixed during Task 8).

## Live-content dependency

Live decks still contain only basic/cloze cards; the deployed mcq/hypo review paths and gradeAnswer get real traffic once Plan 4's pipeline uploads generated decks (or a card is added manually via console).

## Next plan

Plan 3: events/prep/stats (write from docs/spec.md sections 7 and 9 via superpowers:writing-plans; include the Plan 3 pickups above).
