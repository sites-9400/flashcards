import { httpsCallable } from 'firebase/functions';
import { fns } from './firebase';
import type { AiVerdict, BeatKey, BeatVerdict, HypoCard } from './types';

const BEAT_KEYS: BeatKey[] = ['answer', 'legalBasis', 'application', 'conclusion'];
const VERDICT_VALUES: BeatVerdict[] = ['got', 'partial', 'missed'];

function isVerdicts(x: unknown): x is AiVerdict[] {
  return Array.isArray(x) && x.length === 4 && x.every((v) =>
    typeof v === 'object' && v !== null &&
    BEAT_KEYS.includes((v as AiVerdict).beat) &&
    VERDICT_VALUES.includes((v as AiVerdict).verdict) &&
    typeof (v as AiVerdict).reason === 'string');
}

export async function requestAiGrading(typedAnswer: string, card: HypoCard): Promise<AiVerdict[] | null> {
  if (!navigator.onLine) return null;
  try {
    const call = httpsCallable(fns, 'gradeAnswer');
    const res = await call({
      typedAnswer,
      alac: card.alac,
      caseTitle: card.source.caseTitle,
      grNumber: card.source.grNumber,
    });
    const verdicts = (res.data as { verdicts?: unknown }).verdicts;
    return isVerdicts(verdicts) ? verdicts : null;
  } catch {
    return null;
  }
}
