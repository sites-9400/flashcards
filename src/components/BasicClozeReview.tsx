import { useEffect, useState } from 'react';
import CardView from './CardView';
import GradeBar from './GradeBar';
import type { BasicCard, ClozeCard, Grade } from '../lib/types';

export default function BasicClozeReview({ card, intervals, onGrade }: {
  card: BasicCard | ClozeCard;
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [card.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setRevealed(true); }
      const map: Record<string, Grade> = { Digit1: 'again', Digit2: 'hard', Digit3: 'good', Digit4: 'easy' };
      if (revealed && map[e.code]) onGrade(map[e.code]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, onGrade]);
  return (
    <>
      <div onClick={() => setRevealed(true)}>
        <CardView card={card} revealed={revealed} />
        {!revealed && <p className="text-center text-sm opacity-50 mt-3">tap or press space to reveal</p>}
      </div>
      {revealed && <GradeBar intervals={intervals} onGrade={onGrade} />}
    </>
  );
}
