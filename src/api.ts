import { catalogSchema, validateBatch } from '../shared/contracts';
import type { BatchRequest, Catalog, QuestionBatch } from '../shared/types';

export const isPreview = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1';
const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

async function requestJSON(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', signal,
    headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? '暂时无法准备题目，请稍后重试。');
  return data;
}
export async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  if (isPreview && import.meta.env.DEV) return (await import('./preview')).previewCatalog;
  const parsed = catalogSchema.safeParse(await requestJSON('/api/catalog', signal));
  if (!parsed.success) throw new Error('课时暂时不可用，请稍后重试。');
  const catalog = parsed.data;
  if (catalog.origin !== 'live') throw new Error('课时暂时不可用，请稍后重试。');
  return catalog;
}
export async function prepareBatch(input: BatchRequest, catalog: Catalog, signal: AbortSignal): Promise<QuestionBatch> {
  const raw = isPreview && import.meta.env.DEV ? await (await import('./preview')).previewBatch(input) : await requestJSON('/api/batches', signal, input);
  signal.throwIfAborted();
  let batch: QuestionBatch;
  try { batch = validateBatch(raw, input, catalog); } catch { throw new Error('本次题目未通过检查，请调整范围或重试。'); }
  if (!isPreview && batch.origin !== 'live') throw new Error('题目暂时不可用，请稍后重试。');
  const urls = [...new Set(batch.questions.flatMap(q => [...q.images.map(i => i.url), ...q.choices.flatMap(c => c.image ? [c.image.url] : [])]))];
  await Promise.all(urls.map(url => new Promise<void>((resolve, reject) => {
    const image = new Image();
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
    const fail = () => { cleanup(); image.src = ''; reject(new Error('有图片未加载完成，请重试。')); };
    const abort = () => { cleanup(); image.src = ''; reject(signal.reason); };
    const timeout = setTimeout(fail, 15000);
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => { cleanup(); resolve(); };
    image.onerror = fail;
    image.src = url;
  })));
  signal.throwIfAborted();
  return batch;
}
