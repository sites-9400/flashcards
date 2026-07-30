import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';
import { inputSchema, gradeWithClient, gradingDay, DAILY_CAP } from './grading.js';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
initializeApp();

export const gradeAnswer = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const parsed = inputSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad grading payload.');

  const db = getFirestore();
  const day = gradingDay(new Date());
  const usageRef = db.doc(`users/${uid}/gradingUsage/${day}`);
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const count = (snap.data()?.count as number | undefined) ?? 0;
    if (count >= DAILY_CAP) return false;
    tx.set(usageRef, { count: FieldValue.increment(1) }, { merge: true });
    return true;
  });
  if (!allowed) throw new HttpsError('resource-exhausted', 'Daily grading limit reached.');

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  try {
    return await gradeWithClient(client, parsed.data);
  } catch (err) {
    logger.error('gradeAnswer grading failed', err);
    throw new HttpsError('unavailable', 'Grading is unavailable right now.');
  }
});
