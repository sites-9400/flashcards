import { describe, it, expect } from 'vitest';
import { cardSchema } from './schema';

const base = { id: 'abc123', tags: ['jurisdiction'], source: { docId: 'd1', heading: 'II. Codal' } };

describe('cardSchema', () => {
  it('accepts a valid basic card', () => {
    const r = cardSchema.safeParse({ ...base, type: 'basic', front: 'Q?', back: 'A.' });
    expect(r.success).toBe(true);
  });
  it('accepts a valid cloze card and requires a marker', () => {
    expect(cardSchema.safeParse({ ...base, type: 'cloze', text: 'up to {{c1::P2,000,000}}', clozeIndex: 1 }).success).toBe(true);
    expect(cardSchema.safeParse({ ...base, type: 'cloze', text: 'no marker here', clozeIndex: 1 }).success).toBe(false);
  });
  it('rejects mcq with out-of-range correctIndex', () => {
    const r = cardSchema.safeParse({ ...base, type: 'mcq', stem: 'Which?', choices: ['a', 'b'], correctIndex: 5, explanation: 'x' });
    expect(r.success).toBe(false);
  });
  it('requires all four ALAC beats on hypo', () => {
    const r = cardSchema.safeParse({
      ...base, type: 'hypo', facts: 'F', question: 'Whether or not X',
      alac: { answer: 'No.', legalBasis: 'Rule (Case, G.R. No. 1)', application: 'In this case, Y', conclusion: 'Hence, Z' },
    });
    expect(r.success).toBe(true);
    const bad = cardSchema.safeParse({ ...base, type: 'hypo', facts: 'F', question: 'Q', alac: { answer: 'No.' } });
    expect(bad.success).toBe(false);
  });
  it('rejects em dashes and emojis anywhere in content', () => {
    expect(cardSchema.safeParse({ ...base, type: 'basic', front: 'bad — dash', back: 'A' }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, type: 'basic', front: 'ok', back: 'fire 🔥' }).success).toBe(false);
  });
});
