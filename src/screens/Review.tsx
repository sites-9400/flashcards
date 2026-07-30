import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchDeckBundle, persistReview } from '../lib/data';
import { buildQueue } from '../lib/queue';
import { applyReview, newCardState, previewIntervals } from '../lib/scheduler';
import CardView from '../components/CardView';
import GradeBar from '../components/GradeBar';
import type { Card, CardStateDoc, Grade } from '../lib/types';

export default function Review() {
  const { deckId = '' } = useParams();
  const { user } = useUser();
  const [queue, setQueue] = useState<Card[]>([]);
  const [states, setStates] = useState<Map<string, CardStateDoc>>(new Map());
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!user) return;
    void fetchDeckBundle(user.uid, deckId).then((b) => {
      setTitle(b.deck.title);
      setStates(b.states);
      setQueue(buildQueue({
        cards: b.cards.filter((c) => c.type === 'basic' || c.type === 'cloze'),
        states: b.states,
        newCardsPerDay: b.subscription?.newCardsPerDay ?? 15,
        newIntroducedToday: b.newIntroducedToday,
        now: new Date(),
      }));
    });
  }, [user, deckId]);

  const card = queue[pos];
  const state = card ? states.get(card.id) : undefined;
  const intervals = useMemo(
    () => (card ? previewIntervals(state ?? newCardState(deckId, card.id), new Date()) : null),
    [card, state, deckId],
  );

  const grade = useCallback((g: Grade) => {
    if (!card || !user) return;
    const prev = states.get(card.id);
    const next = applyReview(prev ?? newCardState(deckId, card.id), g, new Date());
    void persistReview(user.uid, card, prev, next, g);
    setStates((m) => new Map(m).set(card.id, next));
    setRevealed(false);
    if (g === 'again') {
      setQueue((q) => [...q.slice(0, pos), ...q.slice(pos + 1), card]);
    } else {
      setPos((p) => p + 1);
    }
  }, [card, user, states, deckId, pos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setRevealed(true); }
      const map: Record<string, Grade> = { Digit1: 'again', Digit2: 'hard', Digit3: 'good', Digit4: 'easy' };
      if (revealed && map[e.code]) grade(map[e.code]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, grade]);

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
        <span>{pos + 1} / {queue.length}</span>
      </header>
      <div onClick={() => setRevealed(true)}>
        <CardView card={card} revealed={revealed} />
        {!revealed && <p className="text-center text-sm opacity-50 mt-3">tap or press space to reveal</p>}
      </div>
      {revealed && intervals && <GradeBar intervals={intervals} onGrade={grade} />}
    </main>
  );
}
