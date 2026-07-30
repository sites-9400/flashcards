# Plan 3 (Events, Prep Sessions, Stats) closeout: 2026-07-31

All 9 tasks complete, plus one inserted fix task (8.5). Final whole-branch review (236a298..02607ab, most capable model) verdict: **With fixes**, 0 Critical. Fix wave landed as 2438adc (event visible through its own study day via the new `isUpcoming` predicate; Events form required attributes and empty-date guard) and ae9f24e (Retention tile switched to the 30 day window per the user's ruling). Scoped re-review: all findings addressed, no new breakage, boundary math independently verified. CI green through ae9f24e.

**Shipped and live:** events CRUD (recit/exam/quiz) with coverage by deckIds and tags; scheduling clamp so in-scope cards never schedule past an upcoming event (verified live at exactly event date minus one day); prep sessions at /prep/:eventId ranked unseen-first then weakest retrievability, with live readiness percentage over the full in-scope set; Home stats strip (streak, today's reviews, time, 30 day retention), 7 day due forecast, upcoming events with readiness and weak tags, per-deck due badges and 30 day per-deck retention; Weak Topics screen at /weak (4-attempt floor, 30 day window); hypo past-answers history (equality-only query, capped 5); Firestore rules catch-all rewritten to be evaluable at list time (Task 8.5).

**Two controller amendments** (recorded in the execution ledger, both reviewed):
- Task 8.5 inserted: the plan's "events need NO rules change" assumed the old catch-all worked everywhere, but its `document.size()` call fails list-time evaluation in the Firestore emulator (firebase-tools 15.24.0), blocking every collection query under users/{uid} there. The rewrite preserves the security semantics exactly (owner-only subtree, gradingUsage denied to all including the owner, bare user doc unchanged) and is pinned by 4 new list-query rules tests; the 6 pre-existing rules tests pass unchanged. Production was never affected.
- Retention tile scope: the Task 7 brief's prose (30 day window) and its own test fixture (today-only) contradicted each other. Implemented today-scoped to satisfy the literal test, escalated, and the user ruled for the 30 day window (consistent with per-deck rows; semester runs about 4 months, so a month is a sane slice). Landed in the fix wave.

Plan 2 pickups scheduled into this plan landed in Tasks 1-2: Review.test.tsx DOM regression tests, keyboard grading on McqReview/HypoReview, and the bounded fetchDeckBundle hot path (today-only logs, composite index reviewLogs deckId ASC / ts ASC deployed and confirmed).

## Recorded deferrals, routed

All ledger deferrals were triaged FINE-TO-DEFER by the final review. Highlights by destination:

**Plan 4 pickups (or next touch of the file concerned):**
- Shared states-map building helper for fetchDeckBundle/fetchPrepBundle (three-line duplication).
- fetchPrepBundle reads every owned deck's cards even for deckIds-only coverage; reuse fetchHomeBundle's target-deck narrowing for tag-free events.
- fetchPastAnswers reads all of a card's logs then keeps 5; move to a (cardId ASC, ts DESC) composite index with limit(5) once cards accrue long histories.
- Rules suite: add a two-line get/set test pinning bare users/{uid} doc access (currently analysis-proven only).
- deckSchema house-rule clean string (carried from Plans 1-2).
- Misc minors: logsToday helper in stats.ts; memoize Home stats if deck counts grow; Weak empty-state flash during load; past-answers double-click race (worst case one duplicate small read).

**Whenever functions/ is next touched:** verdictsSchema one-verdict-per-beat refine (carried from Plan 2).

**Ops (carry-forward list):**
- DONE 2026-07-31: `firebase deploy --only firestore:rules` ran successfully; repo and deployed rules in sync. Reminder: CI deploys hosting only, so any future rules edit needs the same manual deploy.
- Carried from Plan 2: Artifact Registry cleanup policy; CI rules-test job (setup-java + npm run test:rules); firebase-tools as devDependency; deploy concurrency group; ANTHROPIC_API_KEY rotation prefix check.

**Known pre-existing (documented, not a regression):** a nested collection literally named gradingUsage (for example users/{uid}/events/e1/gradingUsage/x) is not covered by the deny block under either the old or new rules; revisit only if such a collection ever exists.

## Live-content dependency

Live decks still contain only basic/cloze cards; prep sessions, weak topics, and hypo history get full traffic once Plan 4's pipeline uploads generated decks with mcq/hypo content.

## Next plan

Plan 4: content pipeline (generated decks upload; include the Plan 4 pickups above). Write from docs/spec.md via superpowers:writing-plans.
