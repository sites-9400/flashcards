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
