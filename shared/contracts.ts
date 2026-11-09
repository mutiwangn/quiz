import { z } from 'zod';
import type { BatchRequest, Catalog, QuestionBatch } from './types.ts';

const text = z.string().trim().min(1).max(12000).refine(s => !/<\/?[a-z][^>]*>/i.test(s), '只接受纯文本');
const id = z.string().trim().min(1).max(250);
const image = z.object({ url: z.url().refine(url => new URL(url).protocol === 'https:'), alt: z.string().max(300) });
const choice = z.object({ id, text: z.string().max(4000), image: image.optional() }).refine(c => Boolean(c.text.trim() || c.image));
const unique = (items: string[]) => new Set(items).size === items.length;
export const questionSchema = z.object({
  id: id.refine(s => !/^0+(?:-0+)*$/.test(s), '无效题号'),
  kind: z.enum(['single', 'boolean']), lessonIds: z.array(id).min(1).max(24),
  prompt: text, images: z.array(image).max(10), choices: z.array(choice).min(2).max(4),
  answerId: id, explanation: z.string().max(12000),
}).refine(q => unique(q.choices.map(c => c.id)) && q.choices.some(c => c.id === q.answerId), '答案必须对应唯一选项')
  .refine(q => unique(q.choices.map(c => `${c.text.replace(/\s/g, '')}|${c.image?.url ?? ''}`)), '不能有无法区分的选项')
  .refine(q => q.kind !== 'boolean' || q.choices.length === 2, '判断题必须有两个选项');
export const catalogSchema = z.object({
  id, title: text, edition: text, grade: z.number().int().min(1).max(12), term: text,
  origin: z.enum(['live', 'preview']), fetchedAt: z.iso.datetime({ offset: true }),
  units: z.array(z.object({ id, name: text, lessons: z.array(z.object({ id, name: text })).min(1).max(100) })).min(1).max(20),
}).refine(c => unique(c.units.map(u => u.id)) && unique(c.units.flatMap(u => u.lessons.map(l => l.id))), '目录编号重复');
export const batchRequestSchema = z.object({
  catalogId: id, lessonIds: z.array(id).min(1).max(24).refine(unique),
  kinds: z.array(z.enum(['single', 'boolean'])).min(1).max(2).refine(unique),
  count: z.number().int().min(1).max(30),
});
export const batchSchema = z.object({
  id, catalogId: id, questions: z.array(questionSchema).min(1).max(30),
  preparedAt: z.iso.datetime({ offset: true }), origin: z.enum(['live', 'preview']),
});

export function validateBatch(raw: unknown, request: BatchRequest, catalog: Catalog): QuestionBatch {
  const batch = batchSchema.parse(raw);
  const allowed = new Set(request.lessonIds);
  const known = new Set(catalog.units.flatMap(u => u.lessons.map(l => l.id)));
  if (batch.catalogId !== request.catalogId || batch.questions.length !== request.count
    || !unique(batch.questions.map(q => q.id)) || !unique(batch.questions.map(q => q.prompt.replace(/\s/g, '')))
    || request.lessonIds.some(id => !known.has(id))
    || batch.questions.some(q => !q.lessonIds.some(id => allowed.has(id)) || q.lessonIds.some(id => !known.has(id)) || !request.kinds.includes(q.kind))) {
    throw new Error('题包范围、数量或去重校验失败');
  }
  return batch;
}
