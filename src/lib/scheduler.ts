import {
  fsrs, generatorParameters, createEmptyCard, Rating, State, type Card as FsrsCard,
} from 'ts-fsrs';
import type { CardStateDoc, Grade } from './types';

const f = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }));

// ts-fsrs's own `Grade` type is `Exclude<Rating, Rating.Manual>`, not the
// full `Rating` enum; annotate the map's value type that way so it narrows
// correctly when passed to f.next / f.get_retrievability below.
const GRADE_TO_RATING: Record<Grade, Exclude<Rating, Rating.Manual>> = {
  again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy,
};

const STATE_TO_STR: Record<State, CardStateDoc['state']> = {
  [State.New]: 'new', [State.Learning]: 'learning',
  [State.Review]: 'review', [State.Relearning]: 'relearning',
};
const STR_TO_STATE: Record<CardStateDoc['state'], State> = {
  new: State.New, learning: State.Learning, review: State.Review, relearning: State.Relearning,
};

function toFsrs(s: CardStateDoc): FsrsCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    // `?? 0` guards CardStateDoc records written before this field existed.
    learning_steps: s.learningSteps ?? 0,
    reps: s.reps,
    lapses: s.lapses,
    state: STR_TO_STATE[s.state],
    last_review: s.lastReview === null ? undefined : new Date(s.lastReview),
  } as FsrsCard;
}

function fromFsrs(deckId: string, cardId: string, c: FsrsCard): CardStateDoc {
  return {
    deckId, cardId,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: STATE_TO_STR[c.state],
    lastReview: c.last_review ? c.last_review.getTime() : null,
    learningSteps: c.learning_steps,
  };
}

export function newCardState(deckId: string, cardId: string): CardStateDoc {
  return fromFsrs(deckId, cardId, createEmptyCard(new Date()));
}

export function applyReview(state: CardStateDoc, grade: Grade, now: Date): CardStateDoc {
  const { card } = f.next(toFsrs(state), now, GRADE_TO_RATING[grade]);
  return fromFsrs(state.deckId, state.cardId, card);
}

export function clampToEvents(state: CardStateDoc, eventDates: number[], now: Date): CardStateDoc {
  const future = eventDates.filter((d) => d > now.getTime());
  if (future.length === 0) return state;
  const earliest = Math.min(...future);
  const dayBefore = earliest - 24 * 60 * 60 * 1000;
  if (state.due <= dayBefore) return state;
  return { ...state, due: Math.max(now.getTime(), dayBefore) };
}

export function startOfStudyDay(d: Date): number {
  const s = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  const z = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  return z.getTime() + 4 * 60 * 60 * 1000;
}

export function studyDay(d: Date): string {
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function label(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}

export function previewIntervals(state: CardStateDoc, now: Date): Record<Grade, string> {
  const out = {} as Record<Grade, string>;
  for (const g of ['again', 'hard', 'good', 'easy'] as Grade[]) {
    const { card } = f.next(toFsrs(state), now, GRADE_TO_RATING[g]);
    out[g] = label(card.due.getTime() - now.getTime());
  }
  return out;
}

export function retrievability(state: CardStateDoc, now: Date): number {
  return f.get_retrievability(toFsrs(state), now, false) as number;
}
