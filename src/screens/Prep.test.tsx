import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../lib/auth', () => {
  const user = { uid: 'u1' };
  return { useUser: () => ({ user, loading: false }) };
});

// vi.mock factories are hoisted above top-level consts, so build the fixture
// data with vi.hoisted (per vitest's own guidance) rather than as plain
// module-scope consts referenced inside the factory below.
const { basic, hypo, seenHypoState, event } = vi.hoisted(() => {
  const basic = {
    id: 'b1', type: 'basic' as const, front: 'the front', back: 'the back',
    tags: ['t'], source: { docId: 'd', heading: 'h' },
  };
  const hypo = {
    id: 'h1', type: 'hypo' as const, facts: 'F', question: 'Q',
    alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
    tags: ['t'], source: { docId: 'd', heading: 'h' },
  };
  const now = Date.now();
  const seenHypoState = {
    deckId: 'd1', cardId: 'h1', due: now - 60 * 60 * 1000, stability: 30, difficulty: 5,
    elapsedDays: 5, scheduledDays: 5, reps: 3, lapses: 0,
    state: 'review' as const, lastReview: now - 5 * 24 * 60 * 60 * 1000, learningSteps: 0,
  };
  const event = {
    id: 'e1', type: 'recit' as const, subject: 'S', title: 'Test Event',
    date: now + 3 * 24 * 60 * 60 * 1000, coverage: { deckIds: ['d1'], tags: ['t'] },
  };
  return { basic, hypo, seenHypoState, event };
});

vi.mock('../lib/data', () => ({
  fetchPrepBundle: vi.fn().mockResolvedValue({
    event,
    items: [{ deckId: 'd1', card: basic }, { deckId: 'd1', card: hypo }],
    states: new Map([['h1', seenHypoState]]),
  }),
  fetchEvents: vi.fn().mockResolvedValue([]),
  persistReview: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/grade', () => ({ requestAiGrading: vi.fn() }));

import Prep from './Prep';

afterEach(() => cleanup());

it('readiness percentage is computed from all in-scope items, not the session-capped display queue', async () => {
  const { container } = render(
    <MemoryRouter initialEntries={['/prep/e1']}>
      <Routes><Route path="/prep/:eventId" element={<Prep />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByText(/Prep: Test Event/);
  const headerText = () => container.querySelector('header span')?.textContent ?? '';
  const pct = (s: string) => s.match(/readiness (\d+)%/)?.[1];

  // Two in-scope items load (basic unseen, hypo seen), so the display queue
  // starts at length 2.
  await waitFor(() => expect(headerText()).toMatch(/1 \/ 2/));
  const before = pct(headerText());
  expect(before).toBeTruthy();
  expect(Number(before)).toBeGreaterThan(0); // the seen hypo must contribute

  // Toggling skip-hypos drops the hypo from the display queue (2 -> 1) with
  // zero grading having happened. Readiness must not move: it is computed
  // from the full in-scope item set (fetchPrepBundle's `items`), not from
  // the toggle-filtered, hypo-capped `queue`.
  fireEvent.click(screen.getByText(/skip hypos/i));
  await waitFor(() => expect(headerText()).toMatch(/1 \/ 1/));
  const after = pct(headerText());

  expect(after).toBe(before);
});
