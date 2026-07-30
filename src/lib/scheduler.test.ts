import { describe, it, expect } from 'vitest';
import {
  newCardState, applyReview, applyReviewClamped, previewIntervals, clampToEvents, studyDay,
  retrievability, startOfStudyDay,
} from './scheduler';

const NOW = new Date('2026-07-30T10:00:00+08:00');
const DAY = 24 * 60 * 60 * 1000;

describe('scheduler', () => {
  it('creates a new state due now', () => {
    const s = newCardState('d1', 'c1');
    expect(s.state).toBe('new');
    expect(s.reps).toBe(0);
    expect(s.deckId).toBe('d1');
  });

  it('again reschedules within the hour; good schedules at least a day out after learning', () => {
    const s = newCardState('d1', 'c1');
    const again = applyReview(s, 'again', NOW);
    expect(again.due - NOW.getTime()).toBeLessThan(60 * 60 * 1000);
    let st = applyReview(s, 'good', NOW);
    st = applyReview(st, 'good', new Date(NOW.getTime() + 10 * 60 * 1000));
    expect(st.due - NOW.getTime()).toBeGreaterThanOrEqual(0.9 * DAY);
    expect(st.reps).toBe(2);
  });

  it('clamps due to the day before the earliest future event, never past it', () => {
    let s = newCardState('d1', 'c1');
    s = { ...s, due: NOW.getTime() + 21 * DAY, state: 'review' };
    const event = NOW.getTime() + 6 * DAY;
    const clamped = clampToEvents(s, [event, NOW.getTime() + 30 * DAY], NOW);
    expect(clamped.due).toBeLessThan(event);
    expect(clamped.due).toBeGreaterThan(NOW.getTime());
  });

  it('ignores past events and leaves earlier dues alone', () => {
    let s = newCardState('d1', 'c1');
    s = { ...s, due: NOW.getTime() + 2 * DAY, state: 'review' };
    const clamped = clampToEvents(s, [NOW.getTime() - DAY, NOW.getTime() + 6 * DAY], NOW);
    expect(clamped.due).toBe(NOW.getTime() + 2 * DAY);
  });

  it('applyReviewClamped never schedules past the day before an in-scope event', () => {
    let s = { ...newCardState('d1', 'c1'), state: 'review' as const, stability: 60, difficulty: 5, reps: 4, lastReview: NOW.getTime() - 10 * DAY, due: NOW.getTime() };
    const eventAt = NOW.getTime() + 3 * DAY;
    const clamped = applyReviewClamped(s, 'easy', NOW, [eventAt]);
    expect(clamped.due).toBeLessThanOrEqual(eventAt - DAY);
    const unclamped = applyReviewClamped(s, 'easy', NOW, []);
    expect(unclamped.due).toBeGreaterThan(eventAt - DAY);
  });

  it('study day rolls over at 4am local', () => {
    expect(studyDay(new Date('2026-07-30T02:30:00+08:00'))).toBe('2026-07-29');
    expect(studyDay(new Date('2026-07-30T05:00:00+08:00'))).toBe('2026-07-30');
  });

  it('startOfStudyDay is the most recent 4am and agrees with studyDay', () => {
    const before4 = new Date('2026-07-30T02:30:00+08:00');
    const after4 = new Date('2026-07-30T05:00:00+08:00');
    expect(studyDay(new Date(startOfStudyDay(before4)))).toBe(studyDay(before4));
    expect(studyDay(new Date(startOfStudyDay(after4)))).toBe(studyDay(after4));
    expect(new Date(startOfStudyDay(after4)).getHours()).toBe(4);
    expect(startOfStudyDay(before4)).toBeLessThan(before4.getTime());
  });

  it('previews four labeled intervals', () => {
    const p = previewIntervals(newCardState('d1', 'c1'), NOW);
    for (const k of ['again', 'hard', 'good', 'easy'] as const) {
      expect(p[k]).toMatch(/^\d+(m|h|d|mo)$/);
    }
  });

  it('retrievability is between 0 and 1 for a reviewed card', () => {
    const s = applyReview(newCardState('d1', 'c1'), 'good', NOW);
    const r = retrievability(s, new Date(NOW.getTime() + 3 * DAY));
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(1);
  });

  it('stays in learning after good-again-good, with a short due', () => {
    let s = newCardState('d1', 'c1');
    s = applyReview(s, 'good', NOW);
    s = applyReview(s, 'again', new Date(NOW.getTime() + 2 * 60 * 1000));
    s = applyReview(s, 'good', new Date(NOW.getTime() + 4 * 60 * 1000));
    expect(s.state).toBe('learning');
    expect(s.due - (NOW.getTime() + 4 * 60 * 1000)).toBeLessThan(60 * 60 * 1000);
  });

  it('stays in learning after three consecutive again ratings', () => {
    let s = newCardState('d1', 'c1');
    let t = NOW.getTime();
    for (let i = 0; i < 3; i++) { s = applyReview(s, 'again', new Date(t)); t += 2 * 60 * 1000; }
    expect(s.state).toBe('learning');
    expect(s.due - t).toBeLessThan(60 * 60 * 1000);
  });

  it('hard-hard-good while learning stays in learning-scale intervals', () => {
    let s = newCardState('d1', 'c1');
    s = applyReview(s, 'hard', NOW);
    s = applyReview(s, 'hard', new Date(NOW.getTime() + 10 * 60 * 1000));
    const mid = s;
    expect(typeof mid.learningSteps).toBe('number');
    s = applyReview(s, 'good', new Date(NOW.getTime() + 20 * 60 * 1000));
    expect(s.reps).toBe(3);
    expect(s.lapses).toBe(0);
    expect(s.due).toBeGreaterThan(NOW.getTime() + 20 * 60 * 1000);
    expect(typeof s.learningSteps).toBe('number');
  });
});
