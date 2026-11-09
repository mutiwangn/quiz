import { describe, expect, it } from 'vitest';
import { createService } from '../worker/service';
import type { Catalog, Question } from '../shared/types';

const catalog: Catalog = { id: 'book', title: '小学科学', edition: '教科版（2024）', grade: 4, term: '上册', origin: 'live', fetchedAt: '2026-11-09T00:00:00.000Z', units: [{ id: 'u1', name: '空气', lessons: [{ id: 'l1', name: '感受空气' }] }] };
const question: Question = { id: 'q1', kind: 'single', lessonIds: ['l1'], prompt: '空气通常是什么颜色的？', images: [], choices: [{ id: 'a', text: '无色' }, { id: 'b', text: '蓝色' }], answerId: 'a', explanation: '通常的空气无色透明。' };
const batchRequest = () => new Request('https://api.test/api/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalogId: 'book', lessonIds: ['l1'], kinds: ['single'], count: 1 }) });

describe('取题 HTTP 服务', () => {
  it('未配置真实访问时明确失败，不返回开发样题', async () => {
    const service = createService({});
    const response = await service.fetch(new Request('https://api.test/api/batches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId: 'book', lessonIds: ['l1'], kinds: ['single'], count: 5 }),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'SOURCE_NOT_CONFIGURED' } });
  });
  it('仅返回与目录、课时、题型及题数匹配的真实题包', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async input => {
      calls.push(String(input));
      return Response.json(String(input).endsWith('/catalog') ? catalog : { id: 'batch', catalogId: 'book', origin: 'live', preparedAt: '2026-11-09T00:00:00Z', questions: [question] });
    };
    const response = await createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test-token' }, fetcher).fetch(batchRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ origin: 'live', questions: [{ answerId: 'a' }] });
    expect(calls).toEqual(['https://gateway.test/catalog', 'https://gateway.test/batches']);
  });
  it('可以匿名刷新真实课时目录，排除小结与更深层知识点', async () => {
    const fetcher: typeof fetch = async () => new Response('<ul id="JYE_POINT_TREE_HOLDER"><li pk="book~u1~" nm="第一单元 空气"><ul><li pk="book~l1~" nm="1 感受空气"><ul><li pk="concept" nm="空气"></li></ul></li><li pk="book~summary~" nm="单元小结"></li></ul></li></ul>');
    const response = await createService({ CATALOG_ENDPOINT: 'https://catalog.test/tree', CATALOG_BOOK_ID: 'book' }, fetcher).fetch(new Request('https://api.test/api/catalog'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ origin: 'live', edition: '教科版（2024）', units: [{ name: '空气', lessons: [{ id: 'book~l1~', name: '感受空气' }] }] });
  });
  it.each([
    ['无效预览题号', { ...question, id: '00000000-0000-0000-0000-000000000000' }],
    ['答案缺失', { ...question, answerId: 'c' }],
    ['课时不符', { ...question, lessonIds: ['other'] }],
    ['题型不符', { ...question, kind: 'boolean' }],
  ])('拒收%s，响应不泄露凭据', async (_name, badQuestion) => {
    const fetcher: typeof fetch = async input => Response.json(String(input).endsWith('/catalog') ? catalog : { id: 'batch', catalogId: 'book', origin: 'live', preparedAt: '2026-11-09T00:00:00Z', questions: [badQuestion] });
    const response = await createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'secret-test' }, fetcher).fetch(batchRequest());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('secret-test');
  });
  it('拒绝重复题目与数量不足', async () => {
    const request = new Request('https://api.test/api/batches', { method: 'POST', body: JSON.stringify({ catalogId: 'book', lessonIds: ['l1'], kinds: ['single'], count: 2 }) });
    const fetcher: typeof fetch = async input => Response.json(String(input).endsWith('/catalog') ? catalog : { id: 'batch', catalogId: 'book', origin: 'live', preparedAt: '2026-11-09T00:00:00Z', questions: [question, question] });
    expect((await createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test' }, fetcher).fetch(request)).status).toBe(502);
  });
  it('超时返回可重试错误，不返回原始异常', async () => {
    const fetcher: typeof fetch = async () => { throw new DOMException('private upstream details', 'TimeoutError'); };
    const response = await createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test' }, fetcher).fetch(batchRequest());
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: 'UPSTREAM_TIMEOUT' } });
  });
  it('在访问外部接口前拒绝无效题数与不允许的网页来源', async () => {
    let calls = 0;
    const service = createService({}, async () => { calls++; return Response.json({}); });
    const invalid = new Request('https://api.test/api/batches', { method: 'POST', body: JSON.stringify({ catalogId: 'book', lessonIds: ['l1'], kinds: ['single'], count: 0 }) });
    expect((await service.fetch(invalid)).status).toBe(400);
    const otherOrigin = new Request(batchRequest(), { headers: { Origin: 'https://other.test' } });
    expect((await service.fetch(otherOrigin)).status).toBe(403);
    expect(calls).toBe(0);
  });
  it('取题频率超限时不消耗外部接口额度', async () => {
    let calls = 0;
    const service = createService({ RATE_LIMITER: { limit: async () => ({ success: false }) } }, async () => { calls++; return Response.json({}); });
    const response = await service.fetch(batchRequest());
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(calls).toBe(0);
  });
});
