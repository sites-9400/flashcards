import { it, expect } from 'vitest';
import {
  reviewsToday, streak, timeSpentTodayMs, dueForecast, trueRetention, weakSpots, inScope, eventReadiness,
  isUpcoming,
} from './stats';
import { newCardState, studyDay } from './scheduler';
import type { EventDoc, Grade } from './types';
import type { LogLike } from './stats';

const NOW = new Date('2026-07-30T20:00:00+08:00');
const T = (s: string) => new Date(s).getTime();
const log = (ts: number, over: Partial<LogLike> = {}): LogLike => ({
  ts, grade: 'good' as Grade, tags: ['jurisdiction'], deckId: 'd1', cardId: 'c1', ...over,
});

it('reviewsToday counts only the current study day', () => {
  const logs = [
    log(T('2026-07-30T10:00:00+08:00')),
    log(T('2026-07-30T03:00:00+08:00')),
    log(T('2026-07-29T22:00:00+08:00')),
  ];
  expect(reviewsToday(logs, NOW)).toBe(1);
});

it('streak counts consecutive study days and survives a not-yet-studied today', () => {
  const logs = [
    log(T('2026-07-29T10:00:00+08:00')),
    log(T('2026-07-28T10:00:00+08:00')),
    log(T('2026-07-26T10:00:00+08:00')),
  ];
  expect(streak(logs, NOW)).toBe(2);
  expect(streak([...logs, log(T('2026-07-30T09:00:00+08:00'))], NOW)).toBe(3);
  expect(streak([], NOW)).toBe(0);
});

it('timeSpentToday caps gaps at 60s and seeds 10s for the first review', () => {
  const base = T('2026-07-30T10:00:00+08:00');
  const logs = [log(base), log(base + 30_000), log(base + 30_000 + 600_000)];
  expect(timeSpentTodayMs(logs, NOW)).toBe(10_000 + 30_000 + 60_000);
  expect(timeSpentTodayMs([], NOW)).toBe(0);
});

it('dueForecast buckets 7 study days with overdue in day 0', () => {
  const mk = (due: number) => ({ ...newCardState('d1', Math.random().toString(36).slice(2)), due, state: 'review' as const });
  const states = [
    mk(NOW.getTime() - 24 * 3600e3),
    mk(NOW.getTime() + 3600e3),
    mk(NOW.getTime() + 2 * 24 * 3600e3),
  ];
  const f = dueForecast(states, NOW);
  expect(f).toHaveLength(7);
  expect(f[0].count).toBe(2);
  expect(f[2].count).toBe(1);
  expect(f[0].day).toBe(studyDay(NOW));
});

it('trueRetention ignores first reviews and handles empties', () => {
  const logs = [
    log(1, { firstReview: true, grade: 'again' as Grade }),
    log(2, { grade: 'good' as Grade }),
    log(3, { grade: 'again' as Grade }),
    log(4, { grade: 'easy' as Grade }),
  ];
  expect(trueRetention(logs)).toBeCloseTo(2 / 3);
  expect(trueRetention([log(1, { firstReview: true })])).toBeNull();
});

it('weakSpots ranks by fail rate with a minimum attempt floor', () => {
  const logs = [
    ...[1, 2, 3, 4].map((i) => log(i, { tags: ['venue'], grade: (i <= 3 ? 'again' : 'good') as Grade })),
    ...[5, 6, 7, 8].map((i) => log(i, { tags: ['docket-fees'], grade: (i === 5 ? 'again' : 'good') as Grade })),
    log(9, { tags: ['rare'], grade: 'again' as Grade }),
  ];
  const w = weakSpots(logs);
  expect(w.map((x) => x.tag)).toEqual(['venue', 'docket-fees']);
  expect(w[0].failRate).toBeCloseTo(0.75);
  expect(w.find((x) => x.tag === 'rare')).toBeUndefined();
});

it('inScope matches by deck or by tag', () => {
  const ev: EventDoc = {
    id: 'e1', type: 'recit', subject: 'CIVPRO', title: 'Recit', date: NOW.getTime() + 3 * 24 * 3600e3,
    coverage: { deckIds: ['d1'], tags: ['venue'] },
  };
  expect(inScope('d1', ['x'], ev)).toBe(true);
  expect(inScope('d2', ['venue'], ev)).toBe(true);
  expect(inScope('d2', ['x'], ev)).toBe(false);
});

it('isUpcoming keeps an event visible through its own study day but hides a stale one', () => {
  const ev = (date: number): EventDoc => ({
    id: 'e1', type: 'recit', subject: 'CIVPRO', title: 'Recit', date,
    coverage: { deckIds: [], tags: [] },
  });
  const todayMidnight = T('2026-07-30T00:00:00+08:00');
  const yesterdayMidnight = T('2026-07-29T00:00:00+08:00');
  const future = T('2026-08-02T00:00:00+08:00');
  expect(isUpcoming(ev(todayMidnight), NOW)).toBe(true);
  expect(isUpcoming(ev(yesterdayMidnight), NOW)).toBe(false);
  expect(isUpcoming(ev(future), NOW)).toBe(true);
});

it('eventReadiness averages retrievability with unseen as zero', () => {
  const seen = newCardState('d1', 'c1');
  const states = new Map([['c1', { ...seen, lastReview: NOW.getTime() - 3600e3, stability: 10, state: 'review' as const }]]);
  const r = eventReadiness([{ deckId: 'd1', cardId: 'c1' }, { deckId: 'd1', cardId: 'c2' }], states, NOW);
  expect(r).toBeGreaterThan(0);
  expect(r).toBeLessThan(1);
  expect(eventReadiness([], states, NOW)).toBe(0);
});
