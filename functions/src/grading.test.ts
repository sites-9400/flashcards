import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, gradeWithClient, verdictsSchema, gradingDay } from './grading.js';

const input = {
  typedAnswer: 'Venue improper because real action; file where land is.',
  alac: {
    answer: 'Yes, the motion should be granted.',
    legalBasis: 'Rule 4 Sec. 1; Latorre v. Latorre, G.R. No. 183926.',
    application: 'The land is in Cebu so venue lies there.',
    conclusion: 'Hence venue was improperly laid.',
  },
  caseTitle: 'Latorre v. Latorre',
  grNumber: 'G.R. No. 183926',
};

it('prompt includes the citation rule and all four beats', () => {
  const p = buildPrompt(input);
  expect(p).toContain('partial');
  expect(p).toContain('Latorre');
  expect(p).toContain(input.alac.conclusion);
  expect(p.toLowerCase()).toContain('citation');
});

it('gradeWithClient returns schema-valid verdicts from a mocked client', async () => {
  // The pinned @anthropic-ai/sdk version (0.60.0) predates client.messages.parse
  // and the output_config field on messages.create; gradeWithClient falls back
  // to messages.create and zod-parses the first text block's JSON, per the brief.
  const fake = {
    verdicts: [
      { beat: 'answer', verdict: 'got', reason: 'Correct conclusion.' },
      { beat: 'legalBasis', verdict: 'partial', reason: 'Rule cited without the case.' },
      { beat: 'application', verdict: 'got', reason: 'Applied facts.' },
      { beat: 'conclusion', verdict: 'got', reason: 'Restated resolution.' },
    ],
  };
  const client = {
    messages: {
      create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(fake) }] }),
    },
  };
  const out = await gradeWithClient(client as never, input);
  expect(verdictsSchema.parse(out)).toEqual(fake);
});

it('gradingDay rolls over at 4am', () => {
  expect(gradingDay(new Date('2026-07-30T02:30:00+08:00'))).toBe('2026-07-29');
  expect(gradingDay(new Date('2026-07-30T05:00:00+08:00'))).toBe('2026-07-30');
});
