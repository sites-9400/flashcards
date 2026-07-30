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
