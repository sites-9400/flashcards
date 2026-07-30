import type { BeatKey, BeatVerdict, Grade } from './types';

export const BEATS: { key: BeatKey; label: string }[] = [
  { key: 'answer', label: 'Answer' },
  { key: 'legalBasis', label: 'Legal Basis' },
  { key: 'application', label: 'Application' },
  { key: 'conclusion', label: 'Conclusion' },
];

const POINTS: Record<BeatVerdict, number> = { got: 1, partial: 0.5, missed: 0 };

export function beatScore(marks: Record<BeatKey, BeatVerdict>): number {
  return BEATS.reduce((sum, b) => sum + POINTS[marks[b.key]], 0);
}

export function suggestedGrade(score: number): Grade {
  if (score >= 3.5) return 'good';
  if (score >= 2) return 'hard';
  return 'again';
}
