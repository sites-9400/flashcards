import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import HypoReview from './HypoReview';
import type { HypoCard, Grade } from '../lib/types';

afterEach(() => {
  cleanup();
});

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
