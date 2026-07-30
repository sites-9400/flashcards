import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { stateId } from './ids';
import { startOfStudyDay, studyDay } from './scheduler';
import { inScope, type LogLike } from './stats';
import type { PrepItem } from './queue';
import type { Card, CardStateDoc, Deck, EventDoc, Grade, GradeExtras, SubscriptionDoc } from './types';

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
    getDocs(query(
      collection(db, 'users', uid, 'reviewLogs'),
      where('deckId', '==', deckId),
      where('ts', '>=', startOfStudyDay(new Date())),
    )),
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
  uid: string, card: Card, prev: CardStateDoc | undefined, next: CardStateDoc,
  grade: Grade, extras?: GradeExtras,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'cardStates', stateId(next.deckId, next.cardId)), next);
  const log: Record<string, unknown> = {
    cardId: next.cardId, deckId: next.deckId, grade, tags: card.tags,
    ts: Date.now(), firstReview: prev === undefined, createdAt: serverTimestamp(),
  };
  if (extras?.typedAnswer) log.typedAnswer = extras.typedAnswer;
  if (extras?.aiVerdicts) log.aiVerdicts = extras.aiVerdicts;
  batch.set(doc(collection(db, 'users', uid, 'reviewLogs')), log);
  await batch.commit();
}

export async function fetchEvents(uid: string): Promise<EventDoc[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'events'));
  return snap.docs.map((d) => d.data() as EventDoc).sort((a, b) => a.date - b.date);
}

export async function saveEvent(
  uid: string, event: Omit<EventDoc, 'id'> & { id?: string },
): Promise<string> {
  const ref = event.id
    ? doc(db, 'users', uid, 'events', event.id)
    : doc(collection(db, 'users', uid, 'events'));
  await setDoc(ref, { ...event, id: ref.id });
  return ref.id;
}

export async function deleteEvent(uid: string, eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'events', eventId));
}

export async function fetchPrepBundle(uid: string, eventId: string): Promise<{
  event: EventDoc; items: PrepItem[]; states: Map<string, CardStateDoc>;
}> {
  const [eventSnap, decks, statesSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid, 'events', eventId)),
    fetchDecks(uid),
    getDocs(collection(db, 'users', uid, 'cardStates')),
  ]);
  if (!eventSnap.exists()) throw new Error('event-not-found');
  const event = eventSnap.data() as EventDoc;

  const cardsSnaps = await Promise.all(
    decks.map((deck) => getDocs(collection(db, 'decks', deck.id, 'cards'))),
  );
  const items: PrepItem[] = [];
  decks.forEach((deck, i) => {
    cardsSnaps[i].docs.forEach((d) => {
      const card = d.data() as Card;
      if (inScope(deck.id, card.tags, event)) items.push({ deckId: deck.id, card });
    });
  });

  const states = new Map<string, CardStateDoc>();
  statesSnap.docs.forEach((d) => { const s = d.data() as CardStateDoc; states.set(s.cardId, s); });

  return { event, items, states };
}

export async function fetchHomeBundle(uid: string): Promise<{
  decks: Deck[];
  events: EventDoc[];
  states: CardStateDoc[];
  logs: LogLike[];
  eventCards: Map<string, { deckId: string; cardId: string; tags: string[] }[]>;
}> {
  const now = new Date();
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const [decks, allEvents, statesSnap, logsSnap] = await Promise.all([
    fetchDecks(uid),
    fetchEvents(uid),
    getDocs(collection(db, 'users', uid, 'cardStates')),
    getDocs(query(collection(db, 'users', uid, 'reviewLogs'), where('ts', '>=', cutoff))),
  ]);
  const events = allEvents.filter((e) => e.date >= startOfStudyDay(now));
  const states = statesSnap.docs.map((d) => d.data() as CardStateDoc);
  const logs = logsSnap.docs.map((d) => d.data() as LogLike);

  // Decks worth reading cards for: any deck an upcoming event names directly
  // via coverage.deckIds, plus (when any upcoming event also has coverage
  // tags) every owned deck, since a tag match can live on a card in any
  // deck. With v1 deck counts this is at most a handful of extra reads.
  const targetDeckIds = new Set<string>();
  events.forEach((e) => e.coverage.deckIds.forEach((id) => targetDeckIds.add(id)));
  if (events.some((e) => e.coverage.tags.length > 0)) {
    decks.forEach((d) => targetDeckIds.add(d.id));
  }
  const targetDecks = decks.filter((d) => targetDeckIds.has(d.id));

  const cardsSnaps = await Promise.all(
    targetDecks.map((deck) => getDocs(collection(db, 'decks', deck.id, 'cards'))),
  );
  const allCards: { deckId: string; card: Card }[] = [];
  targetDecks.forEach((deck, i) => {
    cardsSnaps[i].docs.forEach((d) => allCards.push({ deckId: deck.id, card: d.data() as Card }));
  });

  const eventCards = new Map<string, { deckId: string; cardId: string; tags: string[] }[]>();
  events.forEach((event) => {
    const refs = allCards
      .filter(({ deckId, card }) => inScope(deckId, card.tags, event))
      .map(({ deckId, card }) => ({ deckId, cardId: card.id, tags: card.tags }));
    eventCards.set(event.id, refs);
  });

  return { decks, events, states, logs, eventCards };
}
