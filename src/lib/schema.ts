import { z } from 'zod';

const EM_DASH = /—/;
const EMOJI = /\p{Extended_Pictographic}/u;
const clean = z.string().min(1)
  .refine((s) => !EM_DASH.test(s), 'em dashes are not allowed')
  .refine((s) => !EMOJI.test(s), 'emojis are not allowed');

const sourceSchema = z.object({
  docId: z.string().min(1),
  heading: z.string().min(1),
  caseTitle: clean.optional(),
  grNumber: clean.optional(),
  lawphilPdfUrl: z.string().url().optional(),
});

const baseFields = {
  id: z.string().regex(/^[a-z0-9]+$/),
  tags: z.array(z.string().min(1)).min(1),
  source: sourceSchema,
};

export const cardSchema = z.discriminatedUnion('type', [
  z.object({ ...baseFields, type: z.literal('basic'), front: clean, back: clean }),
  z.object({
    ...baseFields, type: z.literal('cloze'),
    text: clean.refine((t) => /\{\{c\d+::[^}]+\}\}/.test(t), 'cloze text needs at least one {{cN::...}} marker'),
    clozeIndex: z.number().int().min(1),
  }).superRefine((c, ctx) => {
    if (!c.text.includes(`{{c${c.clozeIndex}::`)) {
      ctx.addIssue({ code: 'custom', message: `text has no {{c${c.clozeIndex}::...}} marker for clozeIndex ${c.clozeIndex}` });
    }
  }),
  z.object({
    ...baseFields, type: z.literal('mcq'),
    stem: clean, choices: z.array(clean).min(2).max(6),
    correctIndex: z.number().int().min(0), explanation: clean, barYear: clean.optional(),
  }).refine((c) => c.correctIndex < c.choices.length, 'correctIndex out of range'),
  z.object({
    ...baseFields, type: z.literal('hypo'),
    facts: clean, question: clean,
    alac: z.object({ answer: clean, legalBasis: clean, application: clean, conclusion: clean }),
    doctrine: clean.optional(),
  }),
]);

export const deckSchema = z.object({
  id: z.string().min(1), ownerUid: z.string().min(1),
  title: clean, subject: clean, description: z.string(),
  visibility: z.enum(['private', 'published']),
  sourceRef: z.object({ docId: z.string(), coverage: z.string() }).optional(),
  cardCount: z.number().int().min(0), createdAt: z.number(), updatedAt: z.number(),
});
