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
