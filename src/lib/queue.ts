import type { Card, CardStateDoc } from './types';

const HYPO_COST = 3;
export const MAX_SESSION_HYPOS = 3;

function interleaveHypos(cards: Card[]): Card[] {
  const hypos = cards.filter((c) => c.type === 'hypo').slice(0, MAX_SESSION_HYPOS);
  const others: Card[] = cards.filter((c) => c.type !== 'hypo');
  if (hypos.length === 0) return others;
  const out = [...others];
  hypos.forEach((h, i) => {
    const pos = Math.round(((i + 1) * others.length) / (hypos.length + 1)) + i;
    out.splice(Math.min(pos, out.length), 0, h);
  });
  return out;
}

export function buildQueue(args: {
  cards: Card[];
  states: Map<string, CardStateDoc>;
  newCardsPerDay: number;
  newIntroducedToday: number;
  now: Date;
  skipHypos?: boolean;
}): Card[] {
  const { states, newCardsPerDay, newIntroducedToday, now } = args;
  const cards = args.skipHypos ? args.cards.filter((c) => c.type !== 'hypo') : args.cards;

  const dueCards = cards
    .filter((c) => { const s = states.get(c.id); return s !== undefined && s.due <= now.getTime(); })
    .sort((a, b) => states.get(a.id)!.due - states.get(b.id)!.due);

  let budget = Math.max(0, newCardsPerDay - newIntroducedToday);
  const newCards: Card[] = [];
  for (const c of cards) {
    if (states.has(c.id)) continue;
    const cost = c.type === 'hypo' ? HYPO_COST : 1;
    if (cost > budget) continue;
    budget -= cost;
    newCards.push(c);
  }
  return interleaveHypos([...dueCards, ...newCards]);
}
