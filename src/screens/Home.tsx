import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser, signOutUser } from '../lib/auth';
import { fetchHomeBundle } from '../lib/data';
import { studyDay } from '../lib/scheduler';
import {
  streak, reviewsToday, timeSpentTodayMs, trueRetention, dueForecast, weakSpots, eventReadiness,
} from '../lib/stats';
import type { CardStateDoc } from '../lib/types';

type HomeBundle = Awaited<ReturnType<typeof fetchHomeBundle>>;

const EMPTY_BUNDLE: HomeBundle = {
  decks: [], events: [], states: [], logs: [], eventCards: new Map(),
};

export default function Home() {
  const { user } = useUser();
  const [bundle, setBundle] = useState<HomeBundle>(EMPTY_BUNDLE);
  useEffect(() => {
    if (user) void fetchHomeBundle(user.uid).then(setBundle);
  }, [user]);

  const { decks, events, states, logs, eventCards } = bundle;
  const now = new Date();
  const nowMs = now.getTime();

  const stateMap = new Map<string, CardStateDoc>();
  states.forEach((s) => stateMap.set(s.cardId, s));

  // The strip's Retention tile reads today's slice of the already-fetched
  // 30-day `logs` array (no separate query), same day-scoping as
  // reviewsToday, so it reflects the studying just done today.
  const todayLogs = logs.filter((l) => studyDay(new Date(l.ts)) === studyDay(now));
  const retention = trueRetention(todayLogs);
  const forecast = dueForecast(states, now, 7);
  const weakList = weakSpots(logs);
  const topWeak = weakList.slice(0, 3);

  return (
    <main className="max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-maroon">LawDeck</h1>
        <div>
          <Link to="/events" className="text-sm underline mr-3">events</Link>
          <button className="text-sm underline" onClick={() => void signOutUser()}>
            {user?.displayName ?? 'account'}: sign out
          </button>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-2 mb-2">
        <div className="border border-gray-300 rounded-lg p-2 text-center">
          <p className="text-xs opacity-60">Streak</p>
          <p className="text-sm font-semibold">{streak(logs, now)} days</p>
        </div>
        <div className="border border-gray-300 rounded-lg p-2 text-center">
          <p className="text-xs opacity-60">Today</p>
          <p className="text-sm font-semibold">{reviewsToday(logs, now)} reviews</p>
        </div>
        <div className="border border-gray-300 rounded-lg p-2 text-center">
          <p className="text-xs opacity-60">Time</p>
          <p className="text-sm font-semibold">{Math.round(timeSpentTodayMs(logs, now) / 60000)} min</p>
        </div>
        <div className="border border-gray-300 rounded-lg p-2 text-center">
          <p className="text-xs opacity-60">Retention</p>
          <p className="text-sm font-semibold">{retention === null ? 'n/a' : `${Math.round(retention * 100)}%`}</p>
        </div>
      </section>

      <p className="text-xs opacity-60 mb-6">
        {forecast.map((f, i) => `D+${i} ${f.count}`).join(', ')}
      </p>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-maroon mb-2">Upcoming events</h2>
        {events.length === 0 && <p className="text-sm opacity-70">No upcoming events.</p>}
        <ul className="divide-y divide-gray-300/50">
          {events.map((ev) => {
            const refs = eventCards.get(ev.id) ?? [];
            const readiness = Math.round(
              eventReadiness(refs.map((r) => ({ deckId: r.deckId, cardId: r.cardId })), stateMap, now) * 100,
            );
            const eventTags = new Set([...refs.flatMap((r) => r.tags), ...ev.coverage.tags]);
            const weakForEvent = weakList.filter((w) => eventTags.has(w.tag)).slice(0, 2);
            return (
              <li key={ev.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs opacity-60">
                    {new Date(ev.date).toLocaleDateString()}: {refs.length} in scope: {readiness}%
                  </p>
                  {weakForEvent.length > 0 && (
                    <p className="text-xs opacity-60">weak: {weakForEvent.map((w) => w.tag).join(', ')}</p>
                  )}
                </div>
                <Link to={`/prep/${ev.id}`} className="bg-mustard text-maroon font-semibold rounded-lg px-3 py-1 text-sm">
                  Prepare
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-6 border border-gray-300 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-maroon">Weak topics</h2>
          <Link to="/weak" className="text-xs underline">See all weak topics</Link>
        </div>
        {topWeak.length === 0 ? (
          <p className="text-xs opacity-60">No weak topics yet.</p>
        ) : (
          <ul className="text-xs flex flex-col gap-1">
            {topWeak.map((w) => (
              <li key={w.tag} className="flex justify-between">
                <span>{w.tag}</span>
                <span className="opacity-70">{Math.round(w.failRate * 100)}% fail</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decks.length === 0 && <p className="text-sm opacity-70">No decks yet.</p>}
      <ul className="divide-y divide-gray-300/50">
        {decks.map((d) => {
          const dueCount = states.filter((s) => s.deckId === d.id && s.due <= nowMs).length;
          const deckRetention = trueRetention(logs.filter((l) => l.deckId === d.id));
          return (
            <li key={d.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs opacity-60">
                  {d.subject}: {d.cardCount} cards: {dueCount} due
                  {deckRetention !== null && `: ${Math.round(deckRetention * 100)}% ret`}
                </p>
              </div>
              <Link to={`/review/${d.id}`} className="bg-mustard text-maroon font-semibold rounded-lg px-4 py-2 text-sm">
                Study
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
