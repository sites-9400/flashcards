import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { startOfStudyDay } from '../lib/scheduler';
import { newCardState } from '../lib/scheduler';
import type { LogLike } from '../lib/stats';

vi.mock('../lib/auth', () => ({ useUser: () => ({ user: { uid: 'u1', displayName: 'G' }, loading: false }), signOutUser: vi.fn() }));
vi.mock('../lib/data', () => ({ fetchHomeBundle: vi.fn() }));

import Home from './Home';
import { fetchHomeBundle } from '../lib/data';

afterEach(() => cleanup());

it('renders strip, due badge, event row, and weak link from the bundle', async () => {
  const now = Date.now();
  const sod = startOfStudyDay(new Date(now));
  const log = (ts: number, grade: LogLike['grade'] = 'good', firstReview = false): LogLike =>
    ({ ts, grade, tags: ['venue'], deckId: 'd1', cardId: 'c1', firstReview });
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
  // Both the Retention tile and the per-deck retention row now read the
  // same full 30-day logs window, so they agree at 83% and both match.
  expect(screen.getAllByText(/83%/)).toHaveLength(2);
  expect(screen.getByText(/1 due/)).toBeInTheDocument();
  expect(screen.getByText(/2 in scope/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /prepare/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /weak topics/i })).toBeInTheDocument();
});
