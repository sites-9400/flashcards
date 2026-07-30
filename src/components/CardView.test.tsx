import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CardView from './CardView';
import type { ClozeCard } from '../lib/types';

const cloze: ClozeCard = {
  id: 'c1', type: 'cloze', tags: ['t'], source: { docId: 'd', heading: 'h' },
  text: 'claims up to {{c1::P2,000,000}} and value up to {{c2::P400,000}}',
  clozeIndex: 1,
};

describe('CardView cloze', () => {
  it('blanks only its own deletion on the front', () => {
    render(<CardView card={cloze} revealed={false} />);
    expect(screen.queryByText(/P2,000,000/)).toBeNull();
    expect(screen.getByText(/P400,000/)).toBeInTheDocument();
  });
  it('reveals its deletion in maroon on the back', () => {
    render(<CardView card={cloze} revealed={true} />);
    const el = screen.getByText('P2,000,000');
    expect(el.className).toContain('text-maroon');
  });
});
