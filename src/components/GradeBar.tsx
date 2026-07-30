import type { Grade } from '../lib/types';

const ALL: Grade[] = ['again', 'hard', 'good', 'easy'];
const LABELS: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const KEYS: Record<Grade, number> = { again: 1, hard: 2, good: 3, easy: 4 };

export default function GradeBar({ intervals, onGrade, highlight = 'good', grades = ALL }: {
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
  highlight?: Grade;
  grades?: Grade[];
}) {
  return (
    <div className="flex gap-2">
      {grades.map((g) => (
        <button
          key={g}
          onClick={() => onGrade(g)}
          className={
            'flex-1 rounded-lg py-2 text-sm ' +
            (g === highlight
              ? 'bg-mustard text-maroon font-semibold border-2 border-maroon'
              : 'border border-gray-400/60')
          }
        >
          {LABELS[g]}
          <span className="block text-xs opacity-80">{intervals[g]} ({KEYS[g]})</span>
        </button>
      ))}
    </div>
  );
}
