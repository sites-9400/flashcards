# Flashcards App, Design Spec

Date: 2026-07-30
Status: approved design, pre-implementation
Working title: LawDeck (renameable at repo creation; nothing in the design depends on the name)

## 1. Purpose and users

An active-recall flashcard app in the spirit of Anki, built first for Gamaliel's law school study (2Y-1S subjects: Civ Pro, Sales, ATP, Corp, PIL, ADR), designed multi-user from day one so classmates and other students can use it later. Reviews happen on phone and laptop equally, so cross-device sync and offline review are core requirements, not extras.

Success criteria for v1:

- Daily reviews work on phone and laptop, online or offline, with one synced schedule.
- Decks are generated from the existing notes Google Docs by a cheap-agent pipeline with a mandatory QA gate.
- Recit and exam dates drive prioritization of exactly the enumerated coverage.
- Weak-spot stats answer "what am I about to get burned on."

## 2. Chosen approach and rejected alternatives

Chosen: a Progressive Web App (PWA) on Firebase.

Rejected:

- Expo/React Native native apps: app-store presence is not needed yet; a PWA can be wrapped into store apps later without a rewrite. Slower to v1, more moving parts (builds, store review, Apple fees).
- Anki as the engine with generated .apkg decks: fastest path to studying, but cannot deliver the ALAC self-grading flow, event-aware scheduling, or a multi-user product. Kept in mind as a fallback if the app ever stalls and exams loom.

## 3. Architecture

- Client: React + TypeScript + Vite, installable PWA via vite-plugin-pwa (offline app shell), Tailwind for styling. One responsive codebase for phone and laptop.
- Backend: Firebase. No custom server in v1 except one Cloud Function, gradeAnswer (section 5a), which exists because LLM grading of typed answers cannot run in the browser without exposing an API key.
  - Firebase Auth, Google sign-in.
  - Firestore with offline persistence enabled: reviews done offline queue locally and sync automatically. Multi-user boundaries enforced by Firestore security rules, not server code.
  - Firebase Hosting, deployed via GitHub Actions on push to main.
- Scheduling runs on-device using ts-fsrs (open-source FSRS, the algorithm modern Anki uses). Firestore stores resulting state only.
- Card generation runs outside the app in v1, on the user's Mac in Claude Code (see section 8). The app only consumes decks.
- Repo: GitHub is source of truth; working copy lives outside Dropbox (e.g. ~/Projects/), since Dropbox syncing node_modules and .git causes pain. The user handles Firebase console and GitHub setup (known territory).

## 4. Data model (Firestore)

Core separation: content (decks, cards) is stored apart from per-user study state (scheduling, logs). Publishing a deck shares cards, never anyone's progress.

```
decks/{deckId}
  ownerUid, title, subject, description
  visibility: "private" | "published"
  sourceRef: { docId, coverage enumeration used at generation }

decks/{deckId}/cards/{cardId}
  type: basic | cloze | mcq | hypo
  type-specific fields (section 5)
  tags: ["jurisdiction", "docket-fees", ...]
  source: { docId, heading, case citation if applicable }

users/{uid}
  profile, settings

users/{uid}/subscriptions/{deckId}
  addedAt, newCardsPerDay (default 15)

users/{uid}/events/{eventId}
  type: recit | exam | quiz
  subject, title, date
  coverage: { deckIds: [...], tags: [...] }   // cards matching either are "in scope"

users/{uid}/cardStates/{deckId_cardId}
  FSRS state: due, stability, difficulty, reps, lapses,
  state (new/learning/review/relearning), lastReview

users/{uid}/reviewLogs/{autoId}
  cardId, deckId, rating (again|hard|good|easy), tags,
  timestamp, typedAnswer (hypos, optional), aiVerdicts (per-beat, optional)
```

Design commitments:

- Stable card IDs: cardId derives deterministically from source (doc + section + type + slug). Regenerating a deck after notes revisions updates edited cards in place, preserving review history; only new material arrives as new cards.
- Review logs are append-only. cardStates is the current snapshot; reviewLogs is full history, so future stats need no schema changes.
- Security rules: a deck and its cards are readable by the owner, or by anyone when visibility is "published"; writable only by the owner. Everything under users/{uid} is readable and writable only by that user.

## 5. Card types

All four types feed the same FSRS scheduler.

- basic: front, back. Doctrines, case holdings, distinctions.
- cloze: text with {{c1::...}} deletions; each deletion becomes a sibling card. For codal enumerations, amounts, and mnemonics.
- mcq: stem, choices[], correctIndex, explanation. Sourced from bar Q compilations and drills. Auto-graded: wrong maps to Again, right defaults to Good (user can adjust to Hard/Easy).
- hypo: facts, question, model answer as four separate ALAC fields (answer, legalBasis, application, conclusion). Review: read hypo, answer (typing optional; typed answers saved to the review log), reveal model answer beat by beat, grade via the 4-beat ALAC checklist, either manually or AI-assisted (section 5a); the beat score suggests the rating, user confirms.

Case-to-ALAC transform (pipeline rule, not a new type): every digested case yields a hypo card by default. Digest FACTS + ISSUE become the hypo facts and question; the digest RULING maps beat-for-beat onto ALAC (Yes/No = answer, ratio = legalBasis, the "In this case," sentence = application, "Hence," = conclusion). The legalBasis beat must itself cite the controlling case by name and G.R. No. (plus the codal basis where applicable): "the legal basis" in a recit or bar answer includes its source, and the grader treats an uncited rule as partial credit only. The conclusion beat must restate the resolution of the issue itself first, then add the disposition (e.g. "Hence, the court did not acquire jurisdiction over the case, and the complaint was properly dismissed."), never the disposition alone (user rule, 2026-07-30). After reveal, the card shows provenance: link to the archived Lawphil PDF in Drive and the digest's DOCTRINE line as a capsule. Optionally, a basic card for the doctrine line accompanies it.

## 5a. AI-assisted answer grading (hypos)

Typed answers need not be verbatim; substance is what gets graded.

- Cloud Function gradeAnswer: input is the user's typed answer plus the card's four ALAC beats; the function calls the Claude API (Haiku; cheap, structured output) and returns a per-beat verdict, got it / partial / missed, each with a one-line reason.
- The verdicts pre-fill the ALAC checklist in the review UI. The user remains the final grader and can override any beat before confirming; the confirmed beat score suggests the FSRS rating. AI proposes, the user disposes, which keeps scheduling honest when the AI misjudges.
- Grading rubric includes the citation rule above: on the L beat, the rule without its source (case name or codal article) scores partial, not full.
- Fallbacks: no typed answer, offline, or over quota → manual checklist self-grading, unchanged.
- Cost control: a per-user daily grading cap (config default 50/day); the function verifies the caller's auth token. The Claude API key lives in the function's server-side config only, stored as a Firebase secret (firebase functions:secrets:set ANTHROPIC_API_KEY). The key comes from an Anthropic Console account/workspace of the user's choosing (a dedicated workspace with a spend limit recommended); API billing is separate from any claude.ai subscription, and swapping billing accounts later is a one-secret change.
- Typed answers and verdicts are stored in reviewLogs (fields typedAnswer, aiVerdicts) to power the hypo-history view.

## 6. Review experience

- Home screen: due count per deck, upcoming events with in-scope and weak counts, stats strip (section 9).
- Standard session: due cards plus the daily new-card allotment. Event session: in-scope cards ranked weakest first, ignoring due dates.
- Laptop: keyboard-driven (space reveals, 1-4 grades). Phone: full-screen card, thumb-reachable grade bar.
- Grade buttons show predicted next interval (like Anki).
- Hypos take minutes while clozes take seconds: sessions interleave at most a handful of hypos; a "skip hypos" toggle supports quick phone sessions. Hypos count triple against newCardsPerDay.

## 7. Scheduling

- FSRS via ts-fsrs, on-device; each rating updates stability and difficulty and produces the next due date. Default target retention 90%, adjustable per deck.
- Event awareness:
  1. Interval clamp: a card in scope of an upcoming event is never scheduled past that event; its due date clamps to at latest the day before. Normal scheduling resumes after the event passes.
  2. Prep sessions: "Prepare for [event]" ranks in-scope cards by predicted retrievability, weakest first. Prep reviews still update FSRS state honestly, so cramming never corrupts the long-term schedule.
- Day boundary rolls over at 4 a.m. local time.
- Offline conflict rule: if the same card is reviewed on two offline devices, the later-timestamped review wins the scheduling state; both reviews are kept in the log.

## 8. Generation pipeline (notes to cards)

Lives in the Law School workspace as a skill (make-deck), two agents, and an uploader script. Runs on the user's Mac in Claude Code; the Firebase Admin SDK service-account key lives only on that machine.

1. Coverage enumeration: the user specifies the deck's coverage (chapters, article ranges, cases). The skill slices it into units (one note section, one digest, one enumeration each).
2. Fan-out: one card-writer agent per unit, in parallel, pinned Haiku (cheap). Each receives only its source excerpt plus the card JSON schema and returns draft cards (doctrines to basic, enumerations to cloze, bar Qs to mcq, digests to the case-to-ALAC hypo transform).
3. QA gate: card-qa agent, pinned Sonnet, runs on every batch with the same source excerpt. No skip path. Checks per card:
   - Grounding: every claim traceable to the source; no invented doctrine, article numbers, G.R. numbers, or amounts (amounts exact-match checked).
   - Form: front answerable without the back; all four ALAC beats present and non-overlapping; cloze deletions test the right term; MCQ distractors plausible with exactly one correct answer.
   - House rules: tags from the deck's tag list; no em dashes; bar years only when stated in the source, otherwise "(recurring)".
   Verdicts: pass, fixed (correction applied), or rejected (with reason; rejected cards are dropped, not retried by the same writer).
4. Mechanical validation in the script: JSON schema, deterministic IDs, cloze syntax, dedupe against existing cards.
5. Human skim of the QA-passed set, then upload via Admin SDK. The uploader refuses partial decks: if any card fails validation, nothing uploads until resolved.

Upgrade path: when other users need generation, the same logic moves into a Firebase Cloud Function calling the Claude API, triggered from an in-app import screen. Card JSON and Firestore writes stay identical.

## 9. Stats and weak-spot reporting

Computed client-side from reviewLogs in v1 (volume is small; a nightly aggregation Cloud Function can be added later without schema changes).

- Home strip: streak, reviews today, time spent, 7-day due forecast.
- True retention: share of due reviews rated Good or Easy, overall and per deck; also feeds FSRS parameter auto-tuning per user.
- Weak spots: failure rates grouped by tag, ranked. Shown on a Weak Topics screen, the home screen (top 3), and inside each event ("weak in scope for Friday's recit: docket fees, totality rule").
- Event readiness: average predicted retrievability across an event's in-scope cards, as one percentage.
- Hypo history: a hypo card's detail view lists past typed answers beside the model ALAC.

## 10. Error handling and testing

- Offline is a state, not an error: a quiet "syncing later" indicator; reviews never block on the network.
- Pipeline failures are loud: partial decks never upload.
- Tests: unit tests for the scheduling wrapper (interval clamp, day boundary, hypo weighting) and card validators; Firestore security rules tested with the emulator (the multi-user boundary must never regress); one smoke E2E of the review loop (load deck, review, state persists).

## 11. V1 scope

In: multi-user auth and published decks, all four card types, FSRS with event awareness, offline review with sync, generation pipeline with QA gate, AI-assisted hypo grading (the gradeAnswer Cloud Function), stats as in section 9.

Out (explicitly later): in-app card generation, in-app deck editing beyond deletes/archives, native app wrappers, notifications/push, social features (leaderboards, shared progress), FSRS parameter UI beyond target retention.

## 12. House style

No em dashes in any card content or UI copy (standing user rule). No emojis anywhere in the UI; icons are plain inline SVGs (user rule, 2026-07-30). UI copy plain and terse; the app is a study tool, not a personality.

Brand palette (user, 2026-07-30, homage to their school): the accent color is mustard yellow (start at #E0A526, tune in build), and any text or icon on a mustard surface is maroon (start at #7B1113). Mustard fill is for interactive surfaces only: buttons, selected states, focus. Never put a mustard-filled chip or panel behind body text (user rejected that explicitly); revealed cloze answers and inline emphasis are maroon bold text on a thin mustard underline, and explanatory callouts use a mustard left-border. Neutral grays for structure; semantic green/red retained for correct/wrong verdicts. No blue accents anywhere.
