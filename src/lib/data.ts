import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { stateId } from './ids';
import { studyDay } from './scheduler';
import type { Card, CardStateDoc, Deck, Grade, SubscriptionDoc } from './types';

export async function fetchDecks(uid: string): Promise<Deck[]> {
  const snap = await getDocs(query(collection(db, 'decks'), where('ownerUid', '==', uid)));
  return snap.docs.map((d) => d.data() as Deck);
}

export async function fetchDeckBundle(uid: string, deckId: string) {
  const [deckSnap, cardsSnap, statesSnap, subSnap, logsSnap] = await Promise.all([
    getDoc(doc(db, 'decks', deckId)),
    getDocs(collection(db, 'decks', deckId, 'cards')),
    getDocs(query(collection(db, 'users', uid, 'cardStates'), where('deckId', '==', deckId))),
    getDoc(doc(db, 'users', uid, 'subscriptions', deckId)),
    getDocs(query(collection(db, 'users', uid, 'reviewLogs'), where('deckId', '==', deckId))),
  ]);
  if (!deckSnap.exists()) throw new Error('deck-not-found');
  const deck = deckSnap.data() as Deck;
  const cards = cardsSnap.docs.map((d) => d.data() as Card);
  const states = new Map<string, CardStateDoc>();
  statesSnap.docs.forEach((d) => { const s = d.data() as CardStateDoc; states.set(s.cardId, s); });
  const today = studyDay(new Date());
  const newIntroducedToday = logsSnap.docs
    .map((d) => d.data() as { ts: number; firstReview?: boolean })
    .filter((l) => l.firstReview === true && studyDay(new Date(l.ts)) === today).length;
  return {
    deck, cards, states,
    subscription: (subSnap.data() as SubscriptionDoc | undefined) ?? null,
    newIntroducedToday,
  };
}

export async function persistReview(
  uid: string, card: Card, prev: CardStateDoc | undefined, next: CardStateDoc, grade: Grade,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'cardStates', stateId(next.deckId, next.cardId)), next);
  batch.set(doc(collection(db, 'users', uid, 'reviewLogs')), {
    cardId: next.cardId, deckId: next.deckId, grade, tags: card.tags,
    ts: Date.now(), firstReview: prev === undefined, createdAt: serverTimestamp(),
  });
  await batch.commit();
}
