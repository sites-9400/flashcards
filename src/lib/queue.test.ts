import { describe, it, expect } from 'vitest';
import { buildQueue } from './queue';
import { newCardState } from './scheduler';
import type { Card, CardStateDoc } from './types';

const NOW = new Date('2026-07-30T10:00:00+08:00');
const src = { docId: 'd', heading: 'h' };
const mk = (id: string, type: Card['type']): Card =>
  type === 'basic'
    ? { id, type, tags: ['t'], source: src, front: 'f', back: 'b' }
    : type === 'cloze'
      ? { id, type, tags: ['t'], source: src, text: '{{c1::x}}', clozeIndex: 1 }
      : type === 'mcq'
        ? { id, type, tags: ['t'], source: src, stem: 's', choices: ['a', 'b'], correctIndex: 0, explanation: 'e' }
        : { id, type, tags: ['t'], source: src, facts: 'f', question: 'q', alac: { answer: 'a', legalBasis: 'l', application: 'ap', conclusion: 'c' } };

function due(id: string, offsetMs: number): CardStateDoc {
  return { ...newCardState('d1', id), due: NOW.getTime() + offsetMs, state: 'review' };
}

describe('buildQueue', () => {
  it('puts due cards first, ordered by due date', () => {
    const cards = [mk('a', 'basic'), mk('b', 'basic'), mk('c', 'basic')];
    const states = new Map([['b', due('b', -1000)], ['a', due('a', -5000)]]);
    const q = buildQueue({ cards, states, newCardsPerDay: 0, newIntroducedToday: 0, now: NOW });
    expect(q.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('introduces new cards up to the allotment, hypos costing 3', () => {
    const cards = [mk('h1', 'hypo'), mk('n1', 'basic'), mk('n2', 'basic'), mk('n3', 'basic')];
    const q = buildQueue({ cards, states: new Map(), newCardsPerDay: 4, newIntroducedToday: 0, now: NOW });
    // hypo (3) + one basic (1) = 4 slots
    expect(q).toHaveLength(2);
  });

  it('respects cards already introduced today', () => {
    const cards = [mk('n1', 'basic'), mk('n2', 'basic')];
    const q = buildQueue({ cards, states: new Map(), newCardsPerDay: 2, newIntroducedToday: 1, now: NOW });
    expect(q).toHaveLength(1);
  });

  it('skipHypos removes hypos, due or new', () => {
    const cards = [mk('h1', 'hypo'), mk('n1', 'basic')];
    const states = new Map([['h1', due('h1', -1000)]]);
    const q = buildQueue({ cards, states, newCardsPerDay: 5, newIntroducedToday: 0, now: NOW, skipHypos: true });
    expect(q.map((c) => c.id)).toEqual(['n1']);
  });

  it('future-due cards are neither due nor new', () => {
    const cards = [mk('a', 'basic')];
    const states = new Map([['a', due('a', +999999)]]);
    const q = buildQueue({ cards, states, newCardsPerDay: 5, newIntroducedToday: 0, now: NOW });
    expect(q).toHaveLength(0);
  });

  it('skips a hypo that exceeds remaining budget but still admits a later cheaper card', () => {
    const hypo: Card = {
      id: 'h1', type: 'hypo', facts: 'F', question: 'Q',
      alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
      tags: ['t'], source: { docId: 'd', heading: 'h' },
    };
    const basic: Card = {
      id: 'b1', type: 'basic', front: 'f', back: 'b',
      tags: ['t'], source: { docId: 'd', heading: 'h' },
    };
    const q = buildQueue({
      cards: [hypo, basic], states: new Map(),
      newCardsPerDay: 2, newIntroducedToday: 0, now: NOW,
    });
    expect(q.map((c) => c.id)).toEqual(['b1']);
  });

  it('caps hypos at MAX_SESSION_HYPOS per session', () => {
    const mkHypo = (id: string): Card => ({
      id, type: 'hypo', facts: 'F', question: 'Q',
      alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
      tags: ['t'], source: { docId: 'd', heading: 'h' },
    });
    const hypos = ['h1', 'h2', 'h3', 'h4', 'h5'].map(mkHypo);
    const q = buildQueue({
      cards: hypos, states: new Map(),
      newCardsPerDay: 50, newIntroducedToday: 0, now: NOW,
    });
    expect(q.filter((c) => c.type === 'hypo').length).toBe(3);
  });

  it('interleaves hypos through the queue instead of clumping them', () => {
    const mkBasic = (id: string): Card => ({
      id, type: 'basic', front: 'f', back: 'b', tags: ['t'], source: { docId: 'd', heading: 'h' },
    });
    const hypo: Card = {
      id: 'h1', type: 'hypo', facts: 'F', question: 'Q',
      alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
      tags: ['t'], source: { docId: 'd', heading: 'h' },
    };
    const cards = [hypo, ...['b1', 'b2', 'b3', 'b4'].map(mkBasic)];
    const q = buildQueue({
      cards, states: new Map(),
      newCardsPerDay: 50, newIntroducedToday: 0, now: NOW,
    });
    const hypoPos = q.findIndex((c) => c.id === 'h1');
    expect(hypoPos).toBeGreaterThan(0);
    expect(q.length).toBe(5);
  });
});
