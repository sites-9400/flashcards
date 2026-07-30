import type { Card, CardStateDoc } from './types';

const HYPO_COST = 3;

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
  return [...dueCards, ...newCards];
}
