import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchDeckBundle, persistReview } from '../lib/data';
import { buildQueue } from '../lib/queue';
import { applyReview, newCardState, previewIntervals } from '../lib/scheduler';
import BasicClozeReview from '../components/BasicClozeReview';
import McqReview from '../components/McqReview';
import type { Card, CardStateDoc, Grade, GradeExtras } from '../lib/types';

export default function Review() {
  const { deckId = '' } = useParams();
  const { user } = useUser();
  const [queue, setQueue] = useState<Card[]>([]);
  const [states, setStates] = useState<Map<string, CardStateDoc>>(new Map());
  const [pos, setPos] = useState(0);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [syncIssue, setSyncIssue] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setStatus('loading');
    void fetchDeckBundle(user.uid, deckId).then((b) => {
      if (cancelled) return;
      setTitle(b.deck.title);
      setStates(b.states);
      setPos(0);
      setQueue(buildQueue({
        cards: b.cards.filter((c) => c.type === 'basic' || c.type === 'cloze' || c.type === 'mcq'),
        states: b.states,
        newCardsPerDay: b.subscription?.newCardsPerDay ?? 15,
        newIntroducedToday: b.newIntroducedToday,
        now: new Date(),
      }));
      setStatus('ready');
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [user, deckId]);

  const card = queue[pos];
  const state = card ? states.get(card.id) : undefined;
  const intervals = useMemo(
    () => (card ? previewIntervals(state ?? newCardState(deckId, card.id), new Date()) : null),
    [card, state, deckId],
  );

  // Re-entrancy: unreachable via normal input. React 18 flushes state updates
  // before the next discrete event and the grading UI unmounts after each
  // grade, so key repeat or double click cannot double-grade a card.
  const grade = useCallback((g: Grade, extras?: GradeExtras) => {
    if (!card || !user) return;
    const prev = states.get(card.id);
    const next = applyReview(prev ?? newCardState(deckId, card.id), g, new Date());
    void persistReview(user.uid, card, prev, next, g, extras).catch(() => setSyncIssue(true));
    setStates((m) => new Map(m).set(card.id, next));
    setRound((r) => r + 1);
    if (g === 'again') {
      setQueue((q) => [...q.slice(0, pos), ...q.slice(pos + 1), card]);
    } else {
      setPos((p) => p + 1);
    }
  }, [card, user, states, deckId, pos]);

  if (status === 'loading') return <p className="p-6 text-sm opacity-60">Loading...</p>;

  if (status === 'error') {
    return (
      <main className="max-w-xl mx-auto p-4">
        <p className="mb-4">This deck could not be loaded. It may have been removed.</p>
        <Link className="underline text-maroon" to="/">Back to decks</Link>
      </main>
    );
  }

  if (!card) {
    return (
      <main className="max-w-xl mx-auto p-4">
        <p className="mb-4">Done for now. Nothing due in this deck.</p>
        <Link className="underline text-maroon" to="/">Back to decks</Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto p-4 flex flex-col gap-4">
      <header className="flex justify-between text-sm opacity-70">
        <Link to="/" className="underline">{title}</Link>
        <span>
          {syncIssue && <span className="text-maroon mr-2">sync pending</span>}
          {pos + 1} / {queue.length}
        </span>
      </header>
      {(card.type === 'basic' || card.type === 'cloze') && intervals && (
        <BasicClozeReview key={card.id + '-' + round} card={card} intervals={intervals} onGrade={grade} />
      )}
      {card.type === 'mcq' && intervals && (
        <McqReview key={card.id + '-' + round} card={card} intervals={intervals} onGrade={grade} />
      )}
      {card.type === 'hypo' && (
        <div className="border border-mustard rounded-lg p-4 text-sm opacity-70">
          HYPO cards arrive in the next milestone.
        </div>
      )}
    </main>
  );
}
