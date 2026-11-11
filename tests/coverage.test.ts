import { expect, it } from 'vitest';
import { checkCoverage } from '../scripts/coverage';
import { previewCatalog } from '../src/preview/catalog';

it('整册覆盖检查在本服务限流后按等待窗口重试，不把限流当作课时缺题', async () => {
  const waits: number[] = [];
  let batchCalls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/catalog')) return Response.json({ ...previewCatalog, origin: 'live' });
    if (++batchCalls === 13) return Response.json({ error: { code: 'RATE_LIMITED' } }, { status: 429, headers: { 'Retry-After': '60' } });
    const request = JSON.parse(String(init?.body));
    return Response.json({ id: `b${batchCalls}`, catalogId: request.catalogId, origin: 'live', preparedAt: '2026-11-09T00:00:00Z', questions: Array.from({ length: 5 }, (_, i) => ({ id: `q${batchCalls}-${i}`, kind: request.kinds[0], lessonIds: request.lessonIds, prompt: `开发测试题 ${i}`, images: [], choices: [{ id: 'a', text: '正确' }, { id: 'b', text: '错误' }], answerId: 'a', explanation: '' })) });
  };
  const report = await checkCoverage('https://api.test', { fetcher, wait: async ms => { waits.push(ms); } });
  expect(report.publishable).toBe(true);
  expect(report.checks.filter(c => c.status === 'passed')).toHaveLength(48);
  expect(waits).toEqual([60000]);
  expect(batchCalls).toBe(49);
});
