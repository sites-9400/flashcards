import { it, expect } from 'vitest';
import { beatScore, suggestedGrade, BEATS } from './alac';

it('scores beats got=1 partial=0.5 missed=0', () => {
  expect(beatScore({ answer: 'got', legalBasis: 'partial', application: 'missed', conclusion: 'got' })).toBe(2.5);
});

it('suggests good at 3.5+, hard at 2+, again below', () => {
  expect(suggestedGrade(4)).toBe('good');
  expect(suggestedGrade(3.5)).toBe('good');
  expect(suggestedGrade(3)).toBe('hard');
  expect(suggestedGrade(2)).toBe('hard');
  expect(suggestedGrade(1.5)).toBe('again');
});

it('lists the four beats in ALAC order', () => {
  expect(BEATS.map((b) => b.key)).toEqual(['answer', 'legalBasis', 'application', 'conclusion']);
});
