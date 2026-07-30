import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LogLike } from '../lib/stats';

vi.mock('../lib/auth', () => ({ useUser: () => ({ user: { uid: 'u1' }, loading: false }) }));
vi.mock('../lib/data', () => ({ fetchRecentLogs: vi.fn() }));

import Weak from './Weak';
import { fetchRecentLogs } from '../lib/data';

afterEach(() => cleanup());

it('renders the ranked weak-topic rows', async () => {
  const log = (tag: string, grade: LogLike['grade'], k: number): LogLike =>
    ({ ts: k, grade, tags: [tag], deckId: 'd1', cardId: 'c1' });
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
