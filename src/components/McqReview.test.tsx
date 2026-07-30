import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import McqReview from './McqReview';
import type { McqCard, Grade } from '../lib/types';

afterEach(() => {
  cleanup();
});

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
