import { describe, expect, it, vi } from 'vitest';
import { createService } from '../worker/service';
import worker from '../worker/index';
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
    ['可见选项重复', { ...question, choices: [{ id: 'a', text: '无色' }, { id: 'b', text: '无色' }] }],
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
  it('续题请求传递本局已有题号，拒收被排除的旧题', async () => {
    const request = () => new Request('https://api.test/api/batches', { method: 'POST', body: JSON.stringify({ catalogId: 'book', lessonIds: ['l1'], kinds: ['single'], count: 1, excludeIds: ['q1'] }) });
    let returned = { ...question, id: 'q2' };
    const fetcher: typeof fetch = async (input, init) => {
      if (String(input).endsWith('/catalog')) return Response.json(catalog);
      expect(JSON.parse(String(init?.body))).toMatchObject({ excludeIds: ['q1'] });
      return Response.json({ id: 'batch', catalogId: 'book', origin: 'live', preparedAt: '2026-11-09T00:00:00Z', questions: [returned] });
    };
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test' }, fetcher);
    expect((await service.fetch(request())).status).toBe(200);
    returned = question;
    expect((await service.fetch(request())).status).toBe(502);
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
  it('使用服务端登录状态按课时取真实网页，解析单选和判断并生成稳定题号', async () => {
    const requests: URL[] = [];
    let render = 0;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/catalog')) return Response.json(catalog);
      requests.push(url);
      expect(new Headers(init?.headers).get('Cookie')).toBe('session=test-session');
      expect(url.searchParams.get('q')).toBe('l1');
      const stem = url.searchParams.get('ct') === '4'
        ? '<fieldset class="quesborder" id="valid-render-id" data-cate="4"><div class="pt1"><span class="qseq">1．</span>空气存在于周围。<div class="quizPutTag"></div><div class="sanwser">√</div>（判断对错）</div></fieldset>'
        : `<fieldset class="quesborder" id="render-${++render}" data-cate="1"><div class="pt1"><span class="qseq">1．</span><a class="ques-source">（某地期末）</a>空气通常是什么颜色的？</div><div class="pt2"><table><tr><td class="selectoption"><label class=" s">A．无色</label></td><td class="selectoption"><label>B．蓝色</label></td></tr></table></div></fieldset>`;
      return new Response(stem);
    };
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/partialques', SOURCE_SESSION_COOKIE: 'session=test-session' }, fetcher);
    const request = (kind: string) => new Request('https://api.test/api/batches', { method: 'POST', body: JSON.stringify({ catalogId: 'book', lessonIds: ['l1'], kinds: [kind], count: 1 }) });
    const single = await service.fetch(request('single'));
    expect(single.status).toBe(200);
    const data = await single.json();
    expect(data).toMatchObject({ origin: 'live', questions: [{ prompt: '空气通常是什么颜色的？', answerId: 'a', lessonIds: ['l1'] }] });
    expect((await (await service.fetch(request('single'))).json()).questions[0].id).toBe(data.questions[0].id);
    const boolean = await service.fetch(request('boolean'));
    expect(await boolean.json()).toMatchObject({ questions: [{ kind: 'boolean', answerId: 'true', choices: [{ id: 'true', text: '正确' }, { id: 'false', text: '错误' }] }] });
    expect(requests.map(url => url.searchParams.get('ct'))).toEqual(['1', '1', '4']);
    expect(JSON.stringify(data)).not.toContain('test-session');
  });
  it('列表缺字时只使用可正常查看的完整解析页，不用残缺题干出题', async () => {
    const exercise = (prompt: string) => `<fieldset class="quesborder" id="valid-question" data-cate="1"><div class="pt1">${prompt}</div><div class="pt2"><table><tr><td class="selectoption"><label class="s">A．无色</label></td><td class="selectoption"><label>B．蓝色</label></td></tr></table></div></fieldset>`;
    const requests: string[] = [];
    const fetcher: typeof fetch = async input => {
      const url = new URL(String(input)); requests.push(url.pathname);
      if (url.pathname === '/catalog') return Response.json(catalog);
      if (url.pathname === '/ques/detail/valid-question') return new Response(exercise('空气通常是什么颜色的？').replace('</fieldset>', '<div class="pt11">【答案】A</div><div class="pt6">【解答】通常的空气无色透明。</div></fieldset>'));
      return new Response(`<li>${exercise('空气是颜色的？')}<div class="fieldtip"><a href="/ques/detail/valid-question">解析</a></div></li><script>if ('True' == 'True') { $("#divConfuseTips").show(); }</script>`);
    };
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/ques/partialques', SOURCE_SESSION_COOKIE: 'session=test' }, fetcher);
    const result = await service.fetch(batchRequest());
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ questions: [{ prompt: '空气通常是什么颜色的？', answerId: 'a', explanation: '【解答】通常的空气无色透明。' }] });
    expect(requests).toEqual(['/catalog', '/ques/partialques', '/ques/detail/valid-question']);
  });
  it('检测到账号锁定后停止后续取题请求，不反复访问源站', async () => {
    let sourceCalls = 0;
    const fetcher: typeof fetch = async input => {
      if (String(input).endsWith('/catalog')) return Response.json(catalog);
      sourceCalls++;
      return new Response('您的账号已被锁定，请联系客服。');
    };
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/ques/partialques', SOURCE_SESSION_COOKIE: 'session=test' }, fetcher);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await service.fetch(batchRequest());
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: 'SOURCE_ACCOUNT_LOCKED' } });
    }
    expect(sourceCalls).toBe(1);
  });
  it('同批并行任务收到锁定后，不再发起后续页或题型请求', async () => {
    let sourceCalls = 0;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const book = { ...catalog, units: [{ ...catalog.units[0], lessons: ['l1', 'l2'].map(id => ({ id, name: id })) }] };
    const fetcher: typeof fetch = async input => {
      if (String(input).endsWith('/catalog')) return Response.json(book);
      sourceCalls++;
      if (sourceCalls === 1) return new Response('您的账号已被锁定，请联系客服。');
      await pending;
      return new Response('<select onchange="goPage"><option value="1">1</option><option value="2">2</option></select>');
    };
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/ques/partialques', SOURCE_SESSION_COOKIE: 'session=test' }, fetcher);
    const response = await service.fetch(new Request('https://api.test/api/batches', { method: 'POST', body: JSON.stringify({ catalogId: 'book', lessonIds: ['l1', 'l2'], kinds: ['single'], count: 2 }) }));
    expect(response.status).toBe(503);
    release();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(sourceCalls).toBe(2);
  });
  it.each(['【答案】B', '免费查看次数已用完，请购买后查看'])('完整详情的标准答案受限或冲突时拒绝题包：%s', async answer => {
    const exercise = '<fieldset class="quesborder" id="valid-question" data-cate="1"><div class="pt1">空气通常是什么颜色的？</div><div class="pt2"><div class="selectoption"><label class="s">A．无色</label><label>B．蓝色</label></div></div>';
    const fetcher: typeof fetch = async input => {
      const url = new URL(String(input));
      if (url.pathname === '/catalog') return Response.json(catalog);
      if (url.pathname.startsWith('/ques/detail/')) return new Response(`${exercise}<div class="pt11">${answer}</div></fieldset>`);
      return new Response(`<li>${exercise}</fieldset><div class="fieldtip"><a href="/ques/detail/valid-question">解析</a></div></li><script>if ('True' == 'True') { $("#divConfuseTips").show(); }</script>`);
    };
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/ques/partialques', SOURCE_SESSION_COOKIE: 'session=test' }, fetcher);
    const response = await service.fetch(batchRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'SOURCE_TEXT_INCOMPLETE' } });
  });
  it.each(['2<sup>3</sup>cm<sup>3</sup>', 'O<sub>2</sub>'])('无法可靠表达的上下标不压平成错误题干：%s', async notation => {
    const fetcher: typeof fetch = async input => String(input).endsWith('/catalog') ? Response.json(catalog) : new Response(`<fieldset class="quesborder" id="valid-question" data-cate="1"><div class="pt1">观察${notation}的实验结果。</div><div class="pt2"><div class="selectoption"><label class="s">A．结果一</label><label>B．结果二</label></div></div></fieldset>`);
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/ques/partialques', SOURCE_SESSION_COOKIE: 'session=test' }, fetcher);
    expect((await service.fetch(batchRequest())).status).toBe(422);
  });
  it('不把明确隐藏的干扰文字和选项混入可见题目', async () => {
    const fetcher: typeof fetch = async input => String(input).endsWith('/catalog') ? Response.json(catalog) : new Response('<fieldset class="quesborder" id="valid-question" data-cate="1"><div class="pt1">空气<span style="display: none">秘密干扰字</span>通常是什么颜色的？<span hidden>隐藏文字</span></div><div class="pt2"><div class="selectoption"><label class="s">A．无色<span style="visibility:hidden">干扰文字</span></label><label>B．蓝色</label></div></div></fieldset>');
    const service = createService({ GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/ques/partialques', SOURCE_SESSION_COOKIE: 'session=test' }, fetcher);
    const response = await service.fetch(batchRequest());
    expect(await response.json()).toMatchObject({ questions: [{ prompt: '空气通常是什么颜色的？', choices: [{ text: '无色' }, { text: '蓝色' }] }] });
  });
  it('真实 Worker 入口在后续请求中保留锁定状态', async () => {
    let sourceCalls = 0;
    const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input).endsWith('/catalog')) return Response.json(catalog);
      sourceCalls++;
      return new Response('您的账号已被锁定，请联系客服。');
    });
    try {
      const env = { GATEWAY_URL: 'https://gateway.test', GATEWAY_TOKEN: 'test', SOURCE_SEARCH_ENDPOINT: 'https://source.test/ques/partialques', SOURCE_SESSION_COOKIE: 'session=test' };
      for (let i = 0; i < 2; i++) expect((await worker.fetch(batchRequest(), env)).status).toBe(503);
      expect(sourceCalls).toBe(1);
    } finally { mock.mockRestore(); }
  });
});
