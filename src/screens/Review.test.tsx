import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Card } from '../lib/types';

vi.mock('../lib/auth', () => {
  const user = { uid: 'u1' };
  return { useUser: () => ({ user, loading: false }) };
});
vi.mock('../lib/data', () => ({
  fetchDeckBundle: vi.fn(),
  persistReview: vi.fn().mockResolvedValue(undefined),
  fetchEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/grade', () => ({ requestAiGrading: vi.fn() }));

import Review from './Review';
import { fetchDeckBundle, fetchEvents, persistReview } from '../lib/data';
import type { CardStateDoc, EventDoc } from '../lib/types';

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

const DAY = 24 * 60 * 60 * 1000;

it('clamps the graded due date to the day before an in-scope upcoming event', async () => {
  const now = Date.now();
  const eventDate = now + 3 * DAY;
  const reviewState: CardStateDoc = {
    deckId: 'd1', cardId: 'b1', due: now, stability: 60, difficulty: 5,
    elapsedDays: 10, scheduledDays: 10, reps: 4, lapses: 0,
    state: 'review', lastReview: now - 10 * DAY, learningSteps: 0,
  };
  const event: EventDoc = {
    id: 'e1', type: 'exam', subject: 'S', title: 'Midterm', date: eventDate,
    coverage: { deckIds: ['d1'], tags: [] },
  };
  vi.mocked(fetchDeckBundle).mockResolvedValue({
    deck: { id: 'd1', ownerUid: 'u1', title: 'Deck', subject: 'S', description: '', visibility: 'private', cardCount: 1, createdAt: 0, updatedAt: 0 },
    cards: [basic], states: new Map([['b1', reviewState]]), subscription: null, newIntroducedToday: 0,
  });
  vi.mocked(fetchEvents).mockResolvedValue([event]);
  renderReview();
  fireEvent.click(await screen.findByText('the front'));
  fireEvent.click(screen.getByRole('button', { name: /Easy/ }));
  const persisted = vi.mocked(persistReview).mock.calls[0][3] as CardStateDoc;
  expect(persisted.due).toBeLessThanOrEqual(eventDate - DAY);
});

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
