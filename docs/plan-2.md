# LawDeck Plan 2: MCQ and Hypo Study Modes + AI Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all four card types reviewable (adding MCQ auto-graded review and hypo ALAC-checklist review with optional AI-assisted grading via a gradeAnswer Cloud Function), completing spec sections 5, 5a, and the review-experience parts of section 6.

**Architecture:** The Review screen becomes a router that hands each card to a type-specific interaction component (BasicClozeReview, McqReview, HypoReview); all three call back into one `grade()` path that runs FSRS and persists. AI grading lives in a single Firebase Cloud Function (`gradeAnswer`, callable, Node 22) that holds the Anthropic API key as a Firebase secret and calls Claude Haiku with structured output; the client treats any function failure as "fall back to manual checklist," so offline review never blocks.

**Tech Stack:** Existing (React 19 + TypeScript strict + Vite + Tailwind 4 + Firebase 12 + ts-fsrs 5 + zod 4 + vitest). New: `firebase-functions` v6 + `firebase-admin` + `@anthropic-ai/sdk` in a new `functions/` package.

**Repo:** `~/Projects/flashcards`, branch `main` (work directly on main, matching Plan 1; CI deploys hosting on push, so every commit must leave `npm test` green). Live app: https://flashcards-be310.web.app.

## Global Constraints

Copied from docs/spec.md and standing user rules; every task's requirements implicitly include these.

- No em dashes in any card content, UI copy, code comments, or commit messages (standing user rule).
- No emojis anywhere in the UI; icons are plain inline SVGs (user rule, 2026-07-30).
- Brand palette: accent mustard `#E0A526` (Tailwind token `mustard`), text/icons on mustard are maroon `#7B1113` (token `maroon`). Mustard fill only on interactive surfaces (buttons, selected states, focus). Never a mustard-filled chip or panel behind body text. Revealed answers and inline emphasis: maroon bold text on a thin mustard underline. Explanatory callouts: mustard left border. Neutral grays for structure. Semantic green/red retained for correct/wrong verdicts. No blue accents anywhere.
- TypeScript strict (both tsconfigs have `"strict": true`; keep it passing).
- MCQ grading rule (spec 5): wrong answer maps to Again automatically; right answer defaults to Good, user may adjust to Hard or Easy only.
- Hypo grading rule (spec 5/5a): four ALAC beats (answer, legalBasis, application, conclusion); the beat score suggests the FSRS rating and the user confirms; on the legalBasis beat, a rule stated without its source (case name/G.R. No. or codal article) scores partial at most.
- Hypos count triple against newCardsPerDay (`HYPO_COST = 3` in src/lib/queue.ts, already implemented).
- Sessions interleave at most a handful of hypos (spec 6); this plan fixes "a handful" at 3 per session (`MAX_SESSION_HYPOS = 3`).
- The Claude API key lives ONLY in the Cloud Function's server-side config as Firebase secret `ANTHROPIC_API_KEY`. It must never appear in client code, VITE_ env vars, git, or logs.
- AI grading model: `claude-haiku-4-5` via `@anthropic-ai/sdk` (spec 5a: Haiku, cheap, structured output). Per-user daily grading cap: 50/day, enforced server-side.
- gradeAnswer fallback rule (spec 5a): no typed answer, offline, function error, or over quota means manual checklist self-grading, unchanged and unblocked.
- Day boundary: `studyDay()` from src/lib/scheduler.ts (4 a.m. local rollover). Vitest pins TZ Asia/Manila; CI runs the suite, so all tests must pass under that config (`npm test` green before every commit).
- Firestore security: everything under `users/{uid}` is owner-only; review logs are append-only; deck/cards readable by owner or when published. Rules are deployed live; do not modify firestore.rules in this plan (the function uses Admin SDK, which bypasses rules by design).
- Recorded debt NOT in this plan's scope (do not fix): the unbounded reviewLogs read in `fetchDeckBundle` (Plan 3), deckSchema clean-string (Plan 4). See docs/plan-1-closeout.md.

## Existing interfaces this plan builds on (read-only reference)

- `buildQueue({cards, states, newCardsPerDay, newIntroducedToday, now, skipHypos?}): Card[]` in src/lib/queue.ts; returns due cards (sorted by due) then new cards within budget.
- `applyReview(state, grade, now): CardStateDoc`, `newCardState(deckId, cardId)`, `previewIntervals(state, now): Record<Grade, string>`, `studyDay(d): string` in src/lib/scheduler.ts.
- `fetchDeckBundle(uid, deckId)` returns `{deck, cards, states, subscription, newIntroducedToday}`; `persistReview(uid, card, prev, next, grade)` in src/lib/data.ts.
- Types in src/lib/types.ts: `Card = BasicCard | ClozeCard | McqCard | HypoCard`, `Grade`, `CardStateDoc`, `ReviewLogDoc` (already has optional `typedAnswer` and `aiVerdicts` fields).
- `CardView({card, revealed})` renders basic/cloze; `GradeBar({intervals, onGrade})` renders the four grade buttons with `good` highlighted.
- Review.tsx: status machine `'loading' | 'ready' | 'error'`, queue/pos/revealed state, `grade()` callback, keyboard handler (Space reveals, 1-4 grade), currently filters queue to basic/cloze only.

**Test convention:** vitest globals are NOT enabled in this repo. Every test file (including the snippets below, which omit imports for brevity) must start with explicit imports, e.g. `import { describe, it, expect, vi, beforeEach } from 'vitest';` importing exactly the names it uses, matching the existing test files.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| src/lib/schema.ts | Modify | Add cloze clozeIndex-marker superRefine |
| src/lib/schema.test.ts | Modify | Test for the refine |
| src/lib/scheduler.test.ts | Modify | hard-hard-good regression test |
| src/lib/queue.ts | Modify | Hypo session cap + interleaving |
| src/lib/queue.test.ts | Modify | Tests for skip-path, cap, interleave |
| src/lib/alac.ts | Create | ALAC beat metadata, beat score, suggested grade |
| src/lib/alac.test.ts | Create | Tests for score/suggestion mapping |
| src/lib/types.ts | Modify | Export `AiVerdict`, `BeatKey`, `BeatVerdict` aliases |
| src/lib/data.ts | Modify | `persistReview` optional extras (typedAnswer, aiVerdicts) |
| src/components/BasicClozeReview.tsx | Create | Extracted basic/cloze flow (CardView + reveal + GradeBar + keyboard) |
| src/components/McqReview.tsx | Create | MCQ interaction |
| src/components/McqReview.test.tsx | Create | DOM tests |
| src/components/HypoReview.tsx | Create | Hypo ALAC interaction |
| src/components/HypoReview.test.tsx | Create | DOM tests |
| src/components/GradeBar.tsx | Modify | `highlight` prop (default `'good'`), optional `grades` subset |
| src/screens/Review.tsx | Modify | Type routing, cancellation flag, sync indicator, skip-hypos toggle |
| functions/package.json etc. | Create | Cloud Functions package (Node 22, TS) |
| functions/src/grading.ts | Create | Pure grading logic (prompt, schema, client call wrapper) |
| functions/src/grading.test.ts | Create | Unit tests with mocked Anthropic client |
| functions/src/index.ts | Create | `gradeAnswer` onCall: auth, cap, delegate to grading.ts |
| firebase.json | Modify | functions config + functions emulator |
| src/lib/grade.ts | Create | Client callable wrapper with fallback semantics |
| src/lib/grade.test.ts | Create | Fallback behavior tests (mocked callable) |

---

### Task 1: Deferred pickups: cloze-index schema refine + missing regression tests

Small, isolated debt from Plan 1's final review (docs/plan-1-closeout.md: M1, D4, D5). No behavior changes outside schema validation.

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/schema.test.ts`
- Modify: `src/lib/scheduler.test.ts`
- Modify: `src/lib/queue.test.ts`

**Interfaces:**
- Consumes: `cardSchema` (zod discriminated union), `applyReview`/`newCardState` from scheduler, `buildQueue` from queue.
- Produces: no new exports; `cardSchema` now rejects cloze cards whose own `clozeIndex` has no matching marker.

- [ ] **Step 1: Write the failing schema test**

Append to `src/lib/schema.test.ts`:

```typescript
it('rejects a cloze card whose clozeIndex has no matching marker', () => {
  const card = {
    id: 'abc123', type: 'cloze',
    text: 'Venue for real actions is {{c1::where the property is located}}.',
    clozeIndex: 3,
    tags: ['venue'],
    source: { docId: 'doc1', heading: 'Venue' },
  };
  expect(cardSchema.safeParse(card).success).toBe(false);
  expect(cardSchema.safeParse({ ...card, clozeIndex: 1 }).success).toBe(true);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: FAIL (clozeIndex 3 currently passes validation).

- [ ] **Step 3: Add the superRefine to the cloze branch in `src/lib/schema.ts`**

Replace the cloze object in the discriminated union with:

```typescript
  z.object({
    ...baseFields, type: z.literal('cloze'),
    text: clean.refine((t) => /\{\{c\d+::[^}]+\}\}/.test(t), 'cloze text needs at least one {{cN::...}} marker'),
    clozeIndex: z.number().int().min(1),
  }).superRefine((c, ctx) => {
    if (!c.text.includes(`{{c${c.clozeIndex}::`)) {
      ctx.addIssue({ code: 'custom', message: `text has no {{c${c.clozeIndex}::...}} marker for clozeIndex ${c.clozeIndex}` });
    }
  }),
```

Note: zod's `discriminatedUnion` accepts objects wrapped in `superRefine` in zod 4; if the build errors on the union option type, apply the same check via `.check()` or move the union to `z.union` for that branch only. Prefer `superRefine` first.

- [ ] **Step 4: Run schema tests, verify pass**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: PASS (all, including previous cases).

- [ ] **Step 5: Add the hard-hard-good scheduler regression test**

Append to `src/lib/scheduler.test.ts` (inside the existing describe, using the existing `NOW`/`DAY` constants and imports):

```typescript
it('hard-hard-good while learning stays in learning-scale intervals', () => {
  let s = newCardState('d1', 'c1');
  s = applyReview(s, 'hard', NOW);
  s = applyReview(s, 'hard', new Date(NOW.getTime() + 10 * 60 * 1000));
  s = applyReview(s, 'good', new Date(NOW.getTime() + 20 * 60 * 1000));
  expect(s.reps).toBe(3);
  expect(s.lapses).toBe(0);
  expect(s.due).toBeGreaterThan(NOW.getTime() + 20 * 60 * 1000);
});
```

This is the repro class from Plan 1's Task 5 Critical (learningSteps persistence); the two landed regression tests cover good-again-good and triple-again, this adds the hard path. If ts-fsrs graduates the card on the third rating (state `'review'`), that is acceptable; the assertion set above is state-agnostic on purpose. Additionally assert the persisted step field survives the chain: after the second `hard`, `expect(typeof s.learningSteps).toBe('number')`.

- [ ] **Step 6: Add the hypo-skipped-then-cheaper-fits queue test**

Append to `src/lib/queue.test.ts` (reuse the file's existing card factory helpers; if none exist for hypo, build minimal `Card` literals):

```typescript
it('skips a hypo that exceeds remaining budget but still admits a later cheaper card', () => {
  const hypo: Card = {
    id: 'h1', type: 'hypo', facts: 'F', question: 'Q',
    alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
    tags: ['t'], source: { docId: 'd', heading: 'h' },
  };
  const basic: Card = {
    id: 'b1', type: 'basic', front: 'f', back: 'b',
    tags: ['t'], source: { docId: 'd', heading: 'h' },
  };
  const q = buildQueue({
    cards: [hypo, basic], states: new Map(),
    newCardsPerDay: 2, newIntroducedToday: 0, now: new Date(),
  });
  expect(q.map((c) => c.id)).toEqual(['b1']);
});
```

Budget is 2, hypo costs 3 so it is skipped, basic (cost 1) still fits: exercises the `continue` path at queue.ts:26.

- [ ] **Step 7: Run the full suite, verify pass**

Run: `npm test`
Expected: PASS, count increases by 3 tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/schema.ts src/lib/schema.test.ts src/lib/scheduler.test.ts src/lib/queue.test.ts
git commit -m "test: cloze index refine plus scheduler and queue regression coverage"
```

---

### Task 2: Queue hypo session cap and interleaving

Spec 6: "sessions interleave at most a handful of hypos." Cap at 3 hypos per session and spread them through the queue instead of letting them clump.

**Files:**
- Modify: `src/lib/queue.ts`
- Modify: `src/lib/queue.test.ts`

**Interfaces:**
- Consumes: existing `buildQueue` args.
- Produces: same signature `buildQueue(args): Card[]`; new exported constant `MAX_SESSION_HYPOS = 3`. Behavior: at most 3 hypo cards in the returned queue (excess hypos are simply omitted; they remain due and surface next session); hypos are positioned at even intervals through the non-hypo cards; relative order within hypos and within non-hypos is preserved; when at least one non-hypo card is in the queue, the queue never STARTS with a hypo (tail hypos are acceptable when hypos outnumber others, where perfect spreading is impossible). Task 3+ consume `buildQueue` unchanged. (Invariant amended during execution: the original sample code allowed a leading hypo when hypos outnumber others; review round 1 fixed it.)

- [ ] **Step 1: Write failing tests**

Append to `src/lib/queue.test.ts` (a helper making a due state is available in the file from Plan 1 tests; otherwise construct a `CardStateDoc` literal with `due: now - 1000`; copy the field list from `newCardState`'s return shape in src/lib/scheduler.ts, overriding `deckId`/`cardId`/`due`):

```typescript
it('caps hypos at MAX_SESSION_HYPOS per session', () => {
  const mkHypo = (id: string): Card => ({
    id, type: 'hypo', facts: 'F', question: 'Q',
    alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
    tags: ['t'], source: { docId: 'd', heading: 'h' },
  });
  const hypos = ['h1', 'h2', 'h3', 'h4', 'h5'].map(mkHypo);
  const q = buildQueue({
    cards: hypos, states: new Map(),
    newCardsPerDay: 50, newIntroducedToday: 0, now: new Date(),
  });
  expect(q.filter((c) => c.type === 'hypo').length).toBe(3);
});

it('interleaves hypos through the queue instead of clumping them', () => {
  const now = new Date();
  const mkBasic = (id: string): Card => ({
    id, type: 'basic', front: 'f', back: 'b', tags: ['t'], source: { docId: 'd', heading: 'h' },
  });
  const hypo: Card = {
    id: 'h1', type: 'hypo', facts: 'F', question: 'Q',
    alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
    tags: ['t'], source: { docId: 'd', heading: 'h' },
  };
  const cards = [hypo, ...['b1', 'b2', 'b3', 'b4'].map(mkBasic)];
  const q = buildQueue({
    cards, states: new Map(),
    newCardsPerDay: 50, newIntroducedToday: 0, now,
  });
  const hypoPos = q.findIndex((c) => c.id === 'h1');
  expect(hypoPos).toBeGreaterThan(0);
  expect(q.length).toBe(5);
});
```

- [ ] **Step 2: Run, verify both fail**

Run: `npx vitest run src/lib/queue.test.ts`
Expected: FAIL (5 hypos returned; hypo at position 0).

- [ ] **Step 3: Implement cap + interleave in `src/lib/queue.ts`**

Replace the final `return [...dueCards, ...newCards];` with a post-processing step, and export the constant:

```typescript
export const MAX_SESSION_HYPOS = 3;

function interleaveHypos(cards: Card[]): Card[] {
  const hypos = cards.filter((c) => c.type === 'hypo').slice(0, MAX_SESSION_HYPOS);
  const others = cards.filter((c) => c.type !== 'hypo');
  if (hypos.length === 0) return others;
  const out = [...others];
  hypos.forEach((h, i) => {
    const pos = Math.round(((i + 1) * others.length) / (hypos.length + 1)) + i;
    out.splice(Math.min(pos, out.length), 0, h);
  });
  return out;
}
```

and end `buildQueue` with `return interleaveHypos([...dueCards, ...newCards]);`.

- [ ] **Step 4: Run queue tests, verify pass; run full suite**

Run: `npx vitest run src/lib/queue.test.ts && npm test`
Expected: PASS. Check the pre-existing hypo-budget tests still pass (interleaving must not resurrect budget-skipped hypos: the cap applies after budget filtering because `interleaveHypos` receives the already-budgeted list).

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/lib/queue.test.ts
git commit -m "feat: cap and interleave hypos in session queue"
```

---

### Task 3: Review screen refactor: type routing, cancellation, sync indicator, persistReview extras

Restructure Review.tsx so tasks 4 and 5 can drop in McqReview/HypoReview without touching the session logic again. Also lands the Plan 2 pickups routed by the Plan 1 final review: fetch-race cancellation (M6), persistReview `.catch` with a quiet sync indicator (D6), and the grade() re-entrancy comment (D6). Behavior for basic/cloze must be pixel-identical; mcq/hypo are still filtered out of the queue in this task.

**Files:**
- Create: `src/components/BasicClozeReview.tsx`
- Modify: `src/screens/Review.tsx`
- Modify: `src/lib/data.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces (consumed by Tasks 4, 5, 7):
  - `export interface GradeExtras { typedAnswer?: string; aiVerdicts?: AiVerdict[] }` in src/lib/types.ts, plus `export type BeatKey = 'answer' | 'legalBasis' | 'application' | 'conclusion'; export type BeatVerdict = 'got' | 'partial' | 'missed'; export interface AiVerdict { beat: BeatKey; verdict: BeatVerdict; reason: string }` (and change `ReviewLogDoc.aiVerdicts` to `AiVerdict[]` so there is one shape).
  - `persistReview(uid, card, prev, next, grade, extras?: GradeExtras): Promise<void>` in src/lib/data.ts.
  - Review.tsx internal `grade: (g: Grade, extras?: GradeExtras) => void` passed to interaction components as `onGrade`.
  - `BasicClozeReview({ card, intervals, onGrade }: { card: BasicCard | ClozeCard; intervals: Record<Grade, string>; onGrade: (g: Grade) => void })` which owns `revealed` state and the Space/1-4 keyboard handler.

- [ ] **Step 1: Add types**

In `src/lib/types.ts`, replace the inline `aiVerdicts` array type on `ReviewLogDoc` with the named types:

```typescript
export type BeatKey = 'answer' | 'legalBasis' | 'application' | 'conclusion';
export type BeatVerdict = 'got' | 'partial' | 'missed';
export interface AiVerdict { beat: BeatKey; verdict: BeatVerdict; reason: string }
export interface GradeExtras { typedAnswer?: string; aiVerdicts?: AiVerdict[] }
```

and on `ReviewLogDoc`: `aiVerdicts?: AiVerdict[];`.

- [ ] **Step 2: Extend persistReview**

In `src/lib/data.ts`, change the signature to accept `extras?: GradeExtras` and build the log object conditionally (Firestore rejects `undefined` values, so omit absent fields):

```typescript
export async function persistReview(
  uid: string, card: Card, prev: CardStateDoc | undefined, next: CardStateDoc,
  grade: Grade, extras?: GradeExtras,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'cardStates', stateId(next.deckId, next.cardId)), next);
  const log: Record<string, unknown> = {
    cardId: next.cardId, deckId: next.deckId, grade, tags: card.tags,
    ts: Date.now(), firstReview: prev === undefined, createdAt: serverTimestamp(),
  };
  if (extras?.typedAnswer) log.typedAnswer = extras.typedAnswer;
  if (extras?.aiVerdicts) log.aiVerdicts = extras.aiVerdicts;
  batch.set(doc(collection(db, 'users', uid, 'reviewLogs')), log);
  await batch.commit();
}
```

- [ ] **Step 3: Create BasicClozeReview.tsx**

Move the reveal/keyboard/GradeBar flow out of Review.tsx verbatim (this is a refactor, not a redesign):

```tsx
import { useEffect, useState } from 'react';
import CardView from './CardView';
import GradeBar from './GradeBar';
import type { BasicCard, ClozeCard, Grade } from '../lib/types';

export default function BasicClozeReview({ card, intervals, onGrade }: {
  card: BasicCard | ClozeCard;
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [card.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setRevealed(true); }
      const map: Record<string, Grade> = { Digit1: 'again', Digit2: 'hard', Digit3: 'good', Digit4: 'easy' };
      if (revealed && map[e.code]) onGrade(map[e.code]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, onGrade]);
  return (
    <>
      <div onClick={() => setRevealed(true)}>
        <CardView card={card} revealed={revealed} />
        {!revealed && <p className="text-center text-sm opacity-50 mt-3">tap or press space to reveal</p>}
      </div>
      {revealed && <GradeBar intervals={intervals} onGrade={onGrade} />}
    </>
  );
}
```

- [ ] **Step 4: Rewrite Review.tsx**

Keep the status machine, the `again` re-queue rule, and the deck-not-found handling identical. New pieces: cancellation flag in the load effect, `syncIssue` state fed by `persistReview(...).catch`, type routing (mcq/hypo render a placeholder until tasks 4/5 replace it), extras threaded through `grade`:

```tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchDeckBundle, persistReview } from '../lib/data';
import { buildQueue } from '../lib/queue';
import { applyReview, newCardState, previewIntervals } from '../lib/scheduler';
import BasicClozeReview from '../components/BasicClozeReview';
import type { Card, CardStateDoc, Grade, GradeExtras } from '../lib/types';

export default function Review() {
  const { deckId = '' } = useParams();
  const { user } = useUser();
  const [queue, setQueue] = useState<Card[]>([]);
  const [states, setStates] = useState<Map<string, CardStateDoc>>(new Map());
  const [pos, setPos] = useState(0);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [syncIssue, setSyncIssue] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setStatus('loading');
    void fetchDeckBundle(user.uid, deckId).then((b) => {
      if (cancelled) return;
      setTitle(b.deck.title);
      setStates(b.states);
      setPos(0);
      setQueue(buildQueue({
        cards: b.cards.filter((c) => c.type === 'basic' || c.type === 'cloze'),
        states: b.states,
        newCardsPerDay: b.subscription?.newCardsPerDay ?? 15,
        newIntroducedToday: b.newIntroducedToday,
        now: new Date(),
      }));
      setStatus('ready');
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [user, deckId]);

  const card = queue[pos];
  const state = card ? states.get(card.id) : undefined;
  const intervals = useMemo(
    () => (card ? previewIntervals(state ?? newCardState(deckId, card.id), new Date()) : null),
    [card, state, deckId],
  );

  // Re-entrancy: unreachable via normal input. React 18 flushes state updates
  // before the next discrete event and the grading UI unmounts after each
  // grade, so key repeat or double click cannot double-grade a card.
  const grade = useCallback((g: Grade, extras?: GradeExtras) => {
    if (!card || !user) return;
    const prev = states.get(card.id);
    const next = applyReview(prev ?? newCardState(deckId, card.id), g, new Date());
    persistReview(user.uid, card, prev, next, g, extras).catch(() => setSyncIssue(true));
    setStates((m) => new Map(m).set(card.id, next));
    if (g === 'again') {
      setQueue((q) => [...q.slice(0, pos), ...q.slice(pos + 1), card]);
    } else {
      setPos((p) => p + 1);
    }
  }, [card, user, states, deckId, pos]);

  if (status === 'loading') return <p className="p-6 text-sm opacity-60">Loading...</p>;

  if (status === 'error') {
    return (
      <main className="max-w-xl mx-auto p-4">
        <p className="mb-4">This deck could not be loaded. It may have been removed.</p>
        <Link className="underline text-maroon" to="/">Back to decks</Link>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="max-w-xl mx-auto p-4">
        <p className="mb-4">Done for now. Nothing due in this deck.</p>
        <Link className="underline text-maroon" to="/">Back to decks</Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto p-4 flex flex-col gap-4">
      <header className="flex justify-between text-sm opacity-70">
        <Link to="/" className="underline">{title}</Link>
        <span>
          {syncIssue && <span className="text-maroon mr-2">sync pending</span>}
          {pos + 1} / {queue.length}
        </span>
      </header>
      {(card.type === 'basic' || card.type === 'cloze') && intervals && (
        <BasicClozeReview card={card} intervals={intervals} onGrade={grade} />
      )}
      {(card.type === 'mcq' || card.type === 'hypo') && (
        <div className="border border-mustard rounded-lg p-4 text-sm opacity-70">
          {card.type.toUpperCase()} cards arrive in the next milestone.
        </div>
      )}
    </main>
  );
}
```

Note the deliberate change: `revealed` no longer lives in Review.tsx (it moved into BasicClozeReview, keyed-reset on `card.id`), so the placeholder branch cannot leak reveal state between card types.

- [ ] **Step 5: Verify no behavior change**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit`
Expected: all pass (CardView.test.tsx and the suite are unaffected). Then run `npm run dev` with emulators per README (export PATH for openjdk, `firebase emulators:start --only auth,firestore` + `npm run seed`), review two basic/cloze cards end to end, confirm grade bar under card, keyboard flow, and the again-requeue.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/data.ts src/components/BasicClozeReview.tsx src/screens/Review.tsx
git commit -m "refactor: route review by card type with sync indicator and fetch cancellation"
```

---

### Task 4: MCQ review UI

Spec 5 mcq: stem, choices, correctIndex, explanation, optional barYear. Auto-graded: wrong maps to Again; right defaults to Good, adjustable to Hard/Easy.

**Files:**
- Create: `src/components/McqReview.tsx`
- Create: `src/components/McqReview.test.tsx`
- Modify: `src/components/GradeBar.tsx`
- Modify: `src/screens/Review.tsx` (route mcq; include mcq in queue filter)

Note: scripts/seed.mts ALREADY seeds one mcq card (piercing-elements, correctIndex 3, barYear 2012) and one hypo card (Manchester docket fees); do not add more seed cards. Use those for the emulator smoke checks.

**Interfaces:**
- Consumes: `McqCard`, `Grade`, `GradeBar`, Review's `onGrade(g)`.
- Produces: `McqReview({ card, intervals, onGrade }: { card: McqCard; intervals: Record<Grade, string>; onGrade: (g: Grade) => void })`. `GradeBar` gains optional props `highlight?: Grade` (default `'good'`) and `grades?: Grade[]` (default all four) so MCQ can show only Hard/Good/Easy.

- [ ] **Step 1: Extend GradeBar (no test change needed; existing render is default path)**

```tsx
import type { Grade } from '../lib/types';

const ALL: Grade[] = ['again', 'hard', 'good', 'easy'];
const LABELS: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const KEYS: Record<Grade, number> = { again: 1, hard: 2, good: 3, easy: 4 };

export default function GradeBar({ intervals, onGrade, highlight = 'good', grades = ALL }: {
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
  highlight?: Grade;
  grades?: Grade[];
}) {
  return (
    <div className="flex gap-2">
      {grades.map((g) => (
        <button
          key={g}
          onClick={() => onGrade(g)}
          className={
            'flex-1 rounded-lg py-2 text-sm ' +
            (g === highlight
              ? 'bg-mustard text-maroon font-semibold border-2 border-maroon'
              : 'border border-gray-400/60')
          }
        >
          {LABELS[g]}
          <span className="block text-xs opacity-80">{intervals[g]} ({KEYS[g]})</span>
        </button>
      ))}
    </div>
  );
}
```

(The keyboard hint number stays tied to the grade, not the position, so `Hard` always shows `(2)`.)

- [ ] **Step 2: Write failing DOM tests**

`src/components/McqReview.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import McqReview from './McqReview';
import type { McqCard, Grade } from '../lib/types';

const card: McqCard = {
  id: 'm1', type: 'mcq',
  stem: 'Where must a real action be filed?',
  choices: ['Where the plaintiff resides', 'Where the property is located', 'Anywhere the parties agree', 'Where the defendant resides'],
  correctIndex: 1,
  explanation: 'Real actions are filed where the property or any part of it is situated.',
  tags: ['venue'], source: { docId: 'd', heading: 'Venue' },
};
const intervals: Record<Grade, string> = { again: '1m', hard: '6m', good: '10m', easy: '4d' };

it('wrong choice reveals correctness, shows explanation, and grades Again on continue', () => {
  const onGrade = vi.fn();
  render(<McqReview card={card} intervals={intervals} onGrade={onGrade} />);
  fireEvent.click(screen.getByText('Anywhere the parties agree'));
  expect(screen.getByText(/Real actions are filed/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next card/i }));
  expect(onGrade).toHaveBeenCalledWith('again');
});

it('right choice defaults to Good but allows Hard and Easy', () => {
  const onGrade = vi.fn();
  render(<McqReview card={card} intervals={intervals} onGrade={onGrade} />);
  fireEvent.click(screen.getByText('Where the property is located'));
  expect(screen.queryByRole('button', { name: /Again/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Easy/ }));
  expect(onGrade).toHaveBeenCalledWith('easy');
});

it('selects a choice with number keys', () => {
  const onGrade = vi.fn();
  render(<McqReview card={card} intervals={intervals} onGrade={onGrade} />);
  fireEvent.keyDown(window, { code: 'Digit2' });
  expect(screen.getByText(/Real actions are filed/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npx vitest run src/components/McqReview.test.tsx`
Expected: FAIL (module does not exist).

- [ ] **Step 4: Implement McqReview.tsx**

```tsx
import { useEffect, useState } from 'react';
import GradeBar from './GradeBar';
import type { Grade, McqCard } from '../lib/types';

export default function McqReview({ card, intervals, onGrade }: {
  card: McqCard;
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => { setPicked(null); }, [card.id]);
  const answered = picked !== null;
  const correct = answered && picked === card.correctIndex;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answered) return;
      const m = /^Digit([1-9])$/.exec(e.code);
      if (m) {
        const i = Number(m[1]) - 1;
        if (i < card.choices.length) setPicked(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, card.choices.length]);

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{card.stem}</p>
        {card.barYear && <p className="text-xs opacity-60 mt-1">Bar {card.barYear}</p>}
        <ol className="mt-3 flex flex-col gap-2">
          {card.choices.map((choice, i) => {
            let cls = 'border border-gray-400/60';
            if (answered && i === card.correctIndex) cls = 'border-2 border-green-700';
            else if (answered && i === picked) cls = 'border-2 border-red-700';
            return (
              <li key={i}>
                <button
                  className={'w-full text-left rounded-lg px-3 py-2 ' + cls}
                  disabled={answered}
                  onClick={() => setPicked(i)}
                >
                  <span className="opacity-60 mr-2">{i + 1}.</span>{choice}
                </button>
              </li>
            );
          })}
        </ol>
        {answered && (
          <p className="mt-3 pl-3 border-l-4 border-mustard text-sm">{card.explanation}</p>
        )}
      </div>
      {answered && !correct && (
        <button
          className="rounded-lg py-2 bg-mustard text-maroon font-semibold border-2 border-maroon"
          onClick={() => onGrade('again')}
        >
          Next card ({intervals.again})
        </button>
      )}
      {answered && correct && (
        <GradeBar intervals={intervals} onGrade={onGrade} grades={['hard', 'good', 'easy']} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Route mcq in Review.tsx**

In the load effect change the queue filter to `c.type === 'basic' || c.type === 'cloze' || c.type === 'mcq'`, and replace the placeholder branch's mcq half with (NOTE, amended during execution: every interaction component must carry the remount key `key={card.id + '-' + round}` using the `round` counter Task 3's fix round added to Review.tsx, so per-card state always resets even when an again-requeue lands the same card in the same slot):

```tsx
{card.type === 'mcq' && intervals && (
  <McqReview key={card.id + '-' + round} card={card} intervals={intervals} onGrade={grade} />
)}
{card.type === 'hypo' && (
  <div className="border border-mustard rounded-lg p-4 text-sm opacity-70">
    HYPO cards arrive in the next milestone.
  </div>
)}
```

(import McqReview).

- [ ] **Step 6: Run everything**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS. Then emulator smoke using the already-seeded mcq card (piercing-elements): answer it wrong (see red/green outlines + explanation callout + Again-only button), then re-review and answer right (Hard/Good/Easy with Good highlighted, Again absent).

- [ ] **Step 7: Commit**

```bash
git add src/components/McqReview.tsx src/components/McqReview.test.tsx src/components/GradeBar.tsx src/screens/Review.tsx
git commit -m "feat: mcq review with auto-grading"
```

---

### Task 5: Hypo review UI with manual ALAC checklist

Spec 5/5a manual path: read hypo, optionally type an answer, reveal the model answer beat by beat, mark each beat got/partial/missed, the beat score suggests the rating, user confirms. Provenance after reveal: doctrine capsule and Lawphil link. Also: the skip-hypos toggle (spec 6) and the suggested-grade mapping.

**Files:**
- Create: `src/lib/alac.ts`
- Create: `src/lib/alac.test.ts`
- Create: `src/components/HypoReview.tsx`
- Create: `src/components/HypoReview.test.tsx`
- Modify: `src/screens/Review.tsx` (route hypo; include hypo in queue; skip-hypos toggle)

Note: scripts/seed.mts ALREADY seeds one hypo card (Manchester docket fees, with caseTitle/grNumber and doctrine, no lawphilPdfUrl); use it for the emulator smoke. Do not add seed cards.

**Interfaces:**
- Produces:
  - `src/lib/alac.ts`: `export const BEATS: { key: BeatKey; label: string }[]` (Answer, Legal Basis, Application, Conclusion in that order); `export function beatScore(marks: Record<BeatKey, BeatVerdict>): number` (got=1, partial=0.5, missed=0, summed, 0..4); `export function suggestedGrade(score: number): Grade` with mapping: score >= 3.5 -> 'good', score >= 2 -> 'hard', else 'again'. 'easy' is never suggested; the user can still pick it. This mapping is a design decision of this plan; record deviations in the ledger, not silently.
  - `HypoReview({ card, intervals, onGrade, aiCheck }: { card: HypoCard; intervals: Record<Grade, string>; onGrade: (g: Grade, extras?: GradeExtras) => void; aiCheck?: (typedAnswer: string, card: HypoCard) => Promise<AiVerdict[] | null> })`. `aiCheck` is optional and unused until Task 7; `null` result means "AI unavailable, stay manual."
- Consumes: `GradeBar` with `highlight` prop, `GradeExtras`.

- [ ] **Step 1: alac.ts tests first**

`src/lib/alac.test.ts`:

```typescript
import { beatScore, suggestedGrade, BEATS } from './alac';

it('scores beats got=1 partial=0.5 missed=0', () => {
  expect(beatScore({ answer: 'got', legalBasis: 'partial', application: 'missed', conclusion: 'got' })).toBe(2.5);
});

it('suggests good at 3.5+, hard at 2+, again below', () => {
  expect(suggestedGrade(4)).toBe('good');
  expect(suggestedGrade(3.5)).toBe('good');
  expect(suggestedGrade(3)).toBe('hard');
  expect(suggestedGrade(2)).toBe('hard');
  expect(suggestedGrade(1.5)).toBe('again');
});

it('lists the four beats in ALAC order', () => {
  expect(BEATS.map((b) => b.key)).toEqual(['answer', 'legalBasis', 'application', 'conclusion']);
});
```

- [ ] **Step 2: Run (fail), implement `src/lib/alac.ts`, run (pass)**

```typescript
import type { BeatKey, BeatVerdict, Grade } from './types';

export const BEATS: { key: BeatKey; label: string }[] = [
  { key: 'answer', label: 'Answer' },
  { key: 'legalBasis', label: 'Legal Basis' },
  { key: 'application', label: 'Application' },
  { key: 'conclusion', label: 'Conclusion' },
];

const POINTS: Record<BeatVerdict, number> = { got: 1, partial: 0.5, missed: 0 };

export function beatScore(marks: Record<BeatKey, BeatVerdict>): number {
  return BEATS.reduce((sum, b) => sum + POINTS[marks[b.key]], 0);
}

export function suggestedGrade(score: number): Grade {
  if (score >= 3.5) return 'good';
  if (score >= 2) return 'hard';
  return 'again';
}
```

Run: `npx vitest run src/lib/alac.test.ts` -> PASS.

- [ ] **Step 3: HypoReview DOM tests (failing)**

`src/components/HypoReview.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import HypoReview from './HypoReview';
import type { HypoCard, Grade } from '../lib/types';

const card: HypoCard = {
  id: 'hy1', type: 'hypo',
  facts: 'P sued D in Manila RTC over land in Cebu.',
  question: 'Was venue proper?',
  alac: {
    answer: 'No, venue was improper.',
    legalBasis: 'Under Rule 4, Sec. 1, real actions must be filed where the property is situated (Latorre v. Latorre, G.R. No. 183926).',
    application: 'In this case, the land is in Cebu, so the action should have been filed there.',
    conclusion: 'Hence, venue was improperly laid, and the complaint was dismissible on timely objection.',
  },
  doctrine: 'Venue of real actions lies where the property is situated.',
  tags: ['venue'], source: { docId: 'd', heading: 'Venue', lawphilPdfUrl: 'https://example.com/case.pdf' },
};
const intervals: Record<Grade, string> = { again: '1m', hard: '6m', good: '10m', easy: '4d' };

function revealAll() {
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
}

it('reveals beats one at a time', () => {
  render(<HypoReview card={card} intervals={intervals} onGrade={vi.fn()} />);
  expect(screen.queryByText(/venue was improper/i)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
  expect(screen.getByText('No, venue was improper.')).toBeInTheDocument();
  expect(screen.queryByText(/Latorre/)).toBeNull();
});

it('after marking all beats, suggests the mapped grade and confirms with extras', () => {
  const onGrade = vi.fn();
  render(<HypoReview card={card} intervals={intervals} onGrade={onGrade} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Venue improper, real action.' } });
  revealAll();
  const gotButtons = screen.getAllByRole('button', { name: 'Got it' });
  expect(gotButtons.length).toBe(4);
  gotButtons.forEach((b) => fireEvent.click(b));
  fireEvent.click(screen.getByRole('button', { name: /Good/ }));
  expect(onGrade).toHaveBeenCalledWith('good', { typedAnswer: 'Venue improper, real action.' });
});

it('shows provenance after full reveal', () => {
  render(<HypoReview card={card} intervals={intervals} onGrade={vi.fn()} />);
  revealAll();
  expect(screen.getByText(/Venue of real actions lies/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /case pdf/i })).toHaveAttribute('href', 'https://example.com/case.pdf');
});
```

- [ ] **Step 4: Implement HypoReview.tsx**

```tsx
import { useEffect, useState } from 'react';
import GradeBar from './GradeBar';
import { BEATS, beatScore, suggestedGrade } from '../lib/alac';
import type { AiVerdict, BeatKey, BeatVerdict, Grade, GradeExtras, HypoCard } from '../lib/types';

const VERDICTS: { v: BeatVerdict; label: string }[] = [
  { v: 'got', label: 'Got it' },
  { v: 'partial', label: 'Partial' },
  { v: 'missed', label: 'Missed' },
];

export default function HypoReview({ card, intervals, onGrade, aiCheck }: {
  card: HypoCard;
  intervals: Record<Grade, string>;
  onGrade: (g: Grade, extras?: GradeExtras) => void;
  aiCheck?: (typedAnswer: string, card: HypoCard) => Promise<AiVerdict[] | null>;
}) {
  const [typed, setTyped] = useState('');
  const [revealedBeats, setRevealedBeats] = useState(0);
  const [marks, setMarks] = useState<Partial<Record<BeatKey, BeatVerdict>>>({});
  const [verdicts, setVerdicts] = useState<AiVerdict[] | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    setTyped(''); setRevealedBeats(0); setMarks({}); setVerdicts(null); setChecking(false);
  }, [card.id]);

  const allRevealed = revealedBeats >= BEATS.length;
  const allMarked = BEATS.every((b) => marks[b.key] !== undefined);
  const score = allMarked ? beatScore(marks as Record<BeatKey, BeatVerdict>) : null;

  const runAiCheck = async () => {
    if (!aiCheck || !typed.trim()) return;
    setChecking(true);
    const result = await aiCheck(typed, card);
    setChecking(false);
    if (result) {
      setVerdicts(result);
      setMarks(Object.fromEntries(result.map((r) => [r.beat, r.verdict])));
    }
  };

  const confirm = (g: Grade) => {
    const extras: GradeExtras = {};
    if (typed.trim()) extras.typedAnswer = typed.trim();
    if (verdicts) extras.aiVerdicts = verdicts;
    onGrade(g, Object.keys(extras).length ? extras : undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{card.facts}</p>
        <p className="mt-2 font-semibold">{card.question}</p>
      </div>

      {!allRevealed && (
        <textarea
          className="border border-gray-400/60 rounded-lg p-3 text-sm min-h-24"
          placeholder="Type your answer (optional)"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      )}

      {BEATS.slice(0, revealedBeats).map((b) => {
        const av = verdicts?.find((v) => v.beat === b.key);
        return (
          <div key={b.key} className="border border-gray-400/60 rounded-lg p-3">
            <p className="text-xs uppercase opacity-60">{b.label}</p>
            <p className="mt-1">{card.alac[b.key]}</p>
            {allRevealed && (
              <div className="mt-2 flex gap-2 items-center">
                {VERDICTS.map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setMarks((m) => ({ ...m, [b.key]: v }))}
                    className={
                      'rounded px-2 py-1 text-xs border ' +
                      (marks[b.key] === v
                        ? v === 'got' ? 'border-2 border-green-700 font-semibold'
                          : v === 'missed' ? 'border-2 border-red-700 font-semibold'
                          : 'border-2 border-maroon font-semibold'
                        : 'border-gray-400/60')
                    }
                  >
                    {label}
                  </button>
                ))}
                {av && <span className="text-xs opacity-60">AI: {av.reason}</span>}
              </div>
            )}
          </div>
        );
      })}

      {!allRevealed && (
        <button
          className="rounded-lg py-2 bg-mustard text-maroon font-semibold border-2 border-maroon"
          onClick={() => setRevealedBeats((n) => n + 1)}
        >
          Reveal {revealedBeats === 0 ? 'answer' : 'next beat'}
        </button>
      )}

      {allRevealed && (
        <>
          {card.doctrine && (
            <p className="pl-3 border-l-4 border-mustard text-sm">{card.doctrine}</p>
          )}
          {card.source.lawphilPdfUrl && (
            <a
              className="text-sm underline text-maroon"
              href={card.source.lawphilPdfUrl}
              target="_blank" rel="noreferrer"
            >
              Case PDF
            </a>
          )}
          {aiCheck && typed.trim() && !verdicts && (
            <button
              className="rounded-lg py-2 border border-gray-400/60 text-sm"
              onClick={runAiCheck}
              disabled={checking}
            >
              {checking ? 'Checking...' : 'AI check my answer'}
            </button>
          )}
          {allMarked && score !== null && (
            <GradeBar intervals={intervals} onGrade={confirm} highlight={suggestedGrade(score)} />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run component tests**

Run: `npx vitest run src/components/HypoReview.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire into Review.tsx: route + queue + skip toggle**

- Queue filter becomes: `skipHypos ? b.cards.filter((c) => c.type !== 'hypo') : b.cards` where `skipHypos` is new state `const [skipHypos, setSkipHypos] = useState(false);` added to the load effect deps so toggling reloads the queue. (buildQueue also accepts `skipHypos`; pass it instead of pre-filtering: `buildQueue({ cards: b.cards, ..., skipHypos })`.)
- Replace the hypo placeholder branch with `<HypoReview key={card.id + '-' + round} card={card} intervals={intervals} onGrade={grade} />` (no `aiCheck` yet; the remount key uses the `round` counter from Task 3's fix, same pattern as McqReview).
- Header toggle (plain SVG-free text button, right of the count):

```tsx
<button
  className={'underline mr-3 ' + (skipHypos ? 'text-maroon font-semibold' : '')}
  onClick={() => setSkipHypos((s) => !s)}
>
  {skipHypos ? 'hypos off' : 'skip hypos'}
</button>
```

Place it inside the header span before `syncIssue`. Toggling mid-session reloads the queue (acceptable: pos resets to 0 via the load effect).

- [ ] **Step 7: Full suite + emulator smoke**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit`
Then emulator, using the already-seeded Manchester hypo: review it end to end (type answer, reveal 4 beats, mark, confirm suggested grade, check the review log doc in the emulator UI contains `typedAnswer`), and verify the skip-hypos toggle removes it from the session.

- [ ] **Step 8: Commit**

```bash
git add src/lib/alac.ts src/lib/alac.test.ts src/components/HypoReview.tsx src/components/HypoReview.test.tsx src/screens/Review.tsx
git commit -m "feat: hypo review with alac checklist and skip toggle"
```

---

### Task 6: gradeAnswer Cloud Function

Spec 5a. New `functions/` package. The handler: require auth, enforce the 50/day cap in Firestore via Admin SDK, call Claude Haiku with structured output, return per-beat verdicts. Pure logic lives in `grading.ts` so it is unit-testable with a mocked Anthropic client; `index.ts` is thin.

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/.gitignore`
- Create: `functions/src/grading.ts`
- Create: `functions/src/grading.test.ts`
- Create: `functions/src/index.ts`
- Modify: `firebase.json`

**Interfaces:**
- Produces (consumed by Task 7's client):
  - Callable name: `gradeAnswer`, region `us-central1` (v2 default).
  - Request data: `{ typedAnswer: string, alac: { answer, legalBasis, application, conclusion }, caseTitle?: string, grNumber?: string }`.
  - Response data: `{ verdicts: AiVerdict[] }` with exactly 4 entries, beats in ALAC order.
  - Errors: `unauthenticated` (no auth), `invalid-argument` (bad payload), `resource-exhausted` (daily cap), `unavailable` (Anthropic API failure). The client maps every error to manual fallback.
- Firestore usage doc (Admin SDK, bypasses rules; not client-readable and does not need rules changes): `users/{uid}/gradingUsage/{YYYY-MM-DD}` with `{ count: number }`, day computed with the same 4 a.m. shift as `studyDay` (re-implement the 3-line helper in grading.ts; functions cannot import from src/).

- [ ] **Step 1: Scaffold the package**

`functions/package.json`:

```json
{
  "name": "lawdeck-functions",
  "private": true,
  "type": "module",
  "engines": { "node": "22" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.60.0",
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "~6.0.2",
    "vitest": "^4.0.0"
  }
}
```

(Implementer: run `npm install` inside functions/ and let npm resolve current compatible versions; if `firebase deploy` later complains about the `firebase-functions` version, take its suggested range. Check the installed `@anthropic-ai/sdk` version supports `client.messages.parse`; if not, use `client.messages.create` with `output_config.format` and `JSON.parse` + zod-validate the text block instead. Either path must end with a zod-validated `AiVerdict[]`.)

`functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "lib",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`functions/.gitignore`: `lib/` and `node_modules/`.

In root `firebase.json` add:

```json
"functions": { "source": "functions", "runtime": "nodejs22" }
```

and add `"functions": { "port": 5001 }` to the emulators block.

- [ ] **Step 2: Write failing unit tests for the pure logic**

`functions/src/grading.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, gradeWithClient, verdictsSchema, gradingDay } from './grading';

const input = {
  typedAnswer: 'Venue improper because real action; file where land is.',
  alac: {
    answer: 'Yes, the motion should be granted.',
    legalBasis: 'Rule 4 Sec. 1; Latorre v. Latorre, G.R. No. 183926.',
    application: 'The land is in Cebu so venue lies there.',
    conclusion: 'Hence venue was improperly laid.',
  },
  caseTitle: 'Latorre v. Latorre',
  grNumber: 'G.R. No. 183926',
};

it('prompt includes the citation rule and all four beats', () => {
  const p = buildPrompt(input);
  expect(p).toContain('partial');
  expect(p).toContain('Latorre');
  expect(p).toContain(input.alac.conclusion);
  expect(p.toLowerCase()).toContain('citation');
});

it('gradeWithClient returns schema-valid verdicts from a mocked client', async () => {
  const fake = {
    verdicts: [
      { beat: 'answer', verdict: 'got', reason: 'Correct conclusion.' },
      { beat: 'legalBasis', verdict: 'partial', reason: 'Rule cited without the case.' },
      { beat: 'application', verdict: 'got', reason: 'Applied facts.' },
      { beat: 'conclusion', verdict: 'got', reason: 'Restated resolution.' },
    ],
  };
  const client = { messages: { parse: vi.fn().mockResolvedValue({ parsed_output: fake }) } };
  const out = await gradeWithClient(client as never, input);
  expect(verdictsSchema.parse(out)).toEqual(fake);
});

it('gradingDay rolls over at 4am', () => {
  expect(gradingDay(new Date('2026-07-30T02:30:00+08:00'))).toBe('2026-07-29');
  expect(gradingDay(new Date('2026-07-30T05:00:00+08:00'))).toBe('2026-07-30');
});
```

Note: functions tests run under the functions package's own vitest (node environment, no jsdom, no TZ pin needed for the first two tests; for `gradingDay`, set `TZ: 'Asia/Manila'` via `env` in a `functions/vitest.config.ts` mirroring the root config's pin).

- [ ] **Step 3: Run (fail), implement `functions/src/grading.ts`**

```typescript
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

export const inputSchema = z.object({
  typedAnswer: z.string().min(1).max(8000),
  alac: z.object({
    answer: z.string().min(1),
    legalBasis: z.string().min(1),
    application: z.string().min(1),
    conclusion: z.string().min(1),
  }),
  caseTitle: z.string().optional(),
  grNumber: z.string().optional(),
});
export type GradeInput = z.infer<typeof inputSchema>;

export const verdictsSchema = z.object({
  verdicts: z.array(z.object({
    beat: z.enum(['answer', 'legalBasis', 'application', 'conclusion']),
    verdict: z.enum(['got', 'partial', 'missed']),
    reason: z.string(),
  })).length(4),
});
export type Verdicts = z.infer<typeof verdictsSchema>;

export const DAILY_CAP = 50;
export const MODEL = 'claude-haiku-4-5';

// Same 4am local rollover as the app's studyDay; duplicated because the
// functions package cannot import from src/.
export function gradingDay(d: Date): string {
  const s = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
}

export function buildPrompt(input: GradeInput): string {
  const cite = [input.caseTitle, input.grNumber].filter(Boolean).join(', ');
  return [
    'You are grading a law student\'s answer to a hypothetical against a model answer with four ALAC beats.',
    'For each beat return a verdict: "got" (substance present), "partial" (incomplete or imprecise), or "missed" (absent or wrong), with a one-line reason.',
    'Substance matters, not wording; the student\'s answer need not be verbatim.',
    'Citation rule: on the legalBasis beat, if the student states the rule but omits its source (the case name or codal article), the verdict is at most "partial".',
    cite ? `The controlling authority is ${cite}.` : '',
    '',
    'Model answer beats:',
    `answer: ${input.alac.answer}`,
    `legalBasis: ${input.alac.legalBasis}`,
    `application: ${input.alac.application}`,
    `conclusion: ${input.alac.conclusion}`,
    '',
    'Student answer:',
    input.typedAnswer,
    '',
    'Return verdicts for all four beats in ALAC order.',
  ].filter((l) => l !== '').join('\n');
}

const OUTPUT_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            beat: { type: 'string', enum: ['answer', 'legalBasis', 'application', 'conclusion'] },
            verdict: { type: 'string', enum: ['got', 'partial', 'missed'] },
            reason: { type: 'string' },
          },
          required: ['beat', 'verdict', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['verdicts'],
    additionalProperties: false,
  },
};

export async function gradeWithClient(client: Anthropic, input: GradeInput): Promise<Verdicts> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(input) }],
    output_config: { format: OUTPUT_FORMAT },
  });
  return verdictsSchema.parse(response.parsed_output);
}
```

(If the installed SDK's `parse` signature differs, fall back to `messages.create` with the same `output_config`, then `verdictsSchema.parse(JSON.parse(textBlock.text))` where textBlock is the first content block with `type === 'text'`. The unit test then mocks `messages.create` instead; keep the test asserting the same zod-validated output.)

- [ ] **Step 4: Run functions unit tests**

Run: `cd functions && npm install && npm test`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `functions/src/index.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';
import { inputSchema, gradeWithClient, gradingDay, DAILY_CAP } from './grading.js';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
initializeApp();

export const gradeAnswer = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const parsed = inputSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad grading payload.');

  const db = getFirestore();
  const day = gradingDay(new Date());
  const usageRef = db.doc(`users/${uid}/gradingUsage/${day}`);
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const count = (snap.data()?.count as number | undefined) ?? 0;
    if (count >= DAILY_CAP) return false;
    tx.set(usageRef, { count: FieldValue.increment(1) }, { merge: true });
    return true;
  });
  if (!allowed) throw new HttpsError('resource-exhausted', 'Daily grading limit reached.');

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  try {
    return await gradeWithClient(client, parsed.data);
  } catch {
    throw new HttpsError('unavailable', 'Grading is unavailable right now.');
  }
});
```

- [ ] **Step 6: Build and verify TypeScript**

Run: `cd functions && npm run build`
Expected: clean compile (strict).

- [ ] **Step 7: Emulator smoke (manual, no committed test)**

Create `functions/.secret.local` containing `ANTHROPIC_API_KEY=sk-ant-PLACEHOLDER` (git-ignored: add `.secret.local` to functions/.gitignore). Run `firebase emulators:start --only auth,firestore,functions` and confirm the function loads without error. A real end-to-end call happens in Task 8 with the real key. Verify the unauthenticated path now: from a node REPL or curl to the emulator callable URL without a token, expect the unauthenticated error envelope.

- [ ] **Step 8: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/tsconfig.json functions/.gitignore functions/src firebase.json
git commit -m "feat: gradeAnswer cloud function with daily cap and structured output"
```

---

### Task 7: Client integration of AI grading with fallbacks

Wire the callable into HypoReview through Review.tsx. Every failure path degrades to manual checklist without blocking (spec 5a fallbacks).

**Files:**
- Create: `src/lib/grade.ts`
- Create: `src/lib/grade.test.ts`
- Modify: `src/lib/firebase.ts` (export `fns` functions instance)
- Modify: `src/screens/Review.tsx` (pass `aiCheck` to HypoReview)

**Interfaces:**
- Consumes: Task 6's callable contract; Task 5's `aiCheck?: (typedAnswer, card) => Promise<AiVerdict[] | null>` prop.
- Produces: `export async function requestAiGrading(typedAnswer: string, card: HypoCard): Promise<AiVerdict[] | null>` in src/lib/grade.ts. Returns `null` on ANY failure (offline, unauthenticated, cap, unavailable, malformed response); never throws.

- [ ] **Step 1: Export functions instance**

In `src/lib/firebase.ts`, alongside the existing `db`/`auth` exports:

```typescript
import { getFunctions } from 'firebase/functions';
export const fns = getFunctions(app);
```

(match the existing app variable name in that file). If the file wires emulators when `import.meta.env.DEV` or an emulator flag is set (read it first), also add `connectFunctionsEmulator(fns, 'localhost', 5001)` under the same condition.

- [ ] **Step 2: Failing tests for the wrapper**

`src/lib/grade.test.ts` (mock the firebase/functions module; do not hit the network):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const httpsCallableMock = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: () => httpsCallableMock,
}));
vi.mock('./firebase', () => ({ fns: {} }));

import { requestAiGrading } from './grade';
import type { HypoCard } from './types';

const card: HypoCard = {
  id: 'h', type: 'hypo', facts: 'F', question: 'Q',
  alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
  tags: ['t'], source: { docId: 'd', heading: 'h', caseTitle: 'X v. Y', grNumber: 'G.R. No. 1' },
};

beforeEach(() => httpsCallableMock.mockReset());

it('returns verdicts on success', async () => {
  const verdicts = [
    { beat: 'answer', verdict: 'got', reason: 'r' },
    { beat: 'legalBasis', verdict: 'partial', reason: 'r' },
    { beat: 'application', verdict: 'got', reason: 'r' },
    { beat: 'conclusion', verdict: 'missed', reason: 'r' },
  ];
  httpsCallableMock.mockResolvedValue({ data: { verdicts } });
  expect(await requestAiGrading('my answer', card)).toEqual(verdicts);
});

it('returns null when the callable rejects', async () => {
  httpsCallableMock.mockRejectedValue(new Error('unavailable'));
  expect(await requestAiGrading('my answer', card)).toBeNull();
});

it('returns null on a malformed response', async () => {
  httpsCallableMock.mockResolvedValue({ data: { verdicts: [{ beat: 'answer' }] } });
  expect(await requestAiGrading('my answer', card)).toBeNull();
});

it('returns null when offline', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(await requestAiGrading('my answer', card)).toBeNull();
  expect(httpsCallableMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run (fail), implement `src/lib/grade.ts`**

```typescript
import { httpsCallable } from 'firebase/functions';
import { fns } from './firebase';
import type { AiVerdict, BeatKey, BeatVerdict, HypoCard } from './types';

const BEAT_KEYS: BeatKey[] = ['answer', 'legalBasis', 'application', 'conclusion'];
const VERDICT_VALUES: BeatVerdict[] = ['got', 'partial', 'missed'];

function isVerdicts(x: unknown): x is AiVerdict[] {
  return Array.isArray(x) && x.length === 4 && x.every((v) =>
    typeof v === 'object' && v !== null &&
    BEAT_KEYS.includes((v as AiVerdict).beat) &&
    VERDICT_VALUES.includes((v as AiVerdict).verdict) &&
    typeof (v as AiVerdict).reason === 'string');
}

export async function requestAiGrading(typedAnswer: string, card: HypoCard): Promise<AiVerdict[] | null> {
  if (!navigator.onLine) return null;
  try {
    const call = httpsCallable(fns, 'gradeAnswer');
    const res = await call({
      typedAnswer,
      alac: card.alac,
      caseTitle: card.source.caseTitle,
      grNumber: card.source.grNumber,
    });
    const verdicts = (res.data as { verdicts?: unknown }).verdicts;
    return isVerdicts(verdicts) ? verdicts : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run wrapper tests, then full suite**

Run: `npx vitest run src/lib/grade.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Wire into Review.tsx**

Pass the wrapper to HypoReview:

```tsx
<HypoReview card={card} intervals={intervals} onGrade={grade} aiCheck={requestAiGrading} />
```

(import `requestAiGrading`). HypoReview already handles the `null` result (button stays, user grades manually) and pre-fills marks from verdicts (Task 5's `runAiCheck`); the user can still override any beat before confirming (AI proposes, user disposes).

- [ ] **Step 6: Verify HypoReview AI path with a component test**

Append to `src/components/HypoReview.test.tsx`:

```tsx
it('AI check pre-fills marks but leaves them overridable', async () => {
  const aiCheck = vi.fn().mockResolvedValue([
    { beat: 'answer', verdict: 'got', reason: 'ok' },
    { beat: 'legalBasis', verdict: 'partial', reason: 'no citation' },
    { beat: 'application', verdict: 'got', reason: 'ok' },
    { beat: 'conclusion', verdict: 'got', reason: 'ok' },
  ]);
  const onGrade = vi.fn();
  render(<HypoReview card={card} intervals={intervals} onGrade={onGrade} aiCheck={aiCheck} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'answer' } });
  revealAll();
  fireEvent.click(screen.getByRole('button', { name: /AI check/i }));
  await screen.findByText(/no citation/);
  fireEvent.click(screen.getAllByRole('button', { name: 'Got it' })[1]);
  fireEvent.click(screen.getByRole('button', { name: /Good/ }));
  expect(onGrade).toHaveBeenCalledWith('good', expect.objectContaining({
    typedAnswer: 'answer',
    aiVerdicts: expect.any(Array),
  }));
});
```

Run: `npx vitest run src/components/HypoReview.test.tsx` -> PASS. (Score after the override: got+got+got+got = 4 -> suggested good; button name /Good/ resolves regardless of highlight.)

- [ ] **Step 7: Full suite + tsc + commit**

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit
git add src/lib/grade.ts src/lib/grade.test.ts src/lib/firebase.ts src/screens/Review.tsx src/components/HypoReview.test.tsx
git commit -m "feat: ai-assisted hypo grading with manual fallback"
```

---

### Task 8: Deploy gradeAnswer and end-to-end verification

Ships the function live and proves the whole Plan 2 loop. Parts of this need the user (Anthropic Console key); record them as PENDING-USER in the report rather than blocking.

**Files:**
- Modify: `docs/plan-1-closeout.md` sibling: create `docs/plan-2-notes.md` capturing the verification record and any pending items.

**Interfaces:**
- Consumes: everything above.
- Produces: deployed `gradeAnswer` function; verification notes.

- [ ] **Step 1: Local end-to-end with the real key (requires user-provided key)**

PENDING-USER unless the key is already available: create an Anthropic Console API key in a dedicated workspace with a spend limit (spec 5a). Place it in `functions/.secret.local` as `ANTHROPIC_API_KEY=...` (git-ignored). Then:

```bash
export PATH="$(brew --prefix)/opt/openjdk/bin:$PATH"
firebase emulators:start --only auth,firestore,functions &
npm run seed
npm run dev
```

Review the seeded hypo: type an answer, reveal, click "AI check my answer", confirm verdicts arrive and pre-fill the checklist, confirm the review log contains `typedAnswer` and `aiVerdicts`. Also verify the fallback: stop the functions emulator, repeat, confirm the button fails quietly into manual grading.

- [ ] **Step 2: Set the production secret and deploy**

```bash
npx firebase functions:secrets:set ANTHROPIC_API_KEY   # paste the key at the prompt
npx firebase deploy --only functions
```

Expected: `gradeAnswer` deployed to us-central1. Note: first functions deploy on a project prompts to enable Cloud Build/Artifact Registry APIs and requires the Blaze plan; surface that to the user if it blocks (PENDING-USER).

- [ ] **Step 3: Verify live**

The deployed hosting app (https://flashcards-be310.web.app) reaches the live function by default (no emulator flag in production builds). Live decks contain only basic/cloze cards until Plan 4's pipeline uploads real mcq/hypo content, so the live check is: deploy succeeded, function logs show a clean cold start (`npx firebase functions:log --only gradeAnswer`), and the emulator E2E from Step 1 passed. Record in docs/plan-2-notes.md that full live hypo review awaits Plan 4 content (or a manual console-added hypo card if the user wants one sooner).

- [ ] **Step 4: Push (triggers CI deploy of hosting) and confirm green**

```bash
git add docs/plan-2-notes.md
git commit -m "docs: plan 2 verification notes"
git push
gh run watch $(gh run list -R sites-9400/flashcards -L 1 --json databaseId -q '.[0].databaseId') -R sites-9400/flashcards --exit-status
```

Expected: deploy green (`npm test` includes all new tests).

---

## Verification checklist (whole plan)

- `npm test` green (root: all component/lib tests; functions: grading unit tests) and `tsc --noEmit` clean on both app tsconfigs and functions.
- Emulator E2E: basic, cloze, mcq, hypo all reviewable; skip-hypos toggle works; sync indicator appears only on persist rejection.
- Grade paths: mcq wrong -> again (auto); mcq right -> good default, hard/easy adjustable; hypo score mapping good/hard/again; AI verdicts pre-fill but never auto-confirm.
- Security: `ANTHROPIC_API_KEY` appears only in functions runtime config and .secret.local (git-ignored); `git grep sk-ant` returns nothing.
- House rules: `git grep` for em dashes in changed files returns nothing outside the validator; no emojis; no blue.

## Deferred out of this plan (already recorded in docs/plan-1-closeout.md)

Unbounded reviewLogs read (Plan 3); deckSchema clean-string (Plan 4); CI rules-test job, firebase-tools devDependency, deploy concurrency group (ops, whenever CI is next touched); event-aware prep sessions and stats (Plan 3).
