import { describe, it, expect } from 'vitest';
import { cardId, stateId } from './ids';

describe('ids', () => {
  it('is deterministic and source-sensitive', () => {
    const a = cardId({ docId: 'd1', heading: 'II', type: 'basic', slug: 'sale-vs-agency' });
    const b = cardId({ docId: 'd1', heading: 'II', type: 'basic', slug: 'sale-vs-agency' });
    const c = cardId({ docId: 'd1', heading: 'II', type: 'basic', slug: 'other' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-z0-9]+$/);
  });
  it('joins state ids with underscore', () => {
    expect(stateId('deckA', 'card1')).toBe('deckA_card1');
  });
});
