import type { Grade } from '../lib/types';

const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];
const LABELS: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

export default function GradeBar({ intervals, onGrade }: {
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
}) {
  return (
    <div className="flex gap-2">
      {GRADES.map((g, i) => (
        <button
          key={g}
          onClick={() => onGrade(g)}
          className={
            'flex-1 rounded-lg py-2 text-sm ' +
            (g === 'good'
              ? 'bg-mustard text-maroon font-semibold border-2 border-maroon'
              : 'border border-gray-400/60')
          }
        >
          {LABELS[g]}
          <span className="block text-xs opacity-80">{intervals[g]} ({i + 1})</span>
        </button>
      ))}
    </div>
  );
}
