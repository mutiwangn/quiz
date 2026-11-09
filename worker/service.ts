import { batchRequestSchema, catalogSchema, validateBatch } from '../shared/contracts.ts';
import type { Catalog } from '../shared/types.ts';
import { readPublicCatalog } from './catalog.ts';

export interface ServiceEnv {
  RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  ALLOWED_ORIGIN?: string;
  GATEWAY_URL?: string;
  GATEWAY_TOKEN?: string;
  CATALOG_ENDPOINT?: string;
  CATALOG_BOOK_ID?: string;
}

class ServiceError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code = code; this.status = status; }
}
const notConfigured = () => new ServiceError('SOURCE_NOT_CONFIGURED', 503, '题目暂时未准备好，请稍后重试。');

export function createService(env: ServiceEnv, fetcher: typeof fetch = fetch) {
  async function upstream(path: string, init?: RequestInit): Promise<unknown> {
    if (!env.GATEWAY_URL || !env.GATEWAY_TOKEN) throw notConfigured();
    const url = new URL(env.GATEWAY_URL.replace(/\/$/, '') + path);
    if (url.protocol !== 'https:') throw notConfigured();
    const response = await fetcher(url.href, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GATEWAY_TOKEN}` } });
    if (response.status === 401 || response.status === 403) throw new ServiceError('ACCESS_REQUIRED', 503, '题目暂时不可用，请稍后重试。');
    if (response.status === 429) throw new ServiceError('QUOTA_EXHAUSTED', 503, '今日题目准备次数已用完，请稍后再来。');
    if (!response.ok) throw new ServiceError('UPSTREAM_UNAVAILABLE', 502, '题目准备失败，请重试。');
    const body = await response.text();
    if (body.length > 2000000) throw new Error('响应过大');
    return JSON.parse(body);
  }
  async function getCatalog(): Promise<Catalog> {
    if (env.CATALOG_ENDPOINT && env.CATALOG_BOOK_ID) return readPublicCatalog(env.CATALOG_ENDPOINT, env.CATALOG_BOOK_ID, fetcher);
    const catalog = catalogSchema.parse(await upstream('/catalog'));
    if (catalog.origin !== 'live') throw new Error('真实模式不能使用样题');
    return catalog;
  }
  return { async fetch(request: Request): Promise<Response> {
    const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
    const origin = request.headers.get('Origin');
    if (origin && origin !== env.ALLOWED_ORIGIN) return Response.json({ error: { code: 'ORIGIN_REJECTED', message: '此页面无法准备题目。' } }, { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    try {
      const path = new URL(request.url).pathname;
      if (path === '/api/catalog' && request.method === 'GET') return json(await getCatalog());
      if (path !== '/api/batches') return json({ error: { code: 'NOT_FOUND', message: '页面不存在。' } }, 404);
      if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: '请从准备页面重新开始。' } }, 405);
      if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) {
        headers['Retry-After'] = '60';
        headers['Access-Control-Expose-Headers'] = 'Retry-After';
        return json({ error: { code: 'RATE_LIMITED', message: '准备次数过于频繁，请稍等一分钟后重试。' } }, 429);
      }
      const body = await request.text();
      if (body.length > 16000) return json({ error: { code: 'INVALID_REQUEST', message: '所选范围过大，请重新选择。' } }, 400);
      let raw: unknown;
      try { raw = JSON.parse(body); } catch { return json({ error: { code: 'INVALID_REQUEST', message: '设置有误，请重新选择。' } }, 400); }
      const parsed = batchRequestSchema.safeParse(raw);
      if (!parsed.success) return json({ error: { code: 'INVALID_REQUEST', message: '请选择课时、题型和 1～30 道题。' } }, 400);
      const input = parsed.data;
      const catalog = await getCatalog();
      if (catalog.id !== input.catalogId || input.lessonIds.some(id => !catalog.units.some(u => u.lessons.some(l => l.id === id)))) {
        return json({ error: { code: 'INVALID_RANGE', message: '所选课时已变化，请刷新后重选。' } }, 400);
      }
      const batch = validateBatch(await upstream('/batches', { method: 'POST', body: JSON.stringify(input) }), input, catalog);
      if (batch.origin !== 'live') throw new Error('真实模式不能使用样题');
      return json(batch);
    } catch (error) {
      if (error instanceof ServiceError) return json({ error: { code: error.code, message: error.message } }, error.status);
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) return json({ error: { code: 'UPSTREAM_TIMEOUT', message: '准备题目超时，请重试。' } }, 504);
      return json({ error: { code: 'INVALID_UPSTREAM_DATA', message: '本次题目未通过检查，请调整范围或重试。' } }, 502);
    }
  } };
}
