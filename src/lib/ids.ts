import type { CardType } from './types';

// FNV-1a 32-bit, base-36 output; stable across runs and platforms.
// The cardId concatenates two variable-length base-36 hashes (1-7 chars each), so halves are not fixed-width.
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function cardId(source: { docId: string; heading: string; type: CardType; slug: string }): string {
  const key = [source.docId, source.heading, source.type, source.slug].join('|');
  return fnv1a(key) + fnv1a(key.split('').reverse().join(''));
}

export function stateId(deckId: string, cardId: string): string {
  return `${deckId}_${cardId}`;
}
