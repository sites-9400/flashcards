import type { Card } from '../lib/types';
import type { ReactNode } from 'react';

const CLOZE_RE = /\{\{c(\d+)::([^}]+)\}\}/g;

function renderCloze(text: string, ownIndex: number, revealed: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0; let key = 0;
  for (const m of text.matchAll(CLOZE_RE)) {
    out.push(text.slice(last, m.index));
    const idx = Number(m[1]);
    if (idx !== ownIndex) {
      out.push(m[2]);
    } else if (revealed) {
      out.push(<span key={key++} className="text-maroon font-bold border-b-2 border-mustard">{m[2]}</span>);
    } else {
      out.push(<span key={key++} className="inline-block min-w-20 border-b-2 border-mustard">&nbsp;</span>);
    }
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

export default function CardView({ card, revealed }: { card: Card; revealed: boolean }) {
  if (card.type === 'basic') {
    return (
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{card.front}</p>
        {revealed && <p className="mt-3 pt-3 border-t border-mustard/50">{card.back}</p>}
      </div>
    );
  }
  if (card.type === 'cloze') {
    return (
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{renderCloze(card.text, card.clozeIndex, revealed)}</p>
      </div>
    );
  }
  return (
    <div className="border border-mustard rounded-lg p-4 text-sm opacity-70">
      {card.type.toUpperCase()} cards arrive in the next milestone.
    </div>
  );
}
