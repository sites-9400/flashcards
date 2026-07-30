import { it, expect, vi, afterEach } from 'vitest';
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

afterEach(() => { cleanup(); vi.clearAllMocks(); });

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

it('does not persist an event when the date field is left empty', async () => {
  render(<MemoryRouter><Events /></MemoryRouter>);
  await screen.findByLabelText(/Civ Pro/);
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Undated recit' } });
  const form = screen.getByRole('button', { name: /save/i }).closest('form')!;
  fireEvent.submit(form);
  expect(saveEvent).not.toHaveBeenCalled();
});
