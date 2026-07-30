import { retrievability, startOfStudyDay, studyDay } from './scheduler';
import type { CardStateDoc, EventDoc, Grade } from './types';

export interface LogLike {
  ts: number; grade: Grade; tags: string[]; deckId: string; cardId: string; firstReview?: boolean;
}

export function reviewsToday(logs: LogLike[], now: Date): number {
  const today = studyDay(now);
  return logs.filter((l) => studyDay(new Date(l.ts)) === today).length;
}

export function streak(logs: LogLike[], now: Date): number {
  const days = new Set(logs.map((l) => studyDay(new Date(l.ts))));
  const today = studyDay(now);
  let cursor = startOfStudyDay(now);
  if (!days.has(today)) {
    cursor -= 24 * 60 * 60 * 1000;
  }
  let count = 0;
  while (days.has(studyDay(new Date(cursor)))) {
    count += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return count;
}

export function timeSpentTodayMs(logs: LogLike[], now: Date): number {
  const today = studyDay(now);
  const todays = logs
    .filter((l) => studyDay(new Date(l.ts)) === today)
    .sort((a, b) => a.ts - b.ts);
  if (todays.length === 0) return 0;
  let total = 10_000;
  for (let i = 1; i < todays.length; i += 1) {
    const gap = todays[i].ts - todays[i - 1].ts;
    total += Math.min(gap, 60_000);
  }
  return total;
}

export function dueForecast(
  states: CardStateDoc[],
  now: Date,
  days = 7,
): { day: string; count: number }[] {
  const start = startOfStudyDay(now);
  const dayKeys = Array.from({ length: days }, (_, i) => studyDay(new Date(start + i * 24 * 60 * 60 * 1000)));
  const buckets = dayKeys.map((day) => ({ day, count: 0 }));
  const nowMs = now.getTime();
  for (const s of states) {
    if (s.due < nowMs) {
      buckets[0].count += 1;
      continue;
    }
    const key = studyDay(new Date(s.due));
    const idx = dayKeys.indexOf(key);
    if (idx === -1) {
      // Falls outside the forecast window entirely; ignore.
      continue;
    }
    buckets[idx].count += 1;
  }
  return buckets;
}

export function trueRetention(logs: LogLike[]): number | null {
  const eligible = logs.filter((l) => l.firstReview !== true);
  if (eligible.length === 0) return null;
  const successes = eligible.filter((l) => l.grade === 'good' || l.grade === 'easy').length;
  return successes / eligible.length;
}

export function weakSpots(
  logs: LogLike[],
  minAttempts = 4,
): { tag: string; failRate: number; attempts: number }[] {
  const byTag = new Map<string, { attempts: number; fails: number }>();
  for (const l of logs) {
    for (const tag of l.tags) {
      const entry = byTag.get(tag) ?? { attempts: 0, fails: 0 };
      entry.attempts += 1;
      if (l.grade === 'again') entry.fails += 1;
      byTag.set(tag, entry);
    }
  }
  return Array.from(byTag.entries())
    .map(([tag, { attempts, fails }]) => ({ tag, failRate: fails / attempts, attempts }))
    .filter((x) => x.attempts >= minAttempts)
    .sort((a, b) => b.failRate - a.failRate || b.attempts - a.attempts);
}

export function inScope(deckId: string, tags: string[], event: EventDoc): boolean {
  return event.coverage.deckIds.includes(deckId) || tags.some((t) => event.coverage.tags.includes(t));
}

// Event dates are stored at local midnight, but startOfStudyDay is the 4am
// boundary, so a same-day comparison against startOfStudyDay(now) would hide
// an event from 4am onward on its own day. Backing the cutoff up by one day
// keeps a same-day event visible through its whole study day while a
// yesterday-dated event still drops off.
export function isUpcoming(event: EventDoc, now: Date): boolean {
  return event.date >= startOfStudyDay(now) - 24 * 60 * 60 * 1000;
}

export function eventReadiness(
  items: { deckId: string; cardId: string }[],
  states: Map<string, CardStateDoc>,
  now: Date,
): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => {
    const state = states.get(item.cardId);
    return sum + (state ? retrievability(state, now) : 0);
  }, 0);
  return total / items.length;
}
