import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

export const inputSchema = z.object({
  typedAnswer: z.string().min(1).max(8000),
  alac: z.object({
    answer: z.string().min(1),
    legalBasis: z.string().min(1),
    application: z.string().min(1),
    conclusion: z.string().min(1),
  }),
  caseTitle: z.string().optional(),
  grNumber: z.string().optional(),
});
export type GradeInput = z.infer<typeof inputSchema>;

export const verdictsSchema = z.object({
  verdicts: z.array(z.object({
    beat: z.enum(['answer', 'legalBasis', 'application', 'conclusion']),
    verdict: z.enum(['got', 'partial', 'missed']),
    reason: z.string(),
  })).length(4),
});
export type Verdicts = z.infer<typeof verdictsSchema>;

export const DAILY_CAP = 50;
export const MODEL = 'claude-haiku-4-5';

// Manila-anchored (UTC+8) 4am rollover, computed in UTC so the result is
// identical in any runtime timezone.
export function gradingDay(d: Date): string {
  const s = new Date(d.getTime() + (8 - 4) * 60 * 60 * 1000);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${String(s.getUTCDate()).padStart(2, '0')}`;
}

export function buildPrompt(input: GradeInput): string {
  const cite = [input.caseTitle, input.grNumber].filter(Boolean).join(', ');
  return [
    'You are grading a law student\'s answer to a hypothetical against a model answer with four ALAC beats.',
    'For each beat return a verdict: "got" (substance present), "partial" (incomplete or imprecise), or "missed" (absent or wrong), with a one-line reason.',
    'Substance matters, not wording; the student\'s answer need not be verbatim.',
    'Citation rule: on the legalBasis beat, if the student states the rule but omits its source (the case name or codal article), the verdict is at most "partial".',
    cite ? `The controlling authority is ${cite}.` : '',
    '',
    'Model answer beats:',
    `answer: ${input.alac.answer}`,
    `legalBasis: ${input.alac.legalBasis}`,
    `application: ${input.alac.application}`,
    `conclusion: ${input.alac.conclusion}`,
    '',
    'Student answer:',
    input.typedAnswer,
    '',
    'Return verdicts for all four beats in ALAC order.',
  ].filter((l) => l !== '').join('\n');
}

const OUTPUT_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            beat: { type: 'string', enum: ['answer', 'legalBasis', 'application', 'conclusion'] },
            verdict: { type: 'string', enum: ['got', 'partial', 'missed'] },
            reason: { type: 'string' },
          },
          required: ['beat', 'verdict', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['verdicts'],
    additionalProperties: false,
  },
};

// The pinned @anthropic-ai/sdk version (0.60.0) predates client.messages.parse
// and has no output_config field on MessageCreateParamsNonStreaming. The
// Messages API itself supports output_config.format for structured outputs
// (the SDK forwards the request body as-is), so we build the body as a plain
// object and cast it past the stale types, then zod-parse the first text
// block's JSON. Either code path must end with a zod-validated Verdicts.
export async function gradeWithClient(client: Anthropic, input: GradeInput): Promise<Verdicts> {
  const body = {
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user' as const, content: buildPrompt(input) }],
    output_config: { format: OUTPUT_FORMAT },
  };
  const response = await client.messages.create(body as unknown as Anthropic.MessageCreateParamsNonStreaming);
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  if (!textBlock) {
    throw new Error('Anthropic response had no text block.');
  }
  return verdictsSchema.parse(JSON.parse(textBlock.text));
}
