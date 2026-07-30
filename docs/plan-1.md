# LawDeck Plan 1: Foundation & Core Review Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, installable PWA where the user signs in with Google and reviews basic and cloze flashcards with real FSRS scheduling that syncs through Firestore and works offline.

**Architecture:** Vite + React + TypeScript SPA talking directly to Firebase (Auth + Firestore with offline persistence); no custom server. Scheduling runs on-device via ts-fsrs; Firestore stores content (decks/cards) separately from per-user study state (cardStates/reviewLogs), enforced by security rules. Deployed to Firebase Hosting via GitHub Actions.

**Tech Stack:** Node 20+, Vite 6, React 18, TypeScript (strict), Tailwind CSS v4, firebase (v11 modular SDK), ts-fsrs, zod, vitest, @firebase/rules-unit-testing, vite-plugin-pwa, react-router-dom.

**Spec:** `docs/superpowers/specs/2026-07-30-flashcards-design.md` in the Law School workspace. Copy both the spec and this plan into the repo's `docs/` as part of Task 1.

## Global Constraints

- Repo lives at `~/Projects/flashcards` (NOT inside Dropbox); GitHub remote already exists: `https://github.com/sites-9400/flashcards` (source of truth).
- Firebase project already exists: id `flashcards-be310`. Web app config (public by design, safe in the client):
  apiKey `AIzaSyDb8ACKIV6VRJ4zArCAdox02OYwD48hY_Q`, authDomain `flashcards-be310.firebaseapp.com`, projectId `flashcards-be310`, storageBucket `flashcards-be310.firebasestorage.app`, messagingSenderId `30911096236`, appId `1:30911096236:web:961df37c7bcde9d449c609`.
- The implementer does ALL setup work directly (user instruction, 2026-07-30: "do it for me"). Only pause for genuinely interactive steps: ask the user to run `! npx firebase login` / `! gh auth login`, and to click "enable Google provider" in the console only if the CLI cannot.
- No em dashes anywhere: UI copy, card content, code comments, commit messages. Use commas, colons, parentheses.
- No emojis anywhere in the UI; icons are inline SVGs only.
- Palette: accent mustard `#E0A526`, on-accent maroon `#7B1113`. Mustard fill ONLY on interactive surfaces (buttons, selected states). Never a mustard-filled chip/panel behind body text; revealed cloze answers are maroon bold with a 2px mustard underline; callouts use a mustard left border. Semantic green `#2e7d32` / red `#b03030` only for correct/wrong. No blue accents.
- Multi-user from day one: content readable by owner or (if published) anyone; everything under `users/{uid}` readable/writable only by that user.
- Firestore document shapes must match `src/lib/types.ts` exactly; later plans (pipeline, grading) depend on them.
- FSRS target retention 0.9; study-day boundary 4 a.m. local; hypo cards count 3 against the daily new-card allotment (default 15).
- TDD: every logic module gets its failing test first. UI tasks end with a scripted manual verification against the Firebase emulators.

---

### Task 1: Scaffold repo, Tailwind, vitest, palette

**Files:**
- Create: `~/Projects/flashcards` (whole Vite scaffold), `vite.config.ts`, `src/index.css`, `src/test/setup.ts`, `docs/spec.md`, `docs/plan-1.md`, `.gitignore`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: an `npm test` (vitest) and `npm run dev` workflow every later task uses; Tailwind color tokens `mustard` and `maroon`.

- [ ] **Step 1: Scaffold and install**

```bash
mkdir -p ~/Projects && cd ~/Projects
npm create vite@latest flashcards -- --template react-ts
cd flashcards
npm install
npm install firebase ts-fsrs zod react-router-dom
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom tailwindcss @tailwindcss/vite @types/node
git init && git add -A && git commit -m "chore: vite react-ts scaffold"
```

- [ ] **Step 2: Wire Tailwind v4 + palette + vitest config**

Replace `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Replace `src/index.css` entirely with:

```css
@import 'tailwindcss';

@theme {
  --color-mustard: #e0a526;
  --color-mustard-dark: #c8931f;
  --color-maroon: #7b1113;
  --color-ok: #2e7d32;
  --color-err: #b03030;
}
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts: `"test": "vitest run", "test:watch": "vitest"`.

- [ ] **Step 3: Write a smoke test and run it**

Create `src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test` Expected: 1 passed.

- [ ] **Step 4: Copy spec + plan into the repo, create GitHub repo**

```bash
cp "/Users/gamaliel/Library/CloudStorage/Dropbox/02 Areas/Law School/docs/superpowers/specs/2026-07-30-flashcards-design.md" docs/spec.md
cp "/Users/gamaliel/Library/CloudStorage/Dropbox/02 Areas/Law School/docs/superpowers/plans/2026-07-30-lawdeck-foundation.md" docs/plan-1.md
git add -A && git commit -m "chore: tailwind, vitest, palette tokens, spec and plan docs"
git branch -M main
git remote add origin https://github.com/sites-9400/flashcards.git
git push -u origin main
```

The remote repo already exists. If it is non-empty (e.g. a README), run `git pull --rebase origin main` before pushing. If the push needs auth, ask the user to run `! gh auth login`.

---

### Task 2: Firebase project, emulators, client init

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules` (deny-all placeholder), `firestore.indexes.json`, `src/lib/firebase.ts`, `.env.local` (user fills), `.env.example`
- Modify: `.gitignore` (add `.env.local`)

**Interfaces:**
- Produces: `src/lib/firebase.ts` exporting `app`, `auth`, `db` (Firestore with offline persistence). Every Firestore/Auth consumer imports from here and nowhere else.

- [ ] **Step 1: Provision what the project still needs (do it, don't delegate)**

The project `flashcards-be310` and its web app already exist. Ask the user once to run `! npx firebase login` if the CLI is not authenticated, then:
1. `npx firebase projects:list` to confirm access to `flashcards-be310`.
2. Create the Firestore database if absent: `npx firebase firestore:databases:create "(default)" --project flashcards-be310 --location asia-southeast1` (skip if `firestore:databases:list` shows it).
3. Enable Google sign-in: try `npx firebase auth:providers` tooling if available in the installed CLI; the Auth provider toggle is usually console-only, so if the CLI cannot do it, ask the user to click Build > Authentication > Sign-in method > Google > Enable (one click, everything else is done for them).

- [ ] **Step 2: Emulator + project config files**

Create `.firebaserc`:

```json
{ "projects": { "default": "flashcards-be310" } }
```

Create `firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5002 },
    "ui": { "enabled": true }
  }
}
```

Create `firestore.rules` (deny-all until Task 4):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

Create `firestore.indexes.json`:

```json
{ "indexes": [], "fieldOverrides": [] }
```

- [ ] **Step 3: Client init with offline persistence**

Create `.env.example` with empty values (committed), and write `.env.local` yourself (gitignored) with the real config:

```
# .env.local (real values, provided by the user)
VITE_FB_API_KEY=AIzaSyDb8ACKIV6VRJ4zArCAdox02OYwD48hY_Q
VITE_FB_AUTH_DOMAIN=flashcards-be310.firebaseapp.com
VITE_FB_PROJECT_ID=flashcards-be310
VITE_FB_APP_ID=1:30911096236:web:961df37c7bcde9d449c609
```

`.env.example` mirrors the keys with empty values.

Create `src/lib/firebase.ts`:

```ts
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
});

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
```

Append `VITE_USE_EMULATORS=true` to `.env.local` for development, and `VITE_USE_EMULATORS=` to `.env.example`.

- [ ] **Step 4: Verify emulators boot, commit**

Run: `npx firebase emulators:start --only auth,firestore` Expected: both emulators up, UI at http://127.0.0.1:4000. Stop with Ctrl-C.

```bash
git add -A && git commit -m "chore: firebase project config, emulators, client init"
```

---

### Task 3: Data types, card validation, deterministic IDs

**Files:**
- Create: `src/lib/types.ts`, `src/lib/schema.ts`, `src/lib/ids.ts`
- Test: `src/lib/schema.test.ts`, `src/lib/ids.test.ts`

**Interfaces:**
- Produces (later plans depend on these exact names):
  - `types.ts`: `CardType`, `Card` (union of `BasicCard | ClozeCard | McqCard | HypoCard`), `Deck`, `CardStateDoc`, `ReviewLogDoc`, `EventDoc`, `SubscriptionDoc`, `Grade`
  - `schema.ts`: `cardSchema` (zod discriminated union), `deckSchema`; both enforce house rules (no em dash `—`, no emoji)
  - `ids.ts`: `cardId(source: { docId: string; heading: string; type: CardType; slug: string }): string` (deterministic), `stateId(deckId: string, cardId: string): string` returning `` `${deckId}_${cardId}` ``

- [ ] **Step 1: Write failing tests**

Create `src/lib/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardSchema } from './schema';

const base = { id: 'abc123', tags: ['jurisdiction'], source: { docId: 'd1', heading: 'II. Codal' } };

describe('cardSchema', () => {
  it('accepts a valid basic card', () => {
    const r = cardSchema.safeParse({ ...base, type: 'basic', front: 'Q?', back: 'A.' });
    expect(r.success).toBe(true);
  });
  it('accepts a valid cloze card and requires a marker', () => {
    expect(cardSchema.safeParse({ ...base, type: 'cloze', text: 'up to {{c1::P2,000,000}}', clozeIndex: 1 }).success).toBe(true);
    expect(cardSchema.safeParse({ ...base, type: 'cloze', text: 'no marker here', clozeIndex: 1 }).success).toBe(false);
  });
  it('rejects mcq with out-of-range correctIndex', () => {
    const r = cardSchema.safeParse({ ...base, type: 'mcq', stem: 'Which?', choices: ['a', 'b'], correctIndex: 5, explanation: 'x' });
    expect(r.success).toBe(false);
  });
  it('requires all four ALAC beats on hypo', () => {
    const r = cardSchema.safeParse({
      ...base, type: 'hypo', facts: 'F', question: 'Whether or not X',
      alac: { answer: 'No.', legalBasis: 'Rule (Case, G.R. No. 1)', application: 'In this case, Y', conclusion: 'Hence, Z' },
    });
    expect(r.success).toBe(true);
    const bad = cardSchema.safeParse({ ...base, type: 'hypo', facts: 'F', question: 'Q', alac: { answer: 'No.' } });
    expect(bad.success).toBe(false);
  });
  it('rejects em dashes and emojis anywhere in content', () => {
    expect(cardSchema.safeParse({ ...base, type: 'basic', front: 'bad — dash', back: 'A' }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, type: 'basic', front: 'ok', back: 'fire 🔥' }).success).toBe(false);
  });
});
```

Create `src/lib/ids.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cardId, stateId } from './ids';

describe('ids', () => {
  it('is deterministic and source-sensitive', () => {
    const a = cardId({ docId: 'd1', heading: 'II', type: 'basic', slug: 'sale-vs-agency' });
    const b = cardId({ docId: 'd1', heading: 'II', type: 'basic', slug: 'sale-vs-agency' });
    const c = cardId({ docId: 'd1', heading: 'II', type: 'basic', slug: 'other' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-z0-9]+$/);
  });
  it('joins state ids with underscore', () => {
    expect(stateId('deckA', 'card1')).toBe('deckA_card1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` Expected: FAIL, modules not found.

- [ ] **Step 3: Implement types, schema, ids**

Create `src/lib/types.ts`:

```ts
export type CardType = 'basic' | 'cloze' | 'mcq' | 'hypo';
export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface CardSource {
  docId: string;
  heading: string;
  caseTitle?: string;
  grNumber?: string;
  lawphilPdfUrl?: string;
}

interface CardBase {
  id: string;
  tags: string[];
  source: CardSource;
}

export interface BasicCard extends CardBase { type: 'basic'; front: string; back: string; }
export interface ClozeCard extends CardBase { type: 'cloze'; text: string; clozeIndex: number; }
export interface McqCard extends CardBase {
  type: 'mcq'; stem: string; choices: string[]; correctIndex: number; explanation: string; barYear?: string;
}
export interface HypoCard extends CardBase {
  type: 'hypo'; facts: string; question: string;
  alac: { answer: string; legalBasis: string; application: string; conclusion: string };
  doctrine?: string;
}
export type Card = BasicCard | ClozeCard | McqCard | HypoCard;

export interface Deck {
  id: string; ownerUid: string; title: string; subject: string; description: string;
  visibility: 'private' | 'published';
  sourceRef?: { docId: string; coverage: string };
  cardCount: number; createdAt: number; updatedAt: number;
}

export interface CardStateDoc {
  deckId: string; cardId: string;
  due: number; stability: number; difficulty: number;
  elapsedDays: number; scheduledDays: number;
  reps: number; lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  lastReview: number | null;
}

export interface ReviewLogDoc {
  cardId: string; deckId: string; grade: Grade; tags: string[]; ts: number;
  firstReview?: boolean;
  typedAnswer?: string;
  aiVerdicts?: Array<{ beat: 'answer' | 'legalBasis' | 'application' | 'conclusion'; verdict: 'got' | 'partial' | 'missed'; reason: string }>;
}

export interface EventDoc {
  id: string; type: 'recit' | 'exam' | 'quiz'; subject: string; title: string;
  date: number; coverage: { deckIds: string[]; tags: string[] };
}

export interface SubscriptionDoc { deckId: string; addedAt: number; newCardsPerDay: number; }
```

Create `src/lib/schema.ts`:

```ts
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
```

Create `src/lib/ids.ts`:

```ts
import type { CardType } from './types';

// FNV-1a 32-bit, hex output; stable across runs and platforms.
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function cardId(source: { docId: string; heading: string; type: CardType; slug: string }): string {
  const key = [source.docId, source.heading, source.type, source.slug].join('|');
  return fnv1a(key) + fnv1a(key.split('').reverse().join(''));
}

export function stateId(deckId: string, cardId: string): string {
  return `${deckId}_${cardId}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` Expected: all schema and ids tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib && git commit -m "feat: data types, card validation with house rules, deterministic ids"
```

---

### Task 4: Firestore security rules + emulator tests

**Files:**
- Modify: `firestore.rules`
- Test: `tests/rules.test.ts`
- Modify: `package.json` (add `test:rules` script)

**Interfaces:**
- Consumes: collection layout from spec section 4 (`decks/{deckId}`, `decks/{deckId}/cards/{cardId}`, `users/{uid}/...`).
- Produces: the enforced multi-user boundary all app code assumes.

- [ ] **Step 1: Write failing rules tests**

```bash
npm install -D @firebase/rules-unit-testing
```

Create `tests/rules.test.ts`:

```ts
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'lawdeck-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'decks/priv'), { ownerUid: 'alice', visibility: 'private', title: 't' });
    await setDoc(doc(db, 'decks/pub'), { ownerUid: 'alice', visibility: 'published', title: 't' });
    await setDoc(doc(db, 'decks/priv/cards/c1'), { type: 'basic', front: 'q', back: 'a' });
    await setDoc(doc(db, 'decks/pub/cards/c1'), { type: 'basic', front: 'q', back: 'a' });
  });
});

afterAll(async () => { await env.cleanup(); });

describe('deck rules', () => {
  it('owner reads own private deck', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'decks/priv')));
  });
  it('stranger cannot read a private deck or its cards', async () => {
    const db = env.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(db, 'decks/priv')));
    await assertFails(getDoc(doc(db, 'decks/priv/cards/c1')));
  });
  it('anyone signed in reads a published deck and its cards', async () => {
    const db = env.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(db, 'decks/pub')));
    await assertSucceeds(getDoc(doc(db, 'decks/pub/cards/c1')));
  });
  it('only the owner writes deck cards', async () => {
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(setDoc(doc(bob, 'decks/pub/cards/evil'), { front: 'x' }));
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'decks/pub/cards/ok'), { front: 'x' }));
  });
});

describe('user subtree rules', () => {
  it('user reads and writes own state, not others', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice/cardStates/pub_c1'), { due: 1 }));
    await assertFails(setDoc(doc(alice, 'users/bob/cardStates/pub_c1'), { due: 1 }));
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/alice/cardStates/pub_c1')));
  });
});
```

Add to `package.json` scripts:

```json
"test:rules": "firebase emulators:exec --only firestore \"vitest run tests/rules.test.ts\""
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:rules` Expected: FAIL (deny-all rules block even the owner reads).

- [ ] **Step 3: Implement the rules**

Replace `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(deckData) {
      return request.auth != null && request.auth.uid == deckData.ownerUid;
    }
    function deckData(deckId) {
      return get(/databases/$(database)/documents/decks/$(deckId)).data;
    }

    match /decks/{deckId} {
      allow read: if resource.data.visibility == 'published' || isOwner(resource.data);
      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if isOwner(resource.data);

      match /cards/{cardId} {
        allow read: if deckData(deckId).visibility == 'published' || isOwner(deckData(deckId));
        allow create, update, delete: if isOwner(deckData(deckId));
      }
    }

    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 4: Run rules tests to verify they pass**

Run: `npm run test:rules` Expected: all PASS.

- [ ] **Step 5: Deploy rules and commit**

```bash
npx firebase deploy --only firestore:rules
git add firestore.rules tests package.json && git commit -m "feat: multi-user firestore security rules with emulator tests"
```

---

### Task 5: FSRS scheduling engine wrapper

**Files:**
- Create: `src/lib/scheduler.ts`
- Test: `src/lib/scheduler.test.ts`

**Interfaces:**
- Consumes: `CardStateDoc`, `Grade` from `src/lib/types.ts`.
- Produces (Plan 3's event clamp and the review screen depend on these exact signatures):
  - `newCardState(deckId: string, cardId: string): CardStateDoc`
  - `applyReview(state: CardStateDoc, grade: Grade, now: Date): CardStateDoc`
  - `previewIntervals(state: CardStateDoc, now: Date): Record<Grade, string>` (human labels like `"10m"`, `"4d"`)
  - `clampToEvents(state: CardStateDoc, eventDates: number[], now: Date): CardStateDoc`
  - `studyDay(d: Date): string` (ISO date of the 4 a.m.-boundary study day)
  - `retrievability(state: CardStateDoc, now: Date): number`

- [ ] **Step 1: Write failing tests**

Create `src/lib/scheduler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  newCardState, applyReview, previewIntervals, clampToEvents, studyDay, retrievability,
} from './scheduler';

const NOW = new Date('2026-07-30T10:00:00+08:00');
const DAY = 24 * 60 * 60 * 1000;

describe('scheduler', () => {
  it('creates a new state due now', () => {
    const s = newCardState('d1', 'c1');
    expect(s.state).toBe('new');
    expect(s.reps).toBe(0);
    expect(s.deckId).toBe('d1');
  });

  it('again reschedules within the hour; good schedules at least a day out after learning', () => {
    const s = newCardState('d1', 'c1');
    const again = applyReview(s, 'again', NOW);
    expect(again.due - NOW.getTime()).toBeLessThan(60 * 60 * 1000);
    let st = applyReview(s, 'good', NOW);
    st = applyReview(st, 'good', new Date(NOW.getTime() + 10 * 60 * 1000));
    expect(st.due - NOW.getTime()).toBeGreaterThanOrEqual(0.9 * DAY);
    expect(st.reps).toBe(2);
  });

  it('clamps due to the day before the earliest future event, never past it', () => {
    let s = newCardState('d1', 'c1');
    s = { ...s, due: NOW.getTime() + 21 * DAY, state: 'review' };
    const event = NOW.getTime() + 6 * DAY;
    const clamped = clampToEvents(s, [event, NOW.getTime() + 30 * DAY], NOW);
    expect(clamped.due).toBeLessThan(event);
    expect(clamped.due).toBeGreaterThan(NOW.getTime());
  });

  it('ignores past events and leaves earlier dues alone', () => {
    let s = newCardState('d1', 'c1');
    s = { ...s, due: NOW.getTime() + 2 * DAY, state: 'review' };
    const clamped = clampToEvents(s, [NOW.getTime() - DAY, NOW.getTime() + 6 * DAY], NOW);
    expect(clamped.due).toBe(NOW.getTime() + 2 * DAY);
  });

  it('study day rolls over at 4am local', () => {
    expect(studyDay(new Date('2026-07-30T02:30:00+08:00'))).toBe('2026-07-29');
    expect(studyDay(new Date('2026-07-30T05:00:00+08:00'))).toBe('2026-07-30');
  });

  it('previews four labeled intervals', () => {
    const p = previewIntervals(newCardState('d1', 'c1'), NOW);
    for (const k of ['again', 'hard', 'good', 'easy'] as const) {
      expect(p[k]).toMatch(/^\d+(m|h|d|mo)$/);
    }
  });

  it('retrievability is between 0 and 1 for a reviewed card', () => {
    const s = applyReview(newCardState('d1', 'c1'), 'good', NOW);
    const r = retrievability(s, new Date(NOW.getTime() + 3 * DAY));
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` Expected: FAIL, `./scheduler` not found.

- [ ] **Step 3: Implement the wrapper**

Create `src/lib/scheduler.ts`:

```ts
import {
  fsrs, generatorParameters, createEmptyCard, Rating, State, type Card as FsrsCard,
} from 'ts-fsrs';
import type { CardStateDoc, Grade } from './types';

const f = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }));

const GRADE_TO_RATING: Record<Grade, Rating> = {
  again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy,
};

const STATE_TO_STR: Record<State, CardStateDoc['state']> = {
  [State.New]: 'new', [State.Learning]: 'learning',
  [State.Review]: 'review', [State.Relearning]: 'relearning',
};
const STR_TO_STATE: Record<CardStateDoc['state'], State> = {
  new: State.New, learning: State.Learning, review: State.Review, relearning: State.Relearning,
};

function toFsrs(s: CardStateDoc): FsrsCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    reps: s.reps,
    lapses: s.lapses,
    state: STR_TO_STATE[s.state],
    last_review: s.lastReview === null ? undefined : new Date(s.lastReview),
  } as FsrsCard;
}

function fromFsrs(deckId: string, cardId: string, c: FsrsCard): CardStateDoc {
  return {
    deckId, cardId,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: STATE_TO_STR[c.state],
    lastReview: c.last_review ? c.last_review.getTime() : null,
  };
}

export function newCardState(deckId: string, cardId: string): CardStateDoc {
  return fromFsrs(deckId, cardId, createEmptyCard(new Date()));
}

export function applyReview(state: CardStateDoc, grade: Grade, now: Date): CardStateDoc {
  const { card } = f.next(toFsrs(state), now, GRADE_TO_RATING[grade]);
  return fromFsrs(state.deckId, state.cardId, card);
}

export function clampToEvents(state: CardStateDoc, eventDates: number[], now: Date): CardStateDoc {
  const future = eventDates.filter((d) => d > now.getTime());
  if (future.length === 0) return state;
  const earliest = Math.min(...future);
  const dayBefore = earliest - 24 * 60 * 60 * 1000;
  if (state.due <= dayBefore) return state;
  return { ...state, due: Math.max(now.getTime(), dayBefore) };
}

export function studyDay(d: Date): string {
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function label(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}

export function previewIntervals(state: CardStateDoc, now: Date): Record<Grade, string> {
  const out = {} as Record<Grade, string>;
  for (const g of ['again', 'hard', 'good', 'easy'] as Grade[]) {
    const { card } = f.next(toFsrs(state), now, GRADE_TO_RATING[g]);
    out[g] = label(card.due.getTime() - now.getTime());
  }
  return out;
}

export function retrievability(state: CardStateDoc, now: Date): number {
  return f.get_retrievability(toFsrs(state), now, false) as number;
}
```

Note for the implementer: `f.next` and `f.get_retrievability` exist in ts-fsrs v4+. If the installed version rejects `f.next`, use `f.repeat(card, now)[GRADE_TO_RATING[g]].card` instead; the tests define the contract, not the internal call.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` Expected: all scheduler tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduler.ts src/lib/scheduler.test.ts
git commit -m "feat: fsrs scheduling wrapper with event clamp and 4am study day"
```

---

### Task 6: Auth provider, sign-in screen, app shell

**Files:**
- Create: `src/lib/auth.tsx`, `src/screens/SignIn.tsx`, `src/screens/Home.tsx` (stub), `src/App.tsx` (replace), `src/main.tsx` (modify)
- Delete: `src/App.css`, Vite logo assets

**Interfaces:**
- Consumes: `auth` from `src/lib/firebase.ts`.
- Produces: `useUser(): { user: User | null; loading: boolean }` hook; `<RequireAuth>` wrapper; routes `/` (home) and `/review/:deckId` (added in Task 9).

- [ ] **Step 1: Implement auth context**

Create `src/lib/auth.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';

const Ctx = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);
  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export const useUser = () => useContext(Ctx);
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser = () => signOut(auth);
```

- [ ] **Step 2: Screens and routing**

Create `src/screens/SignIn.tsx`:

```tsx
import { signIn } from '../lib/auth';

export default function SignIn() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold text-maroon">LawDeck</h1>
      <p className="text-sm opacity-70">Active recall for law school.</p>
      <button
        onClick={() => void signIn()}
        className="bg-mustard text-maroon font-semibold rounded-lg px-6 py-3 hover:bg-mustard-dark"
      >
        Sign in with Google
      </button>
    </main>
  );
}
```

Create `src/screens/Home.tsx` (deck list arrives in Task 9; keep a minimal signed-in shell):

```tsx
import { useUser, signOutUser } from '../lib/auth';

export default function Home() {
  const { user } = useUser();
  return (
    <main className="max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-maroon">LawDeck</h1>
        <button className="text-sm underline" onClick={() => void signOutUser()}>
          {user?.displayName ?? 'account'}: sign out
        </button>
      </header>
      <p className="text-sm opacity-70">Decks load here (Task 9).</p>
    </main>
  );
}
```

Replace `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useUser } from './lib/auth';
import SignIn from './screens/SignIn';
import Home from './screens/Home';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  if (loading) return <p className="p-6 text-sm opacity-60">Loading...</p>;
  return user ? <>{children}</> : <Navigate to="/signin" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

In `src/main.tsx`, keep only the `index.css` import (remove `App.css`); delete `src/App.css` and `src/assets/react.svg`, and remove the Vite logo references from `index.html` (set `<title>LawDeck</title>`).

- [ ] **Step 3: Manual verification**

Run: `npx firebase emulators:start --only auth,firestore` in one terminal, `npm run dev` in another.
Verify: `/` redirects to `/signin`; the sign-in button opens the emulator's fake Google flow; after sign-in you land on Home with your name; sign out returns to `/signin`. No blue anywhere; button is mustard with maroon text.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: google auth, sign-in screen, routed app shell"
```

---

### Task 7: Dev seed script (sample deck, one card per type)

**Files:**
- Create: `scripts/seed.mts`
- Modify: `package.json` (script `seed`), `tsconfig` include if needed

**Interfaces:**
- Consumes: `cardSchema` from `src/lib/schema.ts`, `cardId` from `src/lib/ids.ts`.
- Produces: emulator data: deck `civpro-1` owned by the signed-in dev user, with 4 valid cards (basic, 2 cloze siblings, mcq, hypo) matching the approved mockups; a subscription doc.

- [ ] **Step 1: Write the seed script**

```bash
npm install -D tsx firebase-admin
```

Create `scripts/seed.mts`:

```ts
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

console.log(`Seeded deck ${deckId} with ${cards.length} cards for uid ${uid}`);
```

Add script: `"seed": "tsx scripts/seed.mts"`.

- [ ] **Step 2: Verify against the emulator**

With emulators running and a dev user signed in once (copy the uid from the Auth emulator UI at http://127.0.0.1:4000):

Run: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 SEED_UID=<uid> npm run seed`
Expected: "Seeded deck civpro-1 with 5 cards"; documents visible in the Firestore emulator UI.

- [ ] **Step 3: Commit**

```bash
git add scripts package.json && git commit -m "chore: emulator seed script with sample deck"
```

---

### Task 8: Review queue builder

**Files:**
- Create: `src/lib/queue.ts`
- Test: `src/lib/queue.test.ts`

**Interfaces:**
- Consumes: `Card`, `CardStateDoc`, `SubscriptionDoc` from types; `studyDay` from scheduler.
- Produces: `buildQueue(args: { cards: Card[]; states: Map<string, CardStateDoc>; newCardsPerDay: number; newIntroducedToday: number; now: Date; skipHypos?: boolean }): Card[]`
  - Due cards (state exists, `due <= now`) first, ordered by due ascending.
  - Then new cards (no state) up to the remaining daily allotment, where a hypo consumes 3 slots and other types 1.
  - `skipHypos: true` removes hypos entirely.

- [ ] **Step 1: Write failing tests**

Create `src/lib/queue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildQueue } from './queue';
import { newCardState } from './scheduler';
import type { Card, CardStateDoc } from './types';

const NOW = new Date('2026-07-30T10:00:00+08:00');
const src = { docId: 'd', heading: 'h' };
const mk = (id: string, type: Card['type']): Card =>
  type === 'basic'
    ? { id, type, tags: ['t'], source: src, front: 'f', back: 'b' }
    : type === 'cloze'
      ? { id, type, tags: ['t'], source: src, text: '{{c1::x}}', clozeIndex: 1 }
      : type === 'mcq'
        ? { id, type, tags: ['t'], source: src, stem: 's', choices: ['a', 'b'], correctIndex: 0, explanation: 'e' }
        : { id, type, tags: ['t'], source: src, facts: 'f', question: 'q', alac: { answer: 'a', legalBasis: 'l', application: 'ap', conclusion: 'c' } };

function due(id: string, offsetMs: number): CardStateDoc {
  return { ...newCardState('d1', id), due: NOW.getTime() + offsetMs, state: 'review' };
}

describe('buildQueue', () => {
  it('puts due cards first, ordered by due date', () => {
    const cards = [mk('a', 'basic'), mk('b', 'basic'), mk('c', 'basic')];
    const states = new Map([['b', due('b', -1000)], ['a', due('a', -5000)]]);
    const q = buildQueue({ cards, states, newCardsPerDay: 0, newIntroducedToday: 0, now: NOW });
    expect(q.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('introduces new cards up to the allotment, hypos costing 3', () => {
    const cards = [mk('h1', 'hypo'), mk('n1', 'basic'), mk('n2', 'basic'), mk('n3', 'basic')];
    const q = buildQueue({ cards, states: new Map(), newCardsPerDay: 4, newIntroducedToday: 0, now: NOW });
    // hypo (3) + one basic (1) = 4 slots
    expect(q).toHaveLength(2);
  });

  it('respects cards already introduced today', () => {
    const cards = [mk('n1', 'basic'), mk('n2', 'basic')];
    const q = buildQueue({ cards, states: new Map(), newCardsPerDay: 2, newIntroducedToday: 1, now: NOW });
    expect(q).toHaveLength(1);
  });

  it('skipHypos removes hypos, due or new', () => {
    const cards = [mk('h1', 'hypo'), mk('n1', 'basic')];
    const states = new Map([['h1', due('h1', -1000)]]);
    const q = buildQueue({ cards, states, newCardsPerDay: 5, newIntroducedToday: 0, now: NOW, skipHypos: true });
    expect(q.map((c) => c.id)).toEqual(['n1']);
  });

  it('future-due cards are neither due nor new', () => {
    const cards = [mk('a', 'basic')];
    const states = new Map([['a', due('a', +999999)]]);
    const q = buildQueue({ cards, states, newCardsPerDay: 5, newIntroducedToday: 0, now: NOW });
    expect(q).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` Expected: FAIL, `./queue` not found.

- [ ] **Step 3: Implement**

Create `src/lib/queue.ts`:

```ts
import type { Card, CardStateDoc } from './types';

const HYPO_COST = 3;

export function buildQueue(args: {
  cards: Card[];
  states: Map<string, CardStateDoc>;
  newCardsPerDay: number;
  newIntroducedToday: number;
  now: Date;
  skipHypos?: boolean;
}): Card[] {
  const { states, newCardsPerDay, newIntroducedToday, now } = args;
  const cards = args.skipHypos ? args.cards.filter((c) => c.type !== 'hypo') : args.cards;

  const dueCards = cards
    .filter((c) => { const s = states.get(c.id); return s !== undefined && s.due <= now.getTime(); })
    .sort((a, b) => states.get(a.id)!.due - states.get(b.id)!.due);

  let budget = Math.max(0, newCardsPerDay - newIntroducedToday);
  const newCards: Card[] = [];
  for (const c of cards) {
    if (states.has(c.id)) continue;
    const cost = c.type === 'hypo' ? HYPO_COST : 1;
    if (cost > budget) continue;
    budget -= cost;
    newCards.push(c);
  }
  return [...dueCards, ...newCards];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` Expected: all queue tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/lib/queue.test.ts
git commit -m "feat: review queue builder with hypo weighting and daily allotment"
```

---

### Task 9: Deck list, review screen (basic + cloze), persistence

**Files:**
- Create: `src/lib/data.ts`, `src/screens/Review.tsx`, `src/components/CardView.tsx`, `src/components/GradeBar.tsx`
- Modify: `src/screens/Home.tsx` (real deck list), `src/App.tsx` (add `/review/:deckId` route)
- Test: `src/components/CardView.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3, 5, 8; `db` from firebase.
- Produces:
  - `data.ts`: `fetchDeckBundle(uid: string, deckId: string): Promise<{ deck: Deck; cards: Card[]; states: Map<string, CardStateDoc>; subscription: SubscriptionDoc | null; newIntroducedToday: number }>` and `persistReview(uid: string, card: Card, prev: CardStateDoc | undefined, next: CardStateDoc, grade: Grade): Promise<void>` (writes `users/{uid}/cardStates/{stateId}` and appends `users/{uid}/reviewLogs` with `firstReview: prev === undefined`, in one `writeBatch`).
  - `CardView` renders `basic` and `cloze` fronts/backs (mcq/hypo render as "coming in plan 2" placeholder cards and are excluded from queues by passing `skipHypos` and filtering mcq at the screen level UNTIL Plan 2; the component API already accepts all four types: `<CardView card={card} revealed={boolean} />`).
  - Cloze rendering rule: markers `{{cN::text}}`; the card's own `clozeIndex` renders as a blank (front) or `.reveal`-styled text (back, class `text-maroon font-bold border-b-2 border-mustard`); other markers always render their plain text.

- [ ] **Step 1: Write failing CardView tests**

Create `src/components/CardView.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CardView from './CardView';
import type { ClozeCard } from '../lib/types';

const cloze: ClozeCard = {
  id: 'c1', type: 'cloze', tags: ['t'], source: { docId: 'd', heading: 'h' },
  text: 'claims up to {{c1::P2,000,000}} and value up to {{c2::P400,000}}',
  clozeIndex: 1,
};

describe('CardView cloze', () => {
  it('blanks only its own deletion on the front', () => {
    render(<CardView card={cloze} revealed={false} />);
    expect(screen.queryByText(/P2,000,000/)).toBeNull();
    expect(screen.getByText(/P400,000/)).toBeInTheDocument();
  });
  it('reveals its deletion in maroon on the back', () => {
    render(<CardView card={cloze} revealed={true} />);
    const el = screen.getByText('P2,000,000');
    expect(el.className).toContain('text-maroon');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test` Expected: FAIL, CardView not found.

- [ ] **Step 3: Implement CardView + GradeBar**

Create `src/components/CardView.tsx`:

```tsx
import type { Card } from '../lib/types';
import type { ReactNode } from 'react';

const CLOZE_RE = /\{\{c(\d+)::([^}]+)\}\}/g;

function renderCloze(text: string, ownIndex: number, revealed: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0; let key = 0;
  for (const m of text.matchAll(CLOZE_RE)) {
    out.push(text.slice(last, m.index));
    const idx = Number(m[1]);
    if (idx !== ownIndex) {
      out.push(m[2]);
    } else if (revealed) {
      out.push(<span key={key++} className="text-maroon font-bold border-b-2 border-mustard">{m[2]}</span>);
    } else {
      out.push(<span key={key++} className="inline-block min-w-20 border-b-2 border-mustard">&nbsp;</span>);
    }
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(text.slice(last));
  return out;
}

export default function CardView({ card, revealed }: { card: Card; revealed: boolean }) {
  if (card.type === 'basic') {
    return (
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{card.front}</p>
        {revealed && <p className="mt-3 pt-3 border-t border-mustard/50">{card.back}</p>}
      </div>
    );
  }
  if (card.type === 'cloze') {
    return (
      <div className="border border-mustard rounded-lg p-4 leading-relaxed">
        <p>{renderCloze(card.text, card.clozeIndex, revealed)}</p>
      </div>
    );
  }
  return (
    <div className="border border-mustard rounded-lg p-4 text-sm opacity-70">
      {card.type.toUpperCase()} cards arrive in the next milestone.
    </div>
  );
}
```

Create `src/components/GradeBar.tsx`:

```tsx
import type { Grade } from '../lib/types';

const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];
const LABELS: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

export default function GradeBar({ intervals, onGrade }: {
  intervals: Record<Grade, string>;
  onGrade: (g: Grade) => void;
}) {
  return (
    <div className="flex gap-2">
      {GRADES.map((g, i) => (
        <button
          key={g}
          onClick={() => onGrade(g)}
          className={
            'flex-1 rounded-lg py-2 text-sm ' +
            (g === 'good'
              ? 'bg-mustard text-maroon font-semibold border-2 border-maroon'
              : 'border border-gray-400/60')
          }
        >
          {LABELS[g]}
          <span className="block text-xs opacity-80">{intervals[g]} ({i + 1})</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run CardView tests to verify they pass**

Run: `npm test` Expected: PASS.

- [ ] **Step 5: Data layer**

Create `src/lib/data.ts`:

```ts
import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { stateId } from './ids';
import { studyDay } from './scheduler';
import type { Card, CardStateDoc, Deck, Grade, SubscriptionDoc } from './types';

export async function fetchDecks(uid: string): Promise<Deck[]> {
  const snap = await getDocs(query(collection(db, 'decks'), where('ownerUid', '==', uid)));
  return snap.docs.map((d) => d.data() as Deck);
}

export async function fetchDeckBundle(uid: string, deckId: string) {
  const [deckSnap, cardsSnap, statesSnap, subSnap, logsSnap] = await Promise.all([
    getDoc(doc(db, 'decks', deckId)),
    getDocs(collection(db, 'decks', deckId, 'cards')),
    getDocs(query(collection(db, 'users', uid, 'cardStates'), where('deckId', '==', deckId))),
    getDoc(doc(db, 'users', uid, 'subscriptions', deckId)),
    getDocs(query(collection(db, 'users', uid, 'reviewLogs'), where('deckId', '==', deckId))),
  ]);
  const deck = deckSnap.data() as Deck;
  const cards = cardsSnap.docs.map((d) => d.data() as Card);
  const states = new Map<string, CardStateDoc>();
  statesSnap.docs.forEach((d) => { const s = d.data() as CardStateDoc; states.set(s.cardId, s); });
  const today = studyDay(new Date());
  const newIntroducedToday = logsSnap.docs
    .map((d) => d.data() as { ts: number; firstReview?: boolean })
    .filter((l) => l.firstReview === true && studyDay(new Date(l.ts)) === today).length;
  return {
    deck, cards, states,
    subscription: (subSnap.data() as SubscriptionDoc | undefined) ?? null,
    newIntroducedToday,
  };
}

export async function persistReview(
  uid: string, card: Card, prev: CardStateDoc | undefined, next: CardStateDoc, grade: Grade,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'cardStates', stateId(next.deckId, next.cardId)), next);
  batch.set(doc(collection(db, 'users', uid, 'reviewLogs')), {
    cardId: next.cardId, deckId: next.deckId, grade, tags: card.tags,
    ts: Date.now(), firstReview: prev === undefined, createdAt: serverTimestamp(),
  });
  await batch.commit();
}
```

- [ ] **Step 6: Review screen and wiring**

Create `src/screens/Review.tsx`:

```tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { fetchDeckBundle, persistReview } from '../lib/data';
import { buildQueue } from '../lib/queue';
import { applyReview, newCardState, previewIntervals } from '../lib/scheduler';
import CardView from '../components/CardView';
import GradeBar from '../components/GradeBar';
import type { Card, CardStateDoc, Grade } from '../lib/types';

export default function Review() {
  const { deckId = '' } = useParams();
  const { user } = useUser();
  const [queue, setQueue] = useState<Card[]>([]);
  const [states, setStates] = useState<Map<string, CardStateDoc>>(new Map());
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!user) return;
    void fetchDeckBundle(user.uid, deckId).then((b) => {
      setTitle(b.deck.title);
      setStates(b.states);
      setQueue(buildQueue({
        cards: b.cards.filter((c) => c.type === 'basic' || c.type === 'cloze'),
        states: b.states,
        newCardsPerDay: b.subscription?.newCardsPerDay ?? 15,
        newIntroducedToday: b.newIntroducedToday,
        now: new Date(),
      }));
    });
  }, [user, deckId]);

  const card = queue[pos];
  const state = card ? states.get(card.id) : undefined;
  const intervals = useMemo(
    () => (card ? previewIntervals(state ?? newCardState(deckId, card.id), new Date()) : null),
    [card, state, deckId],
  );

  const grade = useCallback((g: Grade) => {
    if (!card || !user) return;
    const prev = states.get(card.id);
    const next = applyReview(prev ?? newCardState(deckId, card.id), g, new Date());
    void persistReview(user.uid, card, prev, next, g);
    setStates((m) => new Map(m).set(card.id, next));
    setRevealed(false);
    if (g === 'again') {
      setQueue((q) => [...q.slice(0, pos), ...q.slice(pos + 1), card]);
    } else {
      setPos((p) => p + 1);
    }
  }, [card, user, states, deckId, pos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setRevealed(true); }
      const map: Record<string, Grade> = { Digit1: 'again', Digit2: 'hard', Digit3: 'good', Digit4: 'easy' };
      if (revealed && map[e.code]) grade(map[e.code]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, grade]);

  if (!card) {
    return (
      <main className="max-w-xl mx-auto p-4">
        <p className="mb-4">Done for now. Nothing due in this deck.</p>
        <Link className="underline text-maroon" to="/">Back to decks</Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto p-4 flex flex-col gap-4 min-h-dvh">
      <header className="flex justify-between text-sm opacity-70">
        <Link to="/" className="underline">{title}</Link>
        <span>{pos + 1} / {queue.length}</span>
      </header>
      <div className="flex-1" onClick={() => setRevealed(true)}>
        <CardView card={card} revealed={revealed} />
        {!revealed && <p className="text-center text-sm opacity-50 mt-3">tap or press space to reveal</p>}
      </div>
      {revealed && intervals && <GradeBar intervals={intervals} onGrade={grade} />}
    </main>
  );
}
```

Replace the body of `src/screens/Home.tsx` with a real deck list (keep the header from Task 6):

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser, signOutUser } from '../lib/auth';
import { fetchDecks } from '../lib/data';
import type { Deck } from '../lib/types';

export default function Home() {
  const { user } = useUser();
  const [decks, setDecks] = useState<Deck[]>([]);
  useEffect(() => {
    if (user) void fetchDecks(user.uid).then(setDecks);
  }, [user]);
  return (
    <main className="max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-maroon">LawDeck</h1>
        <button className="text-sm underline" onClick={() => void signOutUser()}>
          {user?.displayName ?? 'account'}: sign out
        </button>
      </header>
      {decks.length === 0 && <p className="text-sm opacity-70">No decks yet.</p>}
      <ul className="divide-y divide-gray-300/50">
        {decks.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{d.title}</p>
              <p className="text-xs opacity-60">{d.subject}: {d.cardCount} cards</p>
            </div>
            <Link to={`/review/${d.id}`} className="bg-mustard text-maroon font-semibold rounded-lg px-4 py-2 text-sm">
              Study
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

Add the route in `App.tsx`:

```tsx
<Route path="/review/:deckId" element={<RequireAuth><Review /></RequireAuth>} />
```

- [ ] **Step 7: Manual verification (whole loop)**

With emulators + dev server + seeded data (Task 7):
1. Sign in, open the sample deck, review the basic card and the two cloze siblings.
2. Confirm: front blanks only its own deletion; reveal shows maroon-on-mustard-underline (no filled chip); grade buttons show intervals; keyboard space/1-4 works; "again" re-queues the card at the end.
3. In the Firestore emulator UI, confirm `users/{uid}/cardStates/civpro-1_*` and `reviewLogs` documents appeared.
4. Reload the page: reviewed cards are no longer due; queue shrinks accordingly.
5. Dev-tools offline mode: grade a card, go online, confirm the write syncs (persistentLocalCache).

- [ ] **Step 8: Run full test suite and commit**

Run: `npm test` Expected: all PASS.

```bash
git add -A && git commit -m "feat: deck list and review loop for basic and cloze cards with persistence"
```

---

### Task 10: PWA manifest + CI deploy to Firebase Hosting

**Files:**
- Modify: `vite.config.ts` (add vite-plugin-pwa), `index.html`
- Create: `public/icon.svg`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the built app (`npm run build` to `dist/`), `firebase.json` hosting block from Task 2.
- Produces: live HTTPS URL on Firebase Hosting; installable PWA on phone and laptop.

- [ ] **Step 1: PWA plugin and manifest**

```bash
npm install -D vite-plugin-pwa
```

In `vite.config.ts`, add to `plugins`:

```ts
import { VitePWA } from 'vite-plugin-pwa';
// inside plugins array, after tailwindcss():
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icon.svg'],
  manifest: {
    name: 'LawDeck',
    short_name: 'LawDeck',
    description: 'Active recall flashcards for law school',
    theme_color: '#7B1113',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  },
}),
```

Create `public/icon.svg` (mustard rounded square, maroon LD monogram, no emoji):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#E0A526"/>
  <text x="256" y="330" font-family="Georgia, serif" font-size="220" font-weight="bold"
        text-anchor="middle" fill="#7B1113">LD</text>
</svg>
```

- [ ] **Step 2: Verify the build**

Run: `npm run build && npx vite preview` Expected: build succeeds; preview serves; Chrome DevTools > Application shows a valid manifest and registered service worker.

- [ ] **Step 3: CI deploy workflow**

Run `npx firebase init hosting:github` yourself (it may open a browser for GitHub authorization; if so, tell the user to complete the prompt). It creates the service-account secret `FIREBASE_SERVICE_ACCOUNT_FLASHCARDS_BE310` in the `sites-9400/flashcards` repo. Then replace the generated workflow with `.github/workflows/deploy.yml`:

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_FB_API_KEY: ${{ vars.VITE_FB_API_KEY }}
          VITE_FB_AUTH_DOMAIN: ${{ vars.VITE_FB_AUTH_DOMAIN }}
          VITE_FB_PROJECT_ID: ${{ vars.VITE_FB_PROJECT_ID }}
          VITE_FB_APP_ID: ${{ vars.VITE_FB_APP_ID }}
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_FLASHCARDS_BE310 }}
          channelId: live
          projectId: flashcards-be310
```

Set the four `VITE_FB_*` repository variables yourself with the gh CLI (values from Global Constraints):

```bash
gh variable set VITE_FB_API_KEY -R sites-9400/flashcards -b "AIzaSyDb8ACKIV6VRJ4zArCAdox02OYwD48hY_Q"
gh variable set VITE_FB_AUTH_DOMAIN -R sites-9400/flashcards -b "flashcards-be310.firebaseapp.com"
gh variable set VITE_FB_PROJECT_ID -R sites-9400/flashcards -b "flashcards-be310"
gh variable set VITE_FB_APP_ID -R sites-9400/flashcards -b "1:30911096236:web:961df37c7bcde9d449c609"
```

- [ ] **Step 4: Ship and verify on devices**

```bash
git add -A && git commit -m "feat: pwa manifest and ci deploy to firebase hosting"
git push
```

Expected: the Actions run goes green and prints the hosting URL. Verify: sign in on the laptop at the live URL (this uses REAL Firestore now: seed a real deck by temporarily pointing the seed script at production only if the user asks; otherwise create a deck by hand in the console, or wait for Plan 4's pipeline). On the phone, open the URL, "Add to Home Screen," confirm it launches standalone with the maroon theme color.

Note: real-Firestore data entry is intentionally thin here; Plan 4's pipeline is the real content path. If the user wants cards on production before Plan 4, adapt `scripts/seed.mts` by removing the emulator guard AND requiring explicit `I_UNDERSTAND_PROD=1`, with the user's confirmation.

---

## Out of scope for this plan (later plans)

- Plan 2: MCQ and hypo review UIs, ALAC checklist self-grade, typed answers, `gradeAnswer` Cloud Function (Claude Haiku), hypo history.
- Plan 3: events (recit/exam) CRUD, coverage, interval clamp wiring (`clampToEvents` is already built and tested), prep sessions, stats screens (streak, retention, weak topics, readiness).
- Plan 4: `make-deck` pipeline in the Law School workspace (card-writer Haiku agents, card-qa Sonnet gate, Admin SDK uploader with the same `cardSchema`), deck publishing UI, TOC/registration conventions.
