// Seeds the FIRESTORE EMULATOR ONLY. Usage:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 SEED_UID=<uid from emulator auth> npm run seed
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cardSchema } from '../src/lib/schema';
import { cardId } from '../src/lib/ids';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not set. This script seeds the emulator only.');
  process.exit(1);
}
const uid = process.env.SEED_UID;
if (!uid) { console.error('Set SEED_UID to your emulator auth uid.'); process.exit(1); }

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'flashcards-be310' });
const db = getFirestore();

const deckId = 'civpro-1';
const now = Date.now();
const src = { docId: 'civpro-ch2', heading: 'II. Jurisdiction' };

const cards = [
  {
    id: cardId({ ...src, type: 'basic', slug: 'sale-vs-agency' }),
    type: 'basic', tags: ['sales', 'sale-vs-agency'],
    source: { docId: 'sales-ch1', heading: 'III. Annotations' },
    front: 'Distinguish a contract of sale from an agency to sell.',
    back: 'In a sale the buyer pays the price and bears the risk as owner; in an agency to sell the agent delivers the price received, returns unsold goods, and the principal keeps ownership and risk (Quiroga v. Parsons Hardware). Labels never control; essential clauses do.',
  },
  ...( [1, 2] as const ).map((idx) => ({
    id: cardId({ ...src, type: 'cloze' as const, slug: `ra11576-amounts-c${idx}` }),
    type: 'cloze' as const, tags: ['jurisdiction', 'amounts'], source: src,
    text: 'Under B.P. 129 as amended by R.A. 11576, first-level courts have exclusive original jurisdiction over personal actions where the claim does not exceed {{c1::P2,000,000}}, and real actions where the assessed value does not exceed {{c2::P400,000}}.',
    clozeIndex: idx,
  })),
  {
    id: cardId({ docId: 'corp-ch1', heading: 'IV. Bar Questions', type: 'mcq', slug: 'piercing-elements' }),
    type: 'mcq', tags: ['piercing'], source: { docId: 'corp-ch1', heading: 'IV. Bar Questions' },
    stem: 'Which is NOT an element of the instrumentality (alter ego) test for piercing the corporate veil?',
    choices: [
      'Complete control of finances, policy, and business practice',
      'Use of that control to commit fraud or wrong',
      'Proximate causation of the injury or loss',
      'Estoppel on the part of the corporation',
    ],
    correctIndex: 3,
    explanation: 'The instrumentality test is C-W-P: Control, Wrong, Proximate cause (Concept Builders). Estoppel is a separate doctrine (Sec. 20, RCC).',
    barYear: '2012',
  },
  {
    id: cardId({ ...src, type: 'hypo', slug: 'manchester-docket-fees' }),
    type: 'hypo', tags: ['jurisdiction', 'docket-fees'],
    source: { ...src, caseTitle: 'Manchester Development Corp. v. Court of Appeals', grNumber: 'G.R. No. 75919' },
    facts: 'P filed a complaint whose body alleged P10M in damages, but the prayer omitted the amounts. P paid docket fees on the prayer alone. D moved to dismiss for lack of jurisdiction.',
    question: 'Whether or not the court acquired jurisdiction over the case.',
    alac: {
      answer: 'No, the court did not acquire jurisdiction over the case.',
      legalBasis: 'Payment of the prescribed docket fee is jurisdictional, and a pleading that conceals the amounts claimed to evade the correct fees confers no jurisdiction (Manchester Development Corp. v. Court of Appeals, G.R. No. 75919, May 7, 1987).',
      application: 'In this case, omitting the amounts from the prayer while alleging them in the body shows intent to evade the correct fees.',
      conclusion: 'Hence, the court did not acquire jurisdiction over the case, and the complaint was properly dismissed.',
    },
    doctrine: 'Docket fees are jurisdictional; concealment of claimed amounts defeats jurisdiction.',
  },
];

for (const c of cards) cardSchema.parse(c);

await db.doc(`decks/${deckId}`).set({
  id: deckId, ownerUid: uid, title: 'Civ Pro: Jurisdiction (sample)', subject: 'CIVIL PROCEDURE 1',
  description: 'Seed deck for development', visibility: 'private',
  cardCount: cards.length, createdAt: now, updatedAt: now,
});
for (const c of cards) await db.doc(`decks/${deckId}/cards/${c.id}`).set(c);
await db.doc(`users/${uid}/subscriptions/${deckId}`).set({ deckId, addedAt: now, newCardsPerDay: 15 });

await db.doc(`users/${uid}/events/seed-recit`).set({
  id: 'seed-recit', type: 'recit', subject: 'CIVIL PROCEDURE 1', title: 'Friday recit',
  date: now + 3 * 24 * 60 * 60 * 1000,
  coverage: { deckIds: [deckId], tags: ['jurisdiction'] },
});

console.log(`Seeded deck ${deckId} with ${cards.length} cards for uid ${uid}`);
