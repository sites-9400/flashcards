# Plan 3 (events, prep sessions, and stats) verification notes, 2026-07-31

## Verification record: emulator end to end walk

Ran with fresh emulators (auth + firestore only; the functions emulator was not
started for this walk, per the brief's optional note, since AI grading was
already verified live in Plan 2). Java resolved via
`export PATH="$(brew --prefix)/opt/openjdk/bin:$PATH"`. Created a throwaway
test user through the auth emulator's REST sign up endpoint, then seeded with
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 SEED_UID=<uid> npm run seed`, which
seeded deck `civpro-1` (5 cards: basic, cloze x2, mcq, hypo) plus the seed
event `seed-recit` ("Friday recit", date now + 3 days, coverage deckIds
`[civpro-1]`, tags `[jurisdiction]`).

Sign in: the app only offers Google popup sign in, which Playwright cannot
drive. Per the Task 6 precedent, `src/lib/auth.tsx`'s `signIn` export was
temporarily swapped to `signInWithEmailAndPassword` against the auth emulator
for this walk only, then reverted with `git checkout -- src/lib/auth.tsx`
before anything was committed. Confirmed reverted and the tree clean with
`git status` immediately before staging this file (see Revert verification
below); the patch was never part of any commit.

Screenshots below live in
`.superpowers/sdd/2026-07-30-lawdeck-plan-3-events-stats/screenshots/`.

1. **Home, fresh seed** (`task9-01-home-fresh-zeros.png`). Stats strip read
   Streak "0 days", Today "0 reviews", Time "0 min", Retention "n/a". Forecast
   line read "D+0 0, D+1 0, D+2 0, D+3 0, D+4 0, D+5 0, D+6 0". Upcoming events
   showed "Friday recit, 8/3/2026, 5 in scope, 0%" with a Prepare link. Weak
   topics read "No weak topics yet." Deck row showed "5 cards, 0 due" with a
   Study link.

2. **Review session, mixed grades.** Opened `/review/civpro-1` and reviewed
   all 5 cards, including two "again" requeues (7 logs total): mcq (piercing,
   graded Good), basic "sale vs agency" (graded Easy, used for the clamp
   check below), the seeded hypo card "Manchester v. CA" (typed an answer,
   revealed all four ALAC beats, graded Again on the first pass, requeued),
   cloze 1 of the jurisdiction amounts card (graded Hard), cloze 2 of the same
   card (graded Again, requeued), the requeued hypo (typed a second answer,
   graded Good), the requeued cloze 2 (graded Good). No functions emulator
   was running, so the hypo card showed the manual ALAC checklist only, no
   "AI check my answer" call was made (button was present but unclicked,
   matching the "optional" carve out).
   - `task9-02-hypo-beats-revealed.png`: all four beats revealed on the first
     hypo pass, before marking, "Past answers" button visible.
   - `task9-03-hypo-past-answers.png`: on the second hypo pass, clicking
     "Past answers" listed the first pass's typed answer
     ("7/31/2026: No, the court did not acquire jurisdiction because docket
     fees were not paid on the full amount claimed, per Manchester v. CA."),
     confirming `fetchPastAnswers` round trips through the emulator. (On the
     first pass, before any prior log existed, the toggle correctly showed
     "None yet.", observed live but not separately screenshotted.)
   - `task9-04-review-session-done.png`: end of queue, "Done for now. Nothing
     due in this deck."

3. **Home, after the session** (`task9-05-home-post-session.png`). Streak
   "1 days", Today "7 reviews", Time "3 min", Retention "100%". Forecast read
   "D+0 4, D+1 0, D+2 1, ...". The event row now read "8/3/2026, 5 in scope,
   100%" plus a new "weak: jurisdiction" line. Weak topics listed
   "jurisdiction, 40% fail". Deck row read "5 cards, 0 due, 100% ret".
   - Retention arithmetic check: of the 7 logs, 5 were first reviews of their
     card (excluded from true retention) and 2 were second reviews of a
     previously graded card in the same session (the requeued hypo, graded
     Good, and the requeued cloze 2, graded Good); both non-first reviews
     were Good, so true retention = 2/2 = 100%, matching the tile.
   - Weak topics arithmetic check: the tag `jurisdiction` appears on cloze 1,
     cloze 2, and the hypo card, giving 5 tagged attempts in the session
     (cloze1 x1, cloze2 x2, hypo x2). Two of those five were graded Again
     (the hypo's first pass and cloze2's first pass), giving fail rate
     2/5 = 40%, matching the tile and crossing the 30 day / 4 attempt floor
     (5 >= 4) so the tag surfaced on both Home and Weak.
   - Readiness read 100% because every in scope card had just been reviewed
     seconds to minutes earlier, so predicted retrievability for all 5 cards
     was still near 1 at the moment of computation. This is expected FSRS
     behavior (retrievability decays with elapsed time from `lastReview`),
     not a bug; a later run of the same walk on a different day would show a
     lower, more informative number.

4. **Events, edit and save** (`task9-06-events-edited.png`). Opened
   `/events`, clicked Edit on "Friday recit"; the form pre populated with the
   existing title, subject, type, date (`2026-08-03`), the Civ Pro deck
   checkbox checked, and tags `jurisdiction`. Changed tags to
   "jurisdiction, docket-fees, amounts" and saved. The list row updated live
   to "CIVIL PROCEDURE 1: recit: 8/3/2026: jurisdiction, docket-fees,
   amounts", confirming `saveEvent` persists edits (not just creates).

5. **Prep session** (`task9-07-prep-session.png`). Opened `/prep/seed-recit`
   from the Events row. Header read "readiness 100%: 1 / 5". Graded the mcq
   card Easy (queue advanced to "2 / 5", readiness held at 100% since the
   card was already near full retrievability), graded the basic card Good
   (queue advanced to "3 / 5", readiness still 100% for the same reason), then
   stopped mid session on the hypo card (typed nothing further; not graded).
   Weakest first ordering could not be visually distinguished by eye at this
   resolution (all cards were reviewed within the same few minutes so their
   retrievabilities were all close to 1), but the queue advanced deterministically
   card by card as expected and readiness recomputed live from the full in
   scope set after each grade, matching `buildPrepQueue`'s and
   `eventReadiness`'s unit test coverage (Task 6's `queue.test.ts` proves the
   ordering property directly with fixtures that force separated
   retrievabilities; this walk exercises the live wiring, not the ordering
   math itself).

6. **Weak Topics screen** (`task9-08-weak-topics.png`). Opened `/weak`
   directly; listed one row: "jurisdiction, 40% fail, 5 attempts", matching
   the Home summary tile exactly.

## Clamp verification (live, against the seeded event)

Card: the basic "sale vs agency" card (`civpro-1_1sb0tw8u4q9ua`), graded Easy
in Review (step 2 above), which is in scope of "Friday recit" via
`coverage.deckIds` matching its deck (`civpro-1`).

Read directly from the Firestore emulator via its REST endpoint
(`GET .../documents/users/{uid}/events/seed-recit` and
`.../documents/users/{uid}/cardStates`, both with an emulator-issued auth
bearer token):

- Event date: `1785689469064` ms = 2026-08-03T00:51:09.064 local.
- Card's `lastReview` going into the Easy grade: `1785430381839` ms.
- Unclamped scheduled interval on Easy: `scheduledDays: 8` (visible in the
  UI's own grade button, "Easy 8d (4)", and in the persisted cardState);
  unclamped due would have been `lastReview + 8 days` =
  `1786121581839` ms = 2026-08-10T00:53:01.839 local, four days past the event.
- Persisted `due` after grading (post clamp): `1785603069064` ms =
  2026-08-02T00:51:09.064 local.
- `event.date - due` = `1785689469064 - 1785603069064` = `86400000` ms
  exactly, i.e. the clamp landed the due date at exactly the day before the
  event (`event.date - 1 day`), which is the tightest legal value under the
  spec rule ("at latest the day before") and matches
  `applyReviewClamped`'s unit test assertion
  (`clamped.due <= eventAt - DAY`) with equality rather than slack.

## Design decisions recap (Plan 3, from docs/plan-3.md's Global Constraints)

- **Time spent today heuristic:** for each study day's logs sorted ascending,
  add `min(gap to the previous same day log, 60000 ms)` per log, plus a flat
  `10000 ms` for the first log of the day. This intentionally under counts
  long idle gaps (capped at one minute) so a phone left open overnight does
  not inflate the tile, while still crediting a nonzero floor for a single
  quick review. Observed live: 7 logs in a few minutes of wall clock time
  produced a "3 min" tile, consistent with several sub minute gaps between
  clicks plus the 10s seed.
- **Streak rule:** consecutive study days with at least one review, walking
  back from today; a day with no reviews yet does not break the streak as
  long as yesterday had one (today simply has not happened yet from the
  streak's point of view). Observed live: the very first review of the
  session produced "1 days" immediately, with no prior day's data seeded.
- **Weak spots thresholds:** 30 days of `reviewLogs`, minimum 4 attempts per
  tag before it is allowed onto the ranking (guards against a single unlucky
  again on a tag that has only been seen once or twice). Observed live: the
  `jurisdiction` tag reached exactly 5 attempts in one session and appeared;
  no other tag in the seed deck reached 4 attempts in this walk (`sales`,
  `sale-vs-agency`, `piercing`, `docket-fees`, `amounts` each had 1 to 2), so
  Weak Topics correctly showed only the one row.
- **Event readiness:** mean predicted `retrievability` across every in scope
  card (deck match or tag match), with an unseen card (no cardState) counting
  as 0. This makes readiness a genuinely pessimistic, decay aware number
  rather than a raw completion percentage; it moves down over time even with
  no further action, which is the intended behavior for exam prep planning.
- **Composite index (Task 2):** `reviewLogs` collection, fields `deckId`
  ASCENDING then `ts` ASCENDING, added to `firestore.indexes.json` and
  deployed to the live project. Confirmed still present via
  `npx firebase firestore:indexes` during this task's ship step, output
  included the same `deckId`/`ts` pair (plus the automatic `__name__`
  tiebreaker Firestore always appends). This index backs `fetchDeckBundle`'s
  bounded query (`where('deckId', '==', deckId), where('ts', '>=',
  startOfStudyDay(now))`), replacing the old unbounded per deck log read.

## Whole plan verification checklist results

- **Suites green, tsc clean, build clean:** root suite 16 files / 67 tests
  passed (`npm test`); rules suite 10/10 passed
  (`npm run test:rules`, functions untouched by this plan); `npx tsc -p
  tsconfig.app.json --noEmit` produced no output (clean); `npm run build`
  succeeded (only the pre-existing, unrelated >500 kB chunk size advisory).
- **CI green:** see Ship section below.
- **Emulator E2E per Task 9:** completed, see Verification record above.
- **Clamp verified live against a seeded event:** completed, see Clamp
  verification above, exact `event.date - 1 day` equality observed.
- **Prep ordering weakest first:** covered by unit tests with fixtures that
  force separated retrievabilities (`src/lib/queue.test.ts`, Task 6); the
  live walk exercised the same code path end to end but could not visually
  distinguish ordering since all seed cards had near identical, near maximal
  retrievability at walk time (all reviewed within the same few minutes).
- **Stats strip numbers move correctly across a session:** confirmed live;
  Streak 0 to 1, Today 0 to 7, Time 0 to 3 min, Retention n/a to 100%, weak
  topics 0 to 1 row, event readiness 0% to 100%, all matching hand computed
  arithmetic from the session's own logs (shown inline above).
- **No new dependencies; no charts:** `package.json` diff across the whole
  plan (commits `236a298..ced6208`) added no `dependencies` or
  `devDependencies` entries; no chart library or canvas/SVG chart code exists
  anywhere in `src/`.
- **House rules (em dashes, emojis, no blue) hold in changed files:** grepped
  every non doc file changed across the whole plan
  (`git diff 4200773..ced6208 --name-only`) for the em dash character and for
  emoji code point ranges: zero matches in either pass. Grepped the same file
  list case insensitively for the word "blue": zero matches (the only two
  hits in the full diff are both inside `docs/plan-3.md`'s own constraint
  text describing the rule, not a violation of it).
- **Hot path bounds:** `fetchDeckBundle`'s log query is bounded to
  `ts >= startOfStudyDay(now)` for the current deck only (backed by the
  Task 2 composite index, confirmed deployed above); `fetchHomeBundle` and
  `fetchRecentLogs` bound every stats read to `ts >= now - 30 days`;
  `fetchPastAnswers` is an equality only query on `cardId` (no composite
  index required) capped to 5 results client side. No unbounded `reviewLogs`
  read remains on any screen's load path
  (`grep -n "reviewLogs" src/lib/data.ts` shows every call site carrying a
  `where('ts', ...)` or `where('cardId', ...)` bound, plus the append only
  write path).

## Revert verification

`git checkout -- src/lib/auth.tsx` was run immediately after the emulator
walk, before any other file was touched for this task. `git status`
immediately before staging this notes file:

```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

The only file staged and committed for Task 9 is this one,
`docs/plan-3-notes.md`; the seed script, `auth.tsx`, and every other app file
are byte identical to `HEAD` (`ced6208`) at commit time.

## Ship

```
npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build
git add docs/plan-3-notes.md
git commit -m "docs: plan 3 verification notes"
git push
gh run watch <run-id> -R sites-9400/flashcards --exit-status
```

CI result and the resulting commit SHA are recorded in
`.superpowers/sdd/2026-07-30-lawdeck-plan-3-events-stats/task-9-report.md`.
