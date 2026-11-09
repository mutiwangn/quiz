export type QuestionKind = 'single' | 'boolean';
export type Mode = 'single' | 'duel';
export type DataOrigin = 'live' | 'preview';
export interface ImageAsset { url: string; alt: string }
export interface Choice { id: string; text: string; image?: ImageAsset }
export interface Question {
  id: string;
  kind: QuestionKind;
  lessonIds: string[];
  prompt: string;
  images: ImageAsset[];
  choices: Choice[];
  answerId: string;
  explanation: string;
}
export interface Lesson { id: string; name: string }
export interface Unit { id: string; name: string; lessons: Lesson[] }
export interface Catalog {
  id: string;
  title: string;
  edition: string;
  grade: number;
  term: string;
  units: Unit[];
  fetchedAt: string;
  origin: DataOrigin;
}
export interface BatchRequest {
  catalogId: string;
  lessonIds: string[];
  kinds: QuestionKind[];
  count: number;
  excludeIds?: string[];
}
export interface QuestionBatch {
  id: string;
  catalogId: string;
  questions: Question[];
  preparedAt: string;
  origin: DataOrigin;
}
