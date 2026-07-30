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

it('confirms with no extras when nothing was typed and no AI ran', () => {
  const onGrade = vi.fn();
  render(<HypoReview card={card} intervals={intervals} onGrade={onGrade} />);
  revealAll();
  screen.getAllByRole('button', { name: 'Got it' }).forEach((b) => fireEvent.click(b));
  fireEvent.click(screen.getByRole('button', { name: /Good/ }));
  expect(onGrade).toHaveBeenCalledWith('good', undefined);
});

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

it('lists past typed answers on demand after full reveal', async () => {
  const pastAnswers = vi.fn().mockResolvedValue([{ ts: 1753800000000, typedAnswer: 'old answer' }]);
  render(<HypoReview card={card} intervals={intervals} onGrade={vi.fn()} pastAnswers={pastAnswers} />);
  revealAll();
  fireEvent.click(screen.getByRole('button', { name: /past answers/i }));
  expect(await screen.findByText(/old answer/)).toBeInTheDocument();
  expect(pastAnswers).toHaveBeenCalledTimes(1);
});
