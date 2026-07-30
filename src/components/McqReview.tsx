import { useEffect, useState } from 'react';
import GradeBar from './GradeBar';
import type { Grade, McqCard } from '../lib/types';

export default function McqReview({ card, intervals, onGrade }: {
  card: McqCard;
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => { setPicked(null); }, [card.id]);
  const answered = picked !== null;
  const correct = answered && picked === card.correctIndex;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!answered) {
        const m = /^Digit([1-9])$/.exec(e.code);
        if (m) {
          const i = Number(m[1]) - 1;
          if (i < card.choices.length) setPicked(i);
        }
        return;
      }
      if (!correct && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); onGrade('again'); }
      if (correct) {
        const map: Record<string, Grade> = { Digit2: 'hard', Digit3: 'good', Digit4: 'easy' };
        if (map[e.code]) onGrade(map[e.code]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, correct, card.choices.length, onGrade]);

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{card.stem}</p>
        {card.barYear && <p className="text-xs opacity-60 mt-1">Bar {card.barYear}</p>}
        <ol className="mt-3 flex flex-col gap-2">
          {card.choices.map((choice, i) => {
            let cls = 'border border-gray-400/60';
            if (answered && i === card.correctIndex) cls = 'border-2 border-green-700';
            else if (answered && i === picked) cls = 'border-2 border-red-700';
            return (
              <li key={i}>
                <button
                  className={'w-full text-left rounded-lg px-3 py-2 ' + cls}
                  disabled={answered}
                  onClick={() => setPicked(i)}
                >
                  <span className="opacity-60 mr-2">{i + 1}.</span>{choice}
                </button>
              </li>
            );
          })}
        </ol>
        {answered && (
          <p className="mt-3 pl-3 border-l-4 border-mustard text-sm">{card.explanation}</p>
        )}
      </div>
      {answered && !correct && (
        <button
          className="rounded-lg py-2 bg-mustard text-maroon font-semibold border-2 border-maroon"
          onClick={() => onGrade('again')}
        >
          Next card ({intervals.again})
        </button>
      )}
      {answered && correct && (
        <GradeBar intervals={intervals} onGrade={onGrade} grades={['hard', 'good', 'easy']} />
      )}
    </div>
  );
}
