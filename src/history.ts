import { openDB, type DBSchema } from 'idb';
import type { RoundSummary } from '../shared/round';
import type { DataOrigin } from '../shared/types';

export interface HistoryRecord extends RoundSummary { lessonNames: string[]; origin: DataOrigin }
interface QuizDB extends DBSchema { rounds: { key: string; value: HistoryRecord; indexes: { 'by-date': number } } }
const database = () => openDB<QuizDB>('quiz-local-v1', 1, { upgrade(db) { db.createObjectStore('rounds', { keyPath: 'id' }).createIndex('by-date', 'startedAt'); } });
export async function saveHistory(record: HistoryRecord) { const db = await database(); try { await db.put('rounds', record); } finally { db.close(); } }
export async function readHistory(): Promise<HistoryRecord[]> {
  const db = await database();
  try { return (await db.getAllFromIndex('rounds', 'by-date')).reverse(); } finally { db.close(); }
}
export async function clearHistory() { const db = await database(); try { await db.clear('rounds'); } finally { db.close(); } }
