# LawDeck Plan 3: Events, Prep Sessions, and Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement spec section 7's event awareness (interval clamp + prep sessions) and section 9's stats (home strip, true retention, weak spots, event readiness, hypo history), plus the Plan 3 pickups recorded in docs/plan-1-closeout.md and docs/plan-2-closeout.md.

**Architecture:** Stats are pure functions over review logs and card states in a new `src/lib/stats.ts`, fed by bounded Firestore queries (never the full log history on a hot path). Events are plain owner-only docs under `users/{uid}/events` edited on a new Events screen. The interval clamp wires the existing (already-tested, never-called) `clampToEvents` into the grade path via a new `applyReviewClamped`. Prep sessions reuse the existing interaction components on a new Prep screen fed by `buildPrepQueue` (weakest-first by predicted retrievability). Home grows the stats strip and event list; a Weak Topics screen shows the full ranking; HypoReview gains a lazy past-answers list.

**Tech Stack:** Existing only (React 19 + TS strict + Vite + Tailwind 4 + Firebase 12 + ts-fsrs 5 + vitest). No new dependencies. No functions/ changes in this plan.

**Repo:** `~/Projects/flashcards`, branch `main` (work directly on main, matching Plans 1-2; every commit leaves `npm test` green). Live app: https://flashcards-be310.web.app.

## Global Constraints

- No em dashes in any card content, UI copy, code comments, or commit messages. No emojis; icons are plain inline SVGs if needed.
- Palette: mustard `#E0A526` fill only on interactive surfaces; maroon `#7B1113` text on mustard; never mustard fill behind body text; callouts use mustard left border; neutral grays; semantic green/red only for correct/wrong; no blue.
- No chart libraries and no drawn charts in this plan: the stats strip and forecast are plain numeric text (spec's "stats strip" is satisfied by numbers; visual charts are out of scope).
- TypeScript strict green on both app tsconfigs. Vitest globals are NOT enabled: every test file imports what it uses from 'vitest' explicitly; DOM test files also need `afterEach(cleanup)` from @testing-library/react (established convention).
- Interaction components are remounted per grade via `key={card.id + '-' + round}`; any new screen that renders them must use the same pattern.
- Day boundary: 4 a.m. local via `studyDay()` (src/lib/scheduler.ts); vitest pins TZ Asia/Manila; all client day math goes through studyDay or the new startOfStudyDay, never raw dates.
- Spec rules that bind this plan: a card in scope of an upcoming event is never scheduled past it (due clamps to at latest the day before; normal scheduling resumes after); prep reviews update FSRS state honestly; "in scope" means the card's deck is in `coverage.deckIds` OR any card tag is in `coverage.tags`; true retention = share of non-first reviews rated good or easy; weak spots = failure (again) rates grouped by tag, ranked; event readiness = average predicted retrievability across in-scope cards as one percentage (unseen cards count as 0).
- Firestore: everything under users/{uid} is owner-only via existing rules (events need NO rules change; the gradingUsage carve-out must remain untouched). Review logs stay append-only. The hot-path reviewLogs fix (Task 2) requires a composite index (reviewLogs: deckId ASC, ts ASC) added to firestore.indexes.json and deployed.
- Design decisions fixed by this plan (deviations go through the controller): time-spent-today = for logs sorted ascending within today's study day, add min(gap to previous same-day log, 60000 ms) per log, plus 10000 ms for the first log of the day; streak = consecutive study days with at least one review, ending today or yesterday (yesterday keeps a streak alive before today's first review); weak-spot ranking requires at least 4 attempts per tag over the last 30 days; readiness/weak windows are 30 days of logs; forecast is 7 study days with overdue counted in day 0.

## Existing interfaces this plan builds on (read-only reference)

- `clampToEvents(state, eventDates: number[], now): CardStateDoc` and `retrievability(state, now): number` in src/lib/scheduler.ts (both tested, currently uncalled).
- `EventDoc { id, type: 'recit'|'exam'|'quiz', subject, title, date: number, coverage: { deckIds: string[], tags: string[] } }` already in src/lib/types.ts.
- `buildQueue({cards, states, newCardsPerDay, newIntroducedToday, now, skipHypos?})` with `MAX_SESSION_HYPOS` and internal `interleaveHypos` in src/lib/queue.ts.
- Review.tsx: status machine, `round` counter, `grade(g, extras?)`, per-type routing to BasicClozeReview/McqReview/HypoReview; `fetchDeckBundle` in data.ts fetches deck+cards+states+subscription+reviewLogs (currently unbounded: the Task 2 target).
- HypoReview props: `{ card, intervals, onGrade, aiCheck? }`.
- App.tsx routes: /signin, / (Home), /review/:deckId inside RequireAuth.
- scripts/seed.mts seeds deck civpro-1 with 5 cards (basic, cloze x2, mcq, hypo) for uid SEED_UID.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| src/screens/Review.test.tsx | Create | DOM regression tests for the Review session loop (mocked data/auth) |
| src/components/McqReview.tsx | Modify | Keyboard grading after answer (Enter/Space on wrong; 2/3/4 on right) |
| src/components/HypoReview.tsx | Modify | Keyboard grading (1-4) once all beats marked; past-answers section |
| src/components/McqReview.test.tsx / HypoReview.test.tsx | Modify | Tests for keyboard + empty-extras + past answers |
| src/lib/scheduler.ts | Modify | `startOfStudyDay`, `applyReviewClamped` |
| src/lib/scheduler.test.ts | Modify | Tests for both + learningSteps midpoint assertion fix |
| src/lib/data.ts | Modify | Bounded reviewLogs query; events CRUD; fetchRecentLogs/fetchAllCardStates/fetchHomeBundle/fetchPrepBundle/fetchPastAnswers |
| firestore.indexes.json | Modify | Composite index reviewLogs (deckId, ts) |
| src/lib/stats.ts | Create | Pure stats functions incl. `inScope` |
| src/lib/stats.test.ts | Create | Full unit coverage |
| src/lib/queue.ts | Modify | Generic interleave; `buildPrepQueue` |
| src/lib/queue.test.ts | Modify | Prep queue tests |
| src/screens/Events.tsx | Create | Event list + create/edit/delete form |
| src/screens/Events.test.tsx | Create | Form parsing test |
| src/screens/Prep.tsx | Create | Prep session screen |
| src/screens/Weak.tsx | Create | Weak Topics screen |
| src/screens/Home.tsx | Modify | Stats strip, per-deck due counts, upcoming events, top-3 weak topics |
| src/App.tsx | Modify | Routes /events, /prep/:eventId, /weak |
| src/lib/grade.test.ts | Modify | Restore navigator.onLine spy |
| scripts/seed.mts | Modify | Seed one upcoming event |
| docs/plan-3-notes.md | Create | Verification record (Task 9) |

---

### Task 1: Test pickups and honest keyboard hints

Lands the deferred test debt (Plan 2 closeout) and makes GradeBar's key hints truthful on MCQ/hypo by wiring keyboard grading.

**Files:**
- Create: `src/screens/Review.test.tsx`
- Modify: `src/components/McqReview.tsx`, `src/components/HypoReview.tsx`
- Modify: `src/components/McqReview.test.tsx`, `src/components/HypoReview.test.tsx`
- Modify: `src/lib/scheduler.test.ts` (learningSteps midpoint assertion)
- Modify: `src/lib/grade.test.ts` (restore the onLine spy)

**Interfaces:**
- Consumes: existing components and Review.
- Produces: no signature changes. New behavior: McqReview handles Enter/Space after a wrong answer (grades again) and Digit2/3/4 after a right answer (hard/good/easy); HypoReview handles Digit1-4 once all beats are marked (confirming that grade). Number keys for choice selection before answering are unchanged.

- [ ] **Step 1: Review DOM regression test (failing first is not possible here since the behavior already works; these are regression locks, write and run them green)**

`src/screens/Review.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Card } from '../lib/types';

vi.mock('../lib/auth', () => ({ useUser: () => ({ user: { uid: 'u1' }, loading: false }) }));
vi.mock('../lib/data', () => ({
  fetchDeckBundle: vi.fn(),
  persistReview: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/grade', () => ({ requestAiGrading: vi.fn() }));

import Review from './Review';
import { fetchDeckBundle } from '../lib/data';

afterEach(() => cleanup());

const basic: Card = {
  id: 'b1', type: 'basic', front: 'the front', back: 'the back',
  tags: ['t'], source: { docId: 'd', heading: 'h' },
};

function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/review/d1']}>
      <Routes><Route path="/review/:deckId" element={<Review />} /></Routes>
    </MemoryRouter>,
  );
}

it('hides the answer again when Again re-queues the last card into the same slot', async () => {
  vi.mocked(fetchDeckBundle).mockResolvedValue({
    deck: { id: 'd1', ownerUid: 'u1', title: 'Deck', subject: 'S', description: '', visibility: 'private', cardCount: 1, createdAt: 0, updatedAt: 0 },
    cards: [basic], states: new Map(), subscription: null, newIntroducedToday: 0,
  });
  renderReview();
  fireEvent.click(await screen.findByText('the front'));
  expect(screen.getByText('the back')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Again/ }));
  expect(screen.queryByText('the back')).toBeNull();
  expect(screen.getByText(/tap or press space to reveal/)).toBeInTheDocument();
});
```

(If `fetchDeckBundle`'s mocked return type complains under strict TS, type the mock payload with `Awaited<ReturnType<typeof fetchDeckBundle>>`.) Task 5 will extend this file's data mock with `fetchEvents`; keep the mock factory shape simple.

- [ ] **Step 2: Run it green**

Run: `npx vitest run src/screens/Review.test.tsx`
Expected: PASS (locks the Plan 2 remount fix).

- [ ] **Step 3: Empty-extras test (HypoReview)**

Append to `src/components/HypoReview.test.tsx`:

```tsx
it('confirms with no extras when nothing was typed and no AI ran', () => {
  const onGrade = vi.fn();
  render(<HypoReview card={card} intervals={intervals} onGrade={onGrade} />);
  revealAll();
  screen.getAllByRole('button', { name: 'Got it' }).forEach((b) => fireEvent.click(b));
  fireEvent.click(screen.getByRole('button', { name: /Good/ }));
  expect(onGrade).toHaveBeenCalledWith('good', undefined);
});
```

- [ ] **Step 4: Keyboard grading, failing tests first**

Append to `src/components/McqReview.test.tsx`:

```tsx
it('grades with keyboard after answering: Enter on wrong, Digit4 on right', () => {
  const onGrade = vi.fn();
  const { unmount } = render(<McqReview card={card} intervals={intervals} onGrade={onGrade} />);
  fireEvent.keyDown(window, { code: 'Digit3' });
  fireEvent.keyDown(window, { code: 'Enter' });
  expect(onGrade).toHaveBeenCalledWith('again');
  unmount();
  const onGrade2 = vi.fn();
  render(<McqReview card={card} intervals={intervals} onGrade={onGrade2} />);
  fireEvent.keyDown(window, { code: 'Digit2' });
  fireEvent.keyDown(window, { code: 'Digit4' });
  expect(onGrade2).toHaveBeenCalledWith('easy');
});
```

(Choice 3 is wrong, choice 2 is right for the fixture card.) Append to `src/components/HypoReview.test.tsx`:

```tsx
it('grades with number keys once all beats are marked', () => {
  const onGrade = vi.fn();
  render(<HypoReview card={card} intervals={intervals} onGrade={onGrade} />);
  fireEvent.keyDown(window, { code: 'Digit3' });
  expect(onGrade).not.toHaveBeenCalled();
  revealAll();
  screen.getAllByRole('button', { name: 'Got it' }).forEach((b) => fireEvent.click(b));
  fireEvent.keyDown(window, { code: 'Digit3' });
  expect(onGrade).toHaveBeenCalledWith('good', undefined);
});
```

Run both files: expected FAIL on the new tests.

- [ ] **Step 5: Implement keyboard handlers**

McqReview: extend the existing keydown effect:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (!answered) {
      const m = /^Digit([1-9])$/.exec(e.code);
      if (m) {
        const i = Number(m[1]) - 1;
        if (i < card.choices.length) setPicked(i);
      }
      return;
    }
    if (!correct && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); onGrade('again'); }
    if (correct) {
      const map: Record<string, Grade> = { Digit2: 'hard', Digit3: 'good', Digit4: 'easy' };
      if (map[e.code]) onGrade(map[e.code]);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [answered, correct, card.choices.length, onGrade]);
```

HypoReview: add an effect (uses existing `allMarked` and `confirm`):

```tsx
useEffect(() => {
  if (!allMarked) return;
  const map: Record<string, Grade> = { Digit1: 'again', Digit2: 'hard', Digit3: 'good', Digit4: 'easy' };
  const onKey = (e: KeyboardEvent) => { if (map[e.code]) confirm(map[e.code]); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [allMarked, confirm]);
```

`confirm` must be wrapped in `useCallback` (depends on typed, verdicts, onGrade) for a stable effect dependency.

- [ ] **Step 6: learningSteps midpoint assertion + onLine spy restore**

In `src/lib/scheduler.test.ts`, in the hard-hard-good test, capture the state after the second hard into `const mid = s;` before the third review and assert `expect(typeof mid.learningSteps).toBe('number');` there (keep the final assertions). In `src/lib/grade.test.ts`, give the offline test a spy variable and `spy.mockRestore()` at the end (or add `afterEach(() => vi.restoreAllMocks())` at file level if it does not disturb the module mocks; prefer the targeted restore).

- [ ] **Step 7: Full suite + commit**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS.

```bash
git add src/screens/Review.test.tsx src/components/McqReview.tsx src/components/HypoReview.tsx src/components/McqReview.test.tsx src/components/HypoReview.test.tsx src/lib/scheduler.test.ts src/lib/grade.test.ts
git commit -m "test: review regression locks and keyboard grading for mcq and hypo"
```

---

### Task 2: Bound the hot-path reviewLogs read

Fixes the Plan 1 I3 deferral: `fetchDeckBundle` currently reads a deck's entire append-only log history on every session open, only to count today's first-reviews.

**Files:**
- Modify: `src/lib/scheduler.ts`, `src/lib/scheduler.test.ts`
- Modify: `src/lib/data.ts`
- Modify: `firestore.indexes.json`

**Interfaces:**
- Produces: `export function startOfStudyDay(d: Date): number` in scheduler.ts (epoch ms of the current study day's 4 a.m. local start; `studyDay(new Date(startOfStudyDay(d))) === studyDay(d)` always). `fetchDeckBundle` return shape unchanged; its logs query gains `where('ts', '>=', startOfStudyDay(new Date()))`.
- Composite index: collection `reviewLogs`, fields `deckId` ASC + `ts` ASC.

- [ ] **Step 1: Failing tests for startOfStudyDay**

Append to scheduler.test.ts:

```typescript
it('startOfStudyDay is the most recent 4am and agrees with studyDay', () => {
  const before4 = new Date('2026-07-30T02:30:00+08:00');
  const after4 = new Date('2026-07-30T05:00:00+08:00');
  expect(studyDay(new Date(startOfStudyDay(before4)))).toBe(studyDay(before4));
  expect(studyDay(new Date(startOfStudyDay(after4)))).toBe(studyDay(after4));
  expect(new Date(startOfStudyDay(after4)).getHours()).toBe(4);
  expect(startOfStudyDay(before4)).toBeLessThan(before4.getTime());
});
```

- [ ] **Step 2: Implement**

```typescript
export function startOfStudyDay(d: Date): number {
  const s = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  const z = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  return z.getTime() + 4 * 60 * 60 * 1000;
}
```

Run scheduler tests: PASS.

- [ ] **Step 3: Bound the query**

In `fetchDeckBundle`, change the logs query to:

```typescript
getDocs(query(
  collection(db, 'users', uid, 'reviewLogs'),
  where('deckId', '==', deckId),
  where('ts', '>=', startOfStudyDay(new Date())),
)),
```

The downstream `newIntroducedToday` computation stays exactly as-is (its `studyDay` filter is now redundant but harmless and keeps the boundary double-checked).

- [ ] **Step 4: Composite index + deploy**

`firestore.indexes.json`: add to the `indexes` array:

```json
{
  "collectionGroup": "reviewLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "deckId", "order": "ASCENDING" },
    { "fieldPath": "ts", "order": "ASCENDING" }
  ]
}
```

Deploy: `npx firebase deploy --only firestore:indexes` (wait for it to accept; index build is async server-side and that is fine).

- [ ] **Step 5: Emulator check + commit**

Emulator quickly: seed, review a card, reload the deck; confirm no query errors (the emulator does not enforce composite indexes, so also confirm the deploy output listed the new index). Then:

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit
git add src/lib/scheduler.ts src/lib/scheduler.test.ts src/lib/data.ts firestore.indexes.json
git commit -m "perf: bound the session reviewLogs read to the current study day"
```

---

### Task 3: Stats library (pure functions)

**Files:**
- Create: `src/lib/stats.ts`, `src/lib/stats.test.ts`

**Interfaces (produced; consumed by Tasks 5-8):**

```typescript
import type { CardStateDoc, EventDoc, Grade } from './types';

export interface LogLike {
  ts: number; grade: Grade; tags: string[]; deckId: string; cardId: string; firstReview?: boolean;
}
export function reviewsToday(logs: LogLike[], now: Date): number;
export function streak(logs: LogLike[], now: Date): number;
export function timeSpentTodayMs(logs: LogLike[], now: Date): number;
export function dueForecast(states: CardStateDoc[], now: Date, days?: number): { day: string; count: number }[];
export function trueRetention(logs: LogLike[]): number | null;
export function weakSpots(logs: LogLike[], minAttempts?: number): { tag: string; failRate: number; attempts: number }[];
export function inScope(deckId: string, tags: string[], event: EventDoc): boolean;
export function eventReadiness(items: { deckId: string; cardId: string }[], states: Map<string, CardStateDoc>, now: Date): number;
```

Semantics (from Global Constraints): reviewsToday counts logs whose `studyDay(new Date(ts))` equals today's; streak walks distinct study days descending from today (or yesterday if today has none yet), counting consecutive days; timeSpentTodayMs sorts today's logs ascending and adds `min(gap, 60000)` per log after the first plus 10000 for the first; dueForecast buckets states by `studyDay(new Date(due))` for the next `days` (default 7) study days with anything due before now folded into bucket 0, day keys are studyDay strings; trueRetention = (good+easy) / count over logs with `firstReview !== true`, null when that count is 0; weakSpots aggregates per tag over the given logs (attempts = logs containing the tag, failRate = again-count / attempts), filters attempts >= minAttempts (default 4), sorts failRate desc then attempts desc; inScope = `event.coverage.deckIds.includes(deckId) || tags.some((t) => event.coverage.tags.includes(t))`; eventReadiness = mean over items of `retrievability(state, now)` with missing state contributing 0, returns 0 for an empty item list. `eventReadiness` imports `retrievability` from scheduler; states map is keyed by cardId (matching Review's states map).

- [ ] **Step 1: Write the failing test file covering every function**

`src/lib/stats.test.ts` (fixtures use explicit `+08:00` timestamps; NOW = `new Date('2026-07-30T20:00:00+08:00')`):

```typescript
import { describe, it, expect } from 'vitest';
import {
  reviewsToday, streak, timeSpentTodayMs, dueForecast, trueRetention, weakSpots, inScope, eventReadiness,
} from './stats';
import { newCardState, studyDay } from './scheduler';
import type { EventDoc } from './types';
import type { LogLike } from './stats';

const NOW = new Date('2026-07-30T20:00:00+08:00');
const T = (s: string) => new Date(s).getTime();
const log = (ts: number, over: Partial<LogLike> = {}): LogLike => ({
  ts, grade: 'good', tags: ['jurisdiction'], deckId: 'd1', cardId: 'c1', ...over,
});

it('reviewsToday counts only the current study day', () => {
  const logs = [
    log(T('2026-07-30T10:00:00+08:00')),
    log(T('2026-07-30T03:00:00+08:00')),
    log(T('2026-07-29T22:00:00+08:00')),
  ];
  expect(reviewsToday(logs, NOW)).toBe(1);
});

it('streak counts consecutive study days and survives a not-yet-studied today', () => {
  const logs = [
    log(T('2026-07-29T10:00:00+08:00')),
    log(T('2026-07-28T10:00:00+08:00')),
    log(T('2026-07-26T10:00:00+08:00')),
  ];
  expect(streak(logs, NOW)).toBe(2);
  expect(streak([...logs, log(T('2026-07-30T09:00:00+08:00'))], NOW)).toBe(3);
  expect(streak([], NOW)).toBe(0);
});

it('timeSpentToday caps gaps at 60s and seeds 10s for the first review', () => {
  const base = T('2026-07-30T10:00:00+08:00');
  const logs = [log(base), log(base + 30_000), log(base + 30_000 + 600_000)];
  expect(timeSpentTodayMs(logs, NOW)).toBe(10_000 + 30_000 + 60_000);
  expect(timeSpentTodayMs([], NOW)).toBe(0);
});

it('dueForecast buckets 7 study days with overdue in day 0', () => {
  const mk = (due: number) => ({ ...newCardState('d1', Math.random().toString(36).slice(2)), due, state: 'review' as const });
  const states = [
    mk(NOW.getTime() - 24 * 3600e3),
    mk(NOW.getTime() + 3600e3),
    mk(NOW.getTime() + 2 * 24 * 3600e3),
  ];
  const f = dueForecast(states, NOW);
  expect(f).toHaveLength(7);
  expect(f[0].count).toBe(2);
  expect(f[2].count).toBe(1);
  expect(f[0].day).toBe(studyDay(NOW));
});

it('trueRetention ignores first reviews and handles empties', () => {
  const logs = [
    log(1, { firstReview: true, grade: 'again' }),
    log(2, { grade: 'good' }),
    log(3, { grade: 'again' }),
    log(4, { grade: 'easy' }),
  ];
  expect(trueRetention(logs)).toBeCloseTo(2 / 3);
  expect(trueRetention([log(1, { firstReview: true })])).toBeNull();
});

it('weakSpots ranks by fail rate with a minimum attempt floor', () => {
  const logs = [
    ...[1, 2, 3, 4].map((i) => log(i, { tags: ['venue'], grade: i <= 3 ? 'again' : 'good' })),
    ...[5, 6, 7, 8].map((i) => log(i, { tags: ['docket-fees'], grade: i === 5 ? 'again' : 'good' })),
    log(9, { tags: ['rare'], grade: 'again' }),
  ];
  const w = weakSpots(logs);
  expect(w.map((x) => x.tag)).toEqual(['venue', 'docket-fees']);
  expect(w[0].failRate).toBeCloseTo(0.75);
  expect(w.find((x) => x.tag === 'rare')).toBeUndefined();
});

it('inScope matches by deck or by tag', () => {
  const ev: EventDoc = {
    id: 'e1', type: 'recit', subject: 'CIVPRO', title: 'Recit', date: NOW.getTime() + 3 * 24 * 3600e3,
    coverage: { deckIds: ['d1'], tags: ['venue'] },
  };
  expect(inScope('d1', ['x'], ev)).toBe(true);
  expect(inScope('d2', ['venue'], ev)).toBe(true);
  expect(inScope('d2', ['x'], ev)).toBe(false);
});

it('eventReadiness averages retrievability with unseen as zero', () => {
  const seen = newCardState('d1', 'c1');
  const states = new Map([['c1', { ...seen, lastReview: NOW.getTime() - 3600e3, stability: 10, state: 'review' as const }]]);
  const r = eventReadiness([{ deckId: 'd1', cardId: 'c1' }, { deckId: 'd1', cardId: 'c2' }], states, NOW);
  expect(r).toBeGreaterThan(0);
  expect(r).toBeLessThan(1);
  expect(eventReadiness([], states, NOW)).toBe(0);
});
```

Run: FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/stats.ts` to the semantics above**

Implementation notes: all "today" logic derives day keys via `studyDay(new Date(ts))`; streak builds a Set of day keys, then walks back from today (or yesterday when today absent) decrementing by 24h from `startOfStudyDay(now)`; dueForecast precomputes the 7 day keys by adding 24h steps to `startOfStudyDay(now)` (DST-free assumption documented for the Philippines); keep every function allocation-light but favor clarity.

- [ ] **Step 3: Run green, full suite, commit**

```bash
npx vitest run src/lib/stats.test.ts && npm test && npx tsc -p tsconfig.app.json --noEmit
git add src/lib/stats.ts src/lib/stats.test.ts
git commit -m "feat: stats library for streak retention weak spots forecast and readiness"
```

---

### Task 4: Events data layer and Events screen

**Files:**
- Modify: `src/lib/data.ts`
- Create: `src/screens/Events.tsx`, `src/screens/Events.test.tsx`
- Modify: `src/App.tsx` (route /events), `src/screens/Home.tsx` (one header link "events"), `scripts/seed.mts` (one upcoming event)

**Interfaces:**
- Produces in data.ts:

```typescript
export async function fetchEvents(uid: string): Promise<EventDoc[]>;            // sorted by date asc
export async function saveEvent(uid: string, event: Omit<EventDoc, 'id'> & { id?: string }): Promise<string>; // new doc id when absent
export async function deleteEvent(uid: string, eventId: string): Promise<void>;
```

  Implementation: collection `users/{uid}/events`; `saveEvent` uses `doc(collection(db, ...))` for a fresh id when none given, `setDoc` with the id included in the doc body.
- Events screen: lists events (title, subject, type, date, coverage summary, Prepare link to `/prep/:id` which 404s until Task 6 lands its route, acceptable ordering), a form to add/edit: type select (recit/exam/quiz), subject text, title text, date `<input type="date">` (stored as `new Date(y, m-1, d).getTime()`, midnight local), coverage deck checkboxes (from `fetchDecks`) and a comma-separated tags input (split, trim, drop empties), delete button per event.

- [ ] **Step 1: Failing DOM test for form parsing**

`src/screens/Events.test.tsx` (the form inputs must carry accessible labels for these queries; build the form accordingly):

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/auth', () => ({ useUser: () => ({ user: { uid: 'u1' }, loading: false }) }));
vi.mock('../lib/data', () => ({
  fetchDecks: vi.fn().mockResolvedValue([{ id: 'd1', ownerUid: 'u1', title: 'Civ Pro', subject: 'S', description: '', visibility: 'private', cardCount: 1, createdAt: 0, updatedAt: 0 }]),
  fetchEvents: vi.fn().mockResolvedValue([]),
  saveEvent: vi.fn().mockResolvedValue('e1'),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}));

import Events from './Events';
import { saveEvent } from '../lib/data';

afterEach(() => cleanup());

it('saves a parsed event from the form', async () => {
  render(<MemoryRouter><Events /></MemoryRouter>);
  await screen.findByLabelText(/Civ Pro/);
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Friday recit' } });
  fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'CIVPRO' } });
  fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'recit' } });
  fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-08-07' } });
  fireEvent.click(screen.getByLabelText(/Civ Pro/));
  fireEvent.change(screen.getByLabelText(/tags/i), { target: { value: 'venue, docket-fees' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(saveEvent).toHaveBeenCalledWith('u1', expect.objectContaining({
    title: 'Friday recit', subject: 'CIVPRO', type: 'recit',
    date: new Date(2026, 7, 7).getTime(),
    coverage: { deckIds: ['d1'], tags: ['venue', 'docket-fees'] },
  }));
});
```

- [ ] **Step 2: Implement data functions and the screen**

Screen skeleton: `useEffect` loads decks+events; local form state; edit populates the form; after save/delete re-fetch events. Styling per palette (mustard buttons, gray structure). Keep it under ~150 lines; no modal, inline form above the list.

- [ ] **Step 3: Wire route and link; seed an event**

App.tsx: `<Route path="/events" element={<RequireAuth><Events /></RequireAuth>} />`. Home header gains a `<Link to="/events" className="text-sm underline mr-3">events</Link>` next to the sign-out button. seed.mts: after the subscription write, add:

```typescript
await db.doc(`users/${uid}/events/seed-recit`).set({
  id: 'seed-recit', type: 'recit', subject: 'CIVIL PROCEDURE 1', title: 'Friday recit',
  date: now + 3 * 24 * 60 * 60 * 1000,
  coverage: { deckIds: [deckId], tags: ['jurisdiction'] },
});
```

- [ ] **Step 4: Verify + commit**

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build
git add src/lib/data.ts src/screens/Events.tsx src/screens/Events.test.tsx src/App.tsx src/screens/Home.tsx scripts/seed.mts
git commit -m "feat: events crud screen and seed event"
```

---

### Task 5: Wire the interval clamp into grading

**Files:**
- Modify: `src/lib/scheduler.ts`, `src/lib/scheduler.test.ts`
- Modify: `src/screens/Review.tsx`, `src/screens/Review.test.tsx`

**Interfaces:**
- Produces: `export function applyReviewClamped(state: CardStateDoc, grade: Grade, now: Date, eventDates: number[]): CardStateDoc` = `clampToEvents(applyReview(state, grade, now), eventDates, now)`.
- Review.tsx: load effect additionally calls `fetchEvents(user.uid)` (parallel with the bundle) into `events` state; `grade()` computes `const dates = events.filter((ev) => ev.date > Date.now() && inScope(deckId, card.tags, ev)).map((ev) => ev.date);` and uses `applyReviewClamped(prev ?? newCardState(...), g, new Date(), dates)`. Prep (Task 6) reuses the same helper.

- [ ] **Step 1: Failing scheduler tests**

```typescript
it('applyReviewClamped never schedules past the day before an in-scope event', () => {
  let s = { ...newCardState('d1', 'c1'), state: 'review' as const, stability: 60, difficulty: 5, reps: 4, lastReview: NOW.getTime() - 10 * DAY, due: NOW.getTime() };
  const eventAt = NOW.getTime() + 3 * DAY;
  const clamped = applyReviewClamped(s, 'easy', NOW, [eventAt]);
  expect(clamped.due).toBeLessThanOrEqual(eventAt - DAY);
  const unclamped = applyReviewClamped(s, 'easy', NOW, []);
  expect(unclamped.due).toBeGreaterThan(eventAt - DAY);
});
```

(If the fixture does not naturally schedule past 2 days, raise stability until `unclamped` proves the clamp did the work; assert `unclamped.due > clamped.due` as the load-bearing check.)

- [ ] **Step 2: Implement the one-liner; run green**

- [ ] **Step 3: Wire Review.tsx**

Add `events` state; extend the load effect (`Promise.all` with the bundle fetch, both under the same cancellation flag); import `inScope` from stats and `applyReviewClamped`; swap the `applyReview` call. Update `src/screens/Review.test.tsx`'s data mock factory to also export `fetchEvents: vi.fn().mockResolvedValue([])`, and add one test: with a mocked event dated 3 study days out covering d1 and a review-state card whose Easy interval would exceed it, grading Easy leaves the card's next due at most the day before (assert via `persistReview` mock: `expect(vi.mocked(persistReview).mock.calls[0][3].due).toBeLessThanOrEqual(eventDate - 24*3600e3)`).

- [ ] **Step 4: Full suite + commit**

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit
git add src/lib/scheduler.ts src/lib/scheduler.test.ts src/screens/Review.tsx src/screens/Review.test.tsx
git commit -m "feat: clamp scheduling to upcoming in-scope events"
```

---

### Task 6: Prep sessions

**Files:**
- Modify: `src/lib/queue.ts`, `src/lib/queue.test.ts`
- Modify: `src/lib/data.ts`
- Create: `src/screens/Prep.tsx`
- Modify: `src/App.tsx` (route), `src/screens/Events.tsx` and Home events rows (Prepare links, Home part lands in Task 7)

**Interfaces:**
- queue.ts: refactor `interleaveHypos` to a generic `interleaveByType<T>(items: T[], isHypo: (t: T) => boolean): T[]` used by both paths (buildQueue behavior byte-identical; existing tests must pass unchanged). New:

```typescript
export interface PrepItem { deckId: string; card: Card }
export function buildPrepQueue(items: PrepItem[], states: Map<string, CardStateDoc>, now: Date, skipHypos?: boolean): PrepItem[];
```

  Semantics: optionally drop hypos; order = unseen cards first (no state entry, original order preserved), then seen cards by `retrievability(state, now)` ascending; then the hypo cap + interleave applies (max 3 hypos, never first when a non-hypo exists).
- data.ts:

```typescript
export async function fetchPrepBundle(uid: string, eventId: string): Promise<{
  event: EventDoc; items: PrepItem[]; states: Map<string, CardStateDoc>;
}>;
```

  Implementation: fetch the event doc (throw 'event-not-found' if missing), `fetchDecks(uid)`, fetch cards for every owned deck (parallel `getDocs`), filter with `inScope(deckId, card.tags, event)`, fetch cardStates for the involved decks (`where('deckId', 'in', ...)` chunked by 10, or simply fetch all the user's cardStates: choose fetching ALL cardStates for simplicity, volume is fine in v1 and the map is keyed by cardId).
- Prep.tsx: clone of Review's session shell with differences: loads via fetchPrepBundle + fetchEvents (for clamping, reuse the SAME clamp logic with all events); queue via buildPrepQueue (no new-card budget, no newIntroducedToday); header shows "Prep: {event.title}" and a readiness percentage recomputed from current states via `eventReadiness`; empty state says "Nothing in scope."; grading persists honestly through the identical `grade()` path (persistReview + applyReviewClamped); same remount-key pattern, same skip-hypos toggle, same sync indicator; route `/prep/:eventId`; deck-not-found style error screen for a missing event.

- [ ] **Step 1: Failing queue tests**

Append to queue.test.ts (NOW/DAY style constants and card factories already exist in the file; add imports for `buildPrepQueue`, `retrievability`, `newCardState`):

```typescript
const seenState = (deckId: string, cardId: string, daysAgo: number, stability: number): CardStateDoc => ({
  ...newCardState(deckId, cardId),
  state: 'review', reps: 3, stability,
  lastReview: NOW.getTime() - daysAgo * 24 * 3600e3,
  due: NOW.getTime() - 3600e3,
});

it('buildPrepQueue puts unseen first then weakest retrievability ascending', () => {
  const mkBasic = (id: string): Card => ({ id, type: 'basic', front: 'f', back: 'b', tags: ['t'], source: { docId: 'd', heading: 'h' } });
  const items = ['unseen', 'weak', 'mid', 'strong'].map((id) => ({ deckId: 'd1', card: mkBasic(id) }));
  const states = new Map([
    ['weak', seenState('d1', 'weak', 20, 2)],
    ['mid', seenState('d1', 'mid', 5, 10)],
    ['strong', seenState('d1', 'strong', 1, 60)],
  ]);
  const rWeak = retrievability(states.get('weak')!, NOW);
  const rMid = retrievability(states.get('mid')!, NOW);
  const rStrong = retrievability(states.get('strong')!, NOW);
  expect(rWeak).toBeLessThan(rMid);
  expect(rMid).toBeLessThan(rStrong);
  const q = buildPrepQueue(items, states, NOW);
  expect(q.map((i) => i.card.id)).toEqual(['unseen', 'weak', 'mid', 'strong']);
});

it('buildPrepQueue honors skipHypos and never leads with a hypo', () => {
  const hypo: Card = { id: 'h1', type: 'hypo', facts: 'F', question: 'Q', alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' }, tags: ['t'], source: { docId: 'd', heading: 'h' } };
  const basic: Card = { id: 'b1', type: 'basic', front: 'f', back: 'b', tags: ['t'], source: { docId: 'd', heading: 'h' } };
  const items = [{ deckId: 'd1', card: hypo }, { deckId: 'd1', card: basic }];
  expect(buildPrepQueue(items, new Map(), NOW, true).map((i) => i.card.id)).toEqual(['b1']);
  const q = buildPrepQueue(items, new Map(), NOW);
  expect(q).toHaveLength(2);
  expect(q[0].card.type).not.toBe('hypo');
});
```

The `retrievability` pre-assertions inside the first test guard against magic expectations: if the fixtures fail to order, the test tells you the fixture (not the queue) is wrong.

- [ ] **Step 2: Refactor interleave + implement buildPrepQueue; queue tests all green (old and new)**

- [ ] **Step 3: Implement fetchPrepBundle and Prep.tsx; wire the route and the Events-screen Prepare link**

- [ ] **Step 4: Emulator smoke**

Seeded event covers the seeded deck: open /events, hit Prepare, confirm weakest-first ordering (unseen cards first on a fresh seed), review two cards, confirm readiness % changes and logs persist.

- [ ] **Step 5: Full suite + commit**

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build
git add src/lib/queue.ts src/lib/queue.test.ts src/lib/data.ts src/screens/Prep.tsx src/App.tsx src/screens/Events.tsx
git commit -m "feat: prep sessions ranked weakest first"
```

---

### Task 7: Home screen: stats strip, due counts, upcoming events, top weak topics

**Files:**
- Modify: `src/lib/data.ts`
- Modify: `src/screens/Home.tsx`
- Create: `src/screens/Home.test.tsx`

**Interfaces:**
- data.ts:

```typescript
export async function fetchHomeBundle(uid: string): Promise<{
  decks: Deck[];
  events: EventDoc[];                       // upcoming only (date >= startOfStudyDay(now)), sorted asc
  states: CardStateDoc[];                   // all the user's cardStates
  logs: LogLike[];                          // last 30 days (ts >= now - 30d)
  eventCards: Map<string, { deckId: string; cardId: string; tags: string[] }[]>; // eventId -> in-scope card refs
}>;
```

  Implementation: parallel fetches (decks, events, cardStates collection, reviewLogs with `where('ts', '>=', cutoff)`); then for the union of decks referenced by any upcoming event's `coverage.deckIds` plus ALL owned decks when any event has non-empty coverage.tags (tag matches can live anywhere), fetch those decks' cards once each and build `eventCards` via `inScope`. With v1 deck counts this is a handful of reads; note it in a comment.
- Home.tsx layout (top to bottom): header (existing + events link); stats strip as a 4-cell row of plain text tiles (Streak "N days", Today "N reviews", Time "N min", Retention "NN%" from 30d logs); 7-day forecast as one line of "D+0 n0, D+1 n1, ..." styled small; upcoming events list (title, date, "N in scope", readiness "NN%", weak tags line "weak: tag1, tag2" from the top 2 weakSpots whose tag appears on that event's in-scope cards or coverage tags, Prepare link); top-3 weak topics with a link to /weak; deck list (existing) with a due-count badge per deck (`states.filter(s => s.deckId === d.id && s.due <= now).length` shown as "N due") and per-deck retention (spec 9 requires retention "overall and per deck"): `trueRetention(logs.filter(l => l.deckId === d.id))` shown as "NN% ret" on the deck row, omitted when null.
- All numbers computed with the Task 3 functions; no charts; palette rules apply (tiles are gray-bordered, not mustard-filled).

- [ ] **Step 1: Failing DOM test**

`src/screens/Home.test.tsx` (fixture note: build logs with explicit timestamps relative to a fixed now injected by mocking nothing; use real `Date.now()` at test time via `const now = Date.now()` and construct logs at `now - k` offsets so streak/reviews/retention are deterministic under the pinned TZ):

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { startOfStudyDay } from '../lib/scheduler';
import { newCardState } from '../lib/scheduler';

vi.mock('../lib/auth', () => ({ useUser: () => ({ user: { uid: 'u1', displayName: 'G' }, loading: false }), signOutUser: vi.fn() }));
vi.mock('../lib/data', () => ({ fetchHomeBundle: vi.fn() }));

import Home from './Home';
import { fetchHomeBundle } from '../lib/data';

afterEach(() => cleanup());

it('renders strip, due badge, event row, and weak link from the bundle', async () => {
  const now = Date.now();
  const sod = startOfStudyDay(new Date(now));
  const log = (ts: number, grade = 'good', firstReview = false) => ({ ts, grade, tags: ['venue'], deckId: 'd1', cardId: 'c1', firstReview });
  vi.mocked(fetchHomeBundle).mockResolvedValue({
    decks: [{ id: 'd1', ownerUid: 'u1', title: 'Civ Pro', subject: 'S', description: '', visibility: 'private', cardCount: 3, createdAt: 0, updatedAt: 0 }],
    events: [{ id: 'e1', type: 'recit', subject: 'S', title: 'Friday recit', date: now + 3 * 24 * 3600e3, coverage: { deckIds: ['d1'], tags: [] } }],
    states: [
      { ...newCardState('d1', 'c1'), due: now - 1000 },
      { ...newCardState('d1', 'c2'), due: now + 5 * 24 * 3600e3 },
    ],
    logs: [
      ...[1, 2, 3, 4].map((k) => log(sod + k * 60000)),
      log(sod - 20 * 3600e3),
      log(sod + 5 * 60000, 'again'),
    ],
    eventCards: new Map([['e1', [{ deckId: 'd1', cardId: 'c1', tags: ['venue'] }, { deckId: 'd1', cardId: 'c2', tags: ['venue'] }]]]),
  });
  render(<MemoryRouter><Home /></MemoryRouter>);
  expect(await screen.findByText(/Friday recit/)).toBeInTheDocument();
  expect(screen.getByText(/2 days?/)).toBeInTheDocument();
  expect(screen.getByText(/5 reviews/)).toBeInTheDocument();
  expect(screen.getByText(/80%/)).toBeInTheDocument();
  expect(screen.getByText(/1 due/)).toBeInTheDocument();
  expect(screen.getByText(/2 in scope/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /prepare/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /weak topics/i })).toBeInTheDocument();
});
```

(The log fixture: 5 logs today of which 4 good + 1 again and none first-review gives 5 reviews today and 80% retention; one log yesterday gives streak 2. If strict types complain, type `log`'s return as the data module's LogLike.) The strip labels must therefore render the literal forms "N days", "N reviews", "NN%", "N due", "N in scope"; keep those exact casings.

- [ ] **Step 2: Implement fetchHomeBundle + the screen; run green**

- [ ] **Step 3: Full suite + build + commit**

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build
git add src/lib/data.ts src/screens/Home.tsx src/screens/Home.test.tsx
git commit -m "feat: home stats strip events and weak topics summary"
```

---

### Task 8: Weak Topics screen and hypo history

**Files:**
- Create: `src/screens/Weak.tsx`
- Modify: `src/App.tsx` (route /weak)
- Modify: `src/lib/data.ts` (`fetchPastAnswers`)
- Modify: `src/components/HypoReview.tsx`, `src/components/HypoReview.test.tsx`
- Modify: `src/screens/Review.tsx`, `src/screens/Prep.tsx` (pass the fetcher)

**Interfaces:**
- data.ts: `export async function fetchPastAnswers(uid: string, cardId: string): Promise<{ ts: number; typedAnswer: string }[]>` (query reviewLogs `where('cardId', '==', cardId)`, client-filter docs with a non-empty typedAnswer, sort ts desc, cap 5; equality-only query needs no composite index).
- Weak.tsx: loads 30d logs (add `export async function fetchRecentLogs(uid: string, sinceTs: number): Promise<LogLike[]>` to data.ts if Task 7 did not already factor it out of fetchHomeBundle; reuse rather than duplicate), renders the full `weakSpots` ranking as rows "tag, NN% fail, N attempts" plus an empty state.
- HypoReview: new optional prop `pastAnswers?: () => Promise<{ ts: number; typedAnswer: string }[]>`. After full reveal, render a "Past answers" toggle button; on first expand, call the fetcher once and list results ("date: answer" rows, small text) or "None yet."; fetch errors show "None yet." (quiet). Review/Prep pass `pastAnswers={() => fetchPastAnswers(user.uid, card.id)}` for hypo cards.

- [ ] **Step 1: Failing HypoReview test**

```tsx
it('lists past typed answers on demand after full reveal', async () => {
  const pastAnswers = vi.fn().mockResolvedValue([{ ts: 1753800000000, typedAnswer: 'old answer' }]);
  render(<HypoReview card={card} intervals={intervals} onGrade={vi.fn()} pastAnswers={pastAnswers} />);
  revealAll();
  fireEvent.click(screen.getByRole('button', { name: /past answers/i }));
  expect(await screen.findByText(/old answer/)).toBeInTheDocument();
  expect(pastAnswers).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Implement all pieces, plus the Weak screen DOM test**

`src/screens/Weak.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/auth', () => ({ useUser: () => ({ user: { uid: 'u1' }, loading: false }) }));
vi.mock('../lib/data', () => ({ fetchRecentLogs: vi.fn() }));

import Weak from './Weak';
import { fetchRecentLogs } from '../lib/data';

afterEach(() => cleanup());

it('renders the ranked weak-topic rows', async () => {
  const log = (tag: string, grade: string, k: number) => ({ ts: k, grade, tags: [tag], deckId: 'd1', cardId: 'c1' });
  vi.mocked(fetchRecentLogs).mockResolvedValue([
    ...[1, 2, 3, 4].map((k) => log('venue', k <= 3 ? 'again' : 'good', k)),
    ...[5, 6, 7, 8].map((k) => log('docket-fees', k === 5 ? 'again' : 'good', k)),
  ]);
  render(<MemoryRouter><Weak /></MemoryRouter>);
  const rows = await screen.findAllByRole('listitem');
  expect(rows[0].textContent).toContain('venue');
  expect(rows[0].textContent).toContain('75%');
  expect(rows[1].textContent).toContain('docket-fees');
});
```

(Weak.tsx renders each topic as an `<li>`; fail rates render as whole percentages.)

- [ ] **Step 3: Full suite + build + commit**

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build
git add src/screens/Weak.tsx src/App.tsx src/lib/data.ts src/components/HypoReview.tsx src/components/HypoReview.test.tsx src/screens/Review.tsx src/screens/Prep.tsx src/screens/Weak.test.tsx
git commit -m "feat: weak topics screen and hypo answer history"
```

---

### Task 9: End-to-end verification and ship

**Files:**
- Create: `docs/plan-3-notes.md`

- [ ] **Step 1: Emulator E2E (playwright)**

Fresh emulators + seed (which now includes the event). Walk: Home shows the stats strip (zeros), deck due counts, the seeded event with in-scope count and Prepare link; review several cards in the deck (mix of grades including again) and one AI-graded hypo if the functions emulator is up (optional here, AI was verified in Plan 2); return Home and confirm streak 1, reviews count, time > 0, retention updates; open Events, edit the seeded event's tags, save; open Prep for the event, confirm weakest-first and readiness; grade one card Easy in Review for a card in scope and confirm in the emulator UI that its cardState due is at most the day before the event (the clamp working live); open Weak Topics after enough again-grades to cross the 4-attempt floor on one tag. Screenshot key states into the SDD workspace dir.

- [ ] **Step 2: Write docs/plan-3-notes.md** (verification record, screenshots list, design decisions recap: time-spent heuristic, streak rule, 30d/4-attempt thresholds; note the composite index deployed in Task 2).

- [ ] **Step 3: Ship and confirm CI**

```bash
npm test && npx tsc -p tsconfig.app.json --noEmit && npm run build
git add docs/plan-3-notes.md
git commit -m "docs: plan 3 verification notes"
git push
gh run watch $(gh run list -R sites-9400/flashcards -L 1 --json databaseId -q '.[0].databaseId') -R sites-9400/flashcards --exit-status
```

---

## Verification checklist (whole plan)

- Suites green (root; functions untouched), tsc clean, build clean, CI green.
- Emulator E2E per Task 9; clamp verified live against a seeded event; prep ordering weakest-first; stats strip numbers move correctly across a session.
- No new dependencies; no charts; house rules hold (`git grep` for em dashes/emojis in changed files clean; no blue).
- Hot path: fetchDeckBundle reads only today's logs (composite index deployed); stats reads are 30d-bounded; no unbounded log query remains on any screen load.

## Deferred out of this plan

verdictsSchema one-per-beat refine (next functions/ touch); deckSchema clean string (Plan 4); ops carry-forwards from docs/plan-2-closeout.md (Artifact Registry policy, CI rules-test job, firebase-tools devDep, deploy concurrency); FSRS parameter auto-tuning from retention (spec 9 mentions it feeds tuning; explicitly out until a later plan); nightly aggregation Cloud Function (spec 9 explicitly later).
