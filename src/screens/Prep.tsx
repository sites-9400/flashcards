import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchPrepBundle, fetchEvents, persistReview } from '../lib/data';
import { buildPrepQueue, type PrepItem } from '../lib/queue';
import { applyReviewClamped, newCardState, previewIntervals } from '../lib/scheduler';
import { inScope, eventReadiness } from '../lib/stats';
import BasicClozeReview from '../components/BasicClozeReview';
import McqReview from '../components/McqReview';
import HypoReview from '../components/HypoReview';
import { requestAiGrading } from '../lib/grade';
import type { CardStateDoc, EventDoc, Grade, GradeExtras } from '../lib/types';

export default function Prep() {
  const { eventId = '' } = useParams();
  const { user } = useUser();
  const [queue, setQueue] = useState<PrepItem[]>([]);
  const [states, setStates] = useState<Map<string, CardStateDoc>>(new Map());
  const [pos, setPos] = useState(0);
  const [event, setEvent] = useState<EventDoc | null>(null);
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
      fetchPrepBundle(user.uid, eventId),
      fetchEvents(user.uid),
    ]).then(([b, evs]) => {
      if (cancelled) return;
      setEvent(b.event);
      setStates(b.states);
      setPos(0);
      setEvents(evs);
      setQueue(buildPrepQueue(b.items, b.states, new Date(), skipHypos));
      setStatus('ready');
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [user, eventId, skipHypos]);

  const item = queue[pos];
  const card = item?.card;
  const state = card ? states.get(card.id) : undefined;
  const intervals = useMemo(
    () => (card && item ? previewIntervals(state ?? newCardState(item.deckId, card.id), new Date()) : null),
    [card, item, state],
  );
  const readiness = useMemo(
    () => Math.round(eventReadiness(queue.map((i) => ({ deckId: i.deckId, cardId: i.card.id })), states, new Date()) * 100),
    [queue, states],
  );

  // Re-entrancy: unreachable via normal input. React 18 flushes state updates
  // before the next discrete event and the grading UI unmounts after each
  // grade, so key repeat or double click cannot double-grade a card.
  const grade = useCallback((g: Grade, extras?: GradeExtras) => {
    if (!item || !user) return;
    const { deckId, card: c } = item;
    const prev = states.get(c.id);
    const dates = events
      .filter((ev) => ev.date > Date.now() && inScope(deckId, c.tags, ev))
      .map((ev) => ev.date);
    const next = applyReviewClamped(prev ?? newCardState(deckId, c.id), g, new Date(), dates);
    void persistReview(user.uid, c, prev, next, g, extras).catch(() => setSyncIssue(true));
    setStates((m) => new Map(m).set(c.id, next));
    setRound((r) => r + 1);
    if (g === 'again') {
      setQueue((q) => [...q.slice(0, pos), ...q.slice(pos + 1), item]);
    } else {
      setPos((p) => p + 1);
    }
  }, [item, user, states, pos, events]);

  if (status === 'loading') return <p className="p-6 text-sm opacity-60">Loading...</p>;

  if (status === 'error') {
    return (
      <main className="max-w-xl mx-auto p-4">
        <p className="mb-4">This event could not be loaded. It may have been removed.</p>
        <Link className="underline text-maroon" to="/events">Back to events</Link>
      </main>
    );
  }

  if (!card || !item) {
    return (
      <main className="max-w-xl mx-auto p-4">
        <p className="mb-4">Nothing in scope.</p>
        <Link className="underline text-maroon" to="/events">Back to events</Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto p-4 flex flex-col gap-4">
      <header className="flex justify-between text-sm opacity-70">
        <Link to="/events" className="underline">Prep: {event?.title}</Link>
        <span>
          <button
            className={'underline mr-3 ' + (skipHypos ? 'text-maroon font-semibold' : '')}
            onClick={() => setSkipHypos((s) => !s)}
          >
            {skipHypos ? 'hypos off' : 'skip hypos'}
          </button>
          {syncIssue && <span className="text-maroon mr-2">sync pending</span>}
          readiness {readiness}%: {pos + 1} / {queue.length}
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
