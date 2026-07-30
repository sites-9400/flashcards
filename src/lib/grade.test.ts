import { it, expect, vi, beforeEach } from 'vitest';

const httpsCallableMock = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: () => httpsCallableMock,
}));
vi.mock('./firebase', () => ({ fns: {} }));

import { requestAiGrading } from './grade';
import type { HypoCard } from './types';

const card: HypoCard = {
  id: 'h', type: 'hypo', facts: 'F', question: 'Q',
  alac: { answer: 'A', legalBasis: 'L', application: 'Ap', conclusion: 'C' },
  tags: ['t'], source: { docId: 'd', heading: 'h', caseTitle: 'X v. Y', grNumber: 'G.R. No. 1' },
};

beforeEach(() => httpsCallableMock.mockReset());

it('returns verdicts on success', async () => {
  const verdicts = [
    { beat: 'answer', verdict: 'got', reason: 'r' },
    { beat: 'legalBasis', verdict: 'partial', reason: 'r' },
    { beat: 'application', verdict: 'got', reason: 'r' },
    { beat: 'conclusion', verdict: 'missed', reason: 'r' },
  ];
  httpsCallableMock.mockResolvedValueOnce({ data: { verdicts } });
  expect(await requestAiGrading('my answer', card)).toEqual(verdicts);
});

it('returns null when the callable rejects', async () => {
  httpsCallableMock.mockRejectedValueOnce(new Error('unavailable'));
  expect(await requestAiGrading('my answer', card)).toBeNull();
});

it('returns null on a malformed response', async () => {
  httpsCallableMock.mockResolvedValueOnce({ data: { verdicts: [{ beat: 'answer' }] } });
  expect(await requestAiGrading('my answer', card)).toBeNull();
});

it('returns null when offline', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(await requestAiGrading('my answer', card)).toBeNull();
  expect(httpsCallableMock).not.toHaveBeenCalled();
});
