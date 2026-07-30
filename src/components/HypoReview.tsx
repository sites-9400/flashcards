import { useEffect, useState } from 'react';
import GradeBar from './GradeBar';
import { BEATS, beatScore, suggestedGrade } from '../lib/alac';
import type { AiVerdict, BeatKey, BeatVerdict, Grade, GradeExtras, HypoCard } from '../lib/types';

const VERDICTS: { v: BeatVerdict; label: string }[] = [
  { v: 'got', label: 'Got it' },
  { v: 'partial', label: 'Partial' },
  { v: 'missed', label: 'Missed' },
];

export default function HypoReview({ card, intervals, onGrade, aiCheck }: {
  card: HypoCard;
  intervals: Record<Grade, string>;
  onGrade: (g: Grade, extras?: GradeExtras) => void;
  aiCheck?: (typedAnswer: string, card: HypoCard) => Promise<AiVerdict[] | null>;
}) {
  const [typed, setTyped] = useState('');
  const [revealedBeats, setRevealedBeats] = useState(0);
  const [marks, setMarks] = useState<Partial<Record<BeatKey, BeatVerdict>>>({});
  const [verdicts, setVerdicts] = useState<AiVerdict[] | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    setTyped(''); setRevealedBeats(0); setMarks({}); setVerdicts(null); setChecking(false);
  }, [card.id]);

  const allRevealed = revealedBeats >= BEATS.length;
  const allMarked = BEATS.every((b) => marks[b.key] !== undefined);
  const score = allMarked ? beatScore(marks as Record<BeatKey, BeatVerdict>) : null;

  const runAiCheck = async () => {
    if (!aiCheck || !typed.trim()) return;
    setChecking(true);
    const result = await aiCheck(typed, card);
    setChecking(false);
    if (result) {
      setVerdicts(result);
      setMarks(Object.fromEntries(result.map((r) => [r.beat, r.verdict])));
    }
  };

  const confirm = (g: Grade) => {
    const extras: GradeExtras = {};
    if (typed.trim()) extras.typedAnswer = typed.trim();
    if (verdicts) extras.aiVerdicts = verdicts;
    onGrade(g, Object.keys(extras).length ? extras : undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{card.facts}</p>
        <p className="mt-2 font-semibold">{card.question}</p>
      </div>

      {!allRevealed && (
        <textarea
          className="border border-gray-400/60 rounded-lg p-3 text-sm min-h-24"
          placeholder="Type your answer (optional)"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      )}

      {BEATS.slice(0, revealedBeats).map((b) => {
        const av = verdicts?.find((v) => v.beat === b.key);
        return (
          <div key={b.key} className="border border-gray-400/60 rounded-lg p-3">
            <p className="text-xs uppercase opacity-60">{b.label}</p>
            <p className="mt-1">{card.alac[b.key]}</p>
            {allRevealed && (
              <div className="mt-2 flex gap-2 items-center">
                {VERDICTS.map(({ v, label }) => (
                  <button
                    key={v}
                    onClick={() => setMarks((m) => ({ ...m, [b.key]: v }))}
                    className={
                      'rounded px-2 py-1 text-xs border ' +
                      (marks[b.key] === v
                        ? v === 'got' ? 'border-2 border-green-700 font-semibold'
                          : v === 'missed' ? 'border-2 border-red-700 font-semibold'
                          : 'border-2 border-maroon font-semibold'
                        : 'border-gray-400/60')
                    }
                  >
                    {label}
                  </button>
                ))}
                {av && <span className="text-xs opacity-60">AI: {av.reason}</span>}
              </div>
            )}
          </div>
        );
      })}

      {!allRevealed && (
        <button
          className="rounded-lg py-2 bg-mustard text-maroon font-semibold border-2 border-maroon"
          onClick={() => setRevealedBeats((n) => n + 1)}
        >
          Reveal {revealedBeats === 0 ? 'answer' : 'next beat'}
        </button>
      )}

      {allRevealed && (
        <>
          {card.doctrine && (
            <p className="pl-3 border-l-4 border-mustard text-sm">{card.doctrine}</p>
          )}
          {card.source.lawphilPdfUrl && (
            <a
              className="text-sm underline text-maroon"
              href={card.source.lawphilPdfUrl}
              target="_blank" rel="noreferrer"
            >
              Case PDF
            </a>
          )}
          {aiCheck && typed.trim() && !verdicts && (
            <button
              className="rounded-lg py-2 border border-gray-400/60 text-sm"
              onClick={runAiCheck}
              disabled={checking}
            >
              {checking ? 'Checking...' : 'AI check my answer'}
            </button>
          )}
          {allMarked && score !== null && (
            <GradeBar intervals={intervals} onGrade={confirm} highlight={suggestedGrade(score)} />
          )}
        </>
      )}
    </div>
  );
}
