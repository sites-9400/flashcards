import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchDeckBundle, fetchEvents, persistReview } from '../lib/data';
import { buildQueue } from '../lib/queue';
import { applyReviewClamped, newCardState, previewIntervals } from '../lib/scheduler';
import { inScope } from '../lib/stats';
import BasicClozeReview from '../components/BasicClozeReview';
import McqReview from '../components/McqReview';
import HypoReview from '../components/HypoReview';
import { requestAiGrading } from '../lib/grade';
import type { Card, CardStateDoc, EventDoc, Grade, GradeExtras } from '../lib/types';

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
  const [skipHypos, setSkipHypos] = useState(false);
  const [events, setEvents] = useState<EventDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setStatus('loading');
    void Promise.all([
      fetchDeckBundle(user.uid, deckId),
      fetchEvents(user.uid),
    ]).then(([b, evs]) => {
      if (cancelled) return;
      setTitle(b.deck.title);
      setStates(b.states);
      setPos(0);
      setEvents(evs);
      setQueue(buildQueue({
        cards: b.cards,
        states: b.states,
        newCardsPerDay: b.subscription?.newCardsPerDay ?? 15,
        newIntroducedToday: b.newIntroducedToday,
        now: new Date(),
        skipHypos,
      }));
      setStatus('ready');
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [user, deckId, skipHypos]);

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
    const dates = events
      .filter((ev) => ev.date > Date.now() && inScope(deckId, card.tags, ev))
      .map((ev) => ev.date);
    const next = applyReviewClamped(prev ?? newCardState(deckId, card.id), g, new Date(), dates);
    void persistReview(user.uid, card, prev, next, g, extras).catch(() => setSyncIssue(true));
    setStates((m) => new Map(m).set(card.id, next));
    setRound((r) => r + 1);
    if (g === 'again') {
      setQueue((q) => [...q.slice(0, pos), ...q.slice(pos + 1), card]);
    } else {
      setPos((p) => p + 1);
    }
  }, [card, user, states, deckId, pos, events]);

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
          <button
            className={'underline mr-3 ' + (skipHypos ? 'text-maroon font-semibold' : '')}
            onClick={() => setSkipHypos((s) => !s)}
          >
            {skipHypos ? 'hypos off' : 'skip hypos'}
          </button>
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
      {card.type === 'hypo' && intervals && (
        <HypoReview key={card.id + '-' + round} card={card} intervals={intervals} onGrade={grade} aiCheck={requestAiGrading} />
      )}
    </main>
  );
}
