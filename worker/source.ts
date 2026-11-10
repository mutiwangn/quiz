import { load } from 'cheerio';
import { questionSchema } from '../shared/contracts.ts';
import type { BatchRequest, ImageAsset, Question, QuestionBatch, QuestionKind } from '../shared/types.ts';
import { ServiceError } from './errors.ts';
import { SourceAccess } from './sourceAccess.ts';

interface SourceConfig { endpoint: string; cookie: string }
type Candidate = { question: Question } | { url: string; lesson: string; kind: QuestionKind };
const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};

async function parsePage(html: string, lessonId: string, kind: QuestionKind, base: string) {
  const $ = load(html);
  const allFields = $('fieldset.quesborder');
  const fields = allFields.first().find('.pt11').length ? allFields.slice(0, 1).toArray() : allFields.toArray();
  if (fields.some(field => /^0+(?:-0+)*$/.test($(field).attr('id') ?? ''))) {
    throw new ServiceError('ACCESS_REQUIRED', 503, '题目准备服务需要重新连接，请联系老师。');
  }
  const candidates: Candidate[] = [];
  const confused = /if\s*\(\s*['"]True['"]\s*==\s*['"]True['"]\s*\)\s*\{\s*\$\(\s*['"]#divConfuseTips['"]\s*\)\.show\s*\(/.test(html);
  for (const field of fields) {
    const node = $(field);
    if (node.attr('data-cate') !== (kind === 'single' ? '1' : '4')) continue;
    if (confused) {
      const href = node.parent().find('.fieldtip a').filter((_, a) => $(a).text().trim() === '解析').first().attr('href');
      if (href) {
        const url = new URL(href, base);
        const endpoint = new URL(base);
        if (url.origin === endpoint.origin && url.pathname.startsWith(endpoint.pathname.replace(/partialques$/, 'detail/'))) candidates.push({ url: url.href, lesson: lessonId, kind });
      }
      continue;
    }
    const stem = node.find('.pt1').first().clone();
    const removeHidden = (element: typeof stem) => {
      element.find('[hidden],[aria-hidden="true"]').remove();
      element.find('[style]').filter((_, child) => /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:\s*!important)?\s*(?:;|$)/i.test($(child).attr('style') ?? '')).remove();
    };
    removeHidden(stem);
    // Keep only the exercise, using the same visible-page extraction boundary as the download tool.
    stem.find('.qseq,.ques-source,.sanwser').remove();
    if (stem.find('table,script,math,.MathJye,sup,sub').length || node.find('.pt5,.pt6').find('table,math,.MathJye,sup,sub').length) continue;
    stem.find('.quizPutTag').replaceWith(kind === 'boolean' ? '' : '（　　）');
    stem.find('br').replaceWith('\n');
    const assets = (images: ReturnType<typeof node.find>): ImageAsset[] => images.toArray().map(img => {
      const url = new URL($(img).attr('src') ?? '', base);
      if (url.protocol !== 'https:') throw new Error('配图地址无效');
      return { url: url.href, alt: '题目配图' };
    });
    try {
      const images = assets(stem.find('img'));
      const prompt = stem.text().replace(/[ \t]+/g, ' ').trim();
      let choices: Question['choices'];
      let answerId: string;
      if (kind === 'boolean') {
        const answer = node.find('.sanwser').text().trim();
        if (!['√', '×', '正确', '错误'].includes(answer)) continue;
        choices = [{ id: 'true', text: '正确' }, { id: 'false', text: '错误' }];
        answerId = ['√', '正确'].includes(answer) ? 'true' : 'false';
      } else {
        const labels = node.find('.pt2 .selectoption label');
        if (labels.length < 2 || labels.length > 4 || labels.filter('.s').length !== 1) continue;
        choices = [];
        answerId = '';
        let unsupported = false;
        labels.each((i, label) => {
          const option = $(label).clone();
          removeHidden(option);
          const optionImages = assets(option.find('img'));
          if (optionImages.length > 1 || option.find('table,math,.MathJye,sup,sub').length) unsupported = true;
          const id = String.fromCharCode(97 + i);
          choices.push({ id, text: option.text().replace(/^\s*[A-D][．.、]\s*/, '').trim(), ...(optionImages[0] ? { image: optionImages[0] } : {}) });
          if (option.hasClass('s')) answerId = id;
        });
        if (unsupported) continue;
      }
      // Rendered IDs change between requests. Content identity makes exclusion and scoring stable.
      const canonical = JSON.stringify({ kind, prompt: prompt.replace(/\s/g, ''), images, choices });
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
      const id = 'q-' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const explanation = node.find('.pt5,.pt6').toArray().map(part => $(part).text().trim()).filter(Boolean).join('\n');
      const parsed = questionSchema.safeParse({ id, kind, lessonIds: [lessonId], prompt, images, choices, answerId, explanation });
      if (parsed.success) candidates.push({ question: parsed.data });
    } catch { /* An ambiguous or unsupported exercise is never guessed into the round. */ }
  }
  const pageCounts = $('select[onchange*="goPage"] option').toArray().map(option => Number($(option).attr('value'))).filter(Number.isFinite);
  const pageLimit = html.match(/maxPage\s*=\s*parseInt\(['"](\d+)['"]\)/);
  return { candidates, pages: Math.min(pageLimit ? Number(pageLimit[1]) : 100, Math.max(1, ...pageCounts)) };
}

export async function readLiveBatch(config: SourceConfig, request: BatchRequest, fetcher: typeof fetch, sourceAccess = new SourceAccess()): Promise<QuestionBatch> {
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== 'https:' || !config.cookie) throw new ServiceError('SOURCE_NOT_CONFIGURED', 503, '题目暂时未准备好，请稍后重试。');
  const signal = AbortSignal.any([AbortSignal.timeout(35000), sourceAccess.signal]);
  let reads = 0;
  let indexReads = 0;
  const maxIndexReads = Math.min(40, 48 - request.count);
  const fetchHTML = async (url: URL) => {
    sourceAccess.assertAvailable();
    if (++reads > 48) throw new ServiceError('INSUFFICIENT_QUESTIONS', 422, '本次未能准备足够的新题，请减少题数或扩大范围。');
    const response = await fetcher(url.href, { redirect: 'error', signal, headers: { Cookie: config.cookie, Referer: endpoint.origin } });
    if ([401, 403].includes(response.status)) throw new ServiceError('ACCESS_REQUIRED', 503, '题目准备服务需要重新连接，请联系老师。');
    if (response.status === 429) throw new ServiceError('QUOTA_EXHAUSTED', 503, '今日题目准备次数已用完，请稍后再来。');
    if (!response.ok) throw new ServiceError('UPSTREAM_UNAVAILABLE', 502, '题目准备失败，请重试。');
    const html = await response.text();
    if (html.length > 2000000) throw new Error('响应过大');
    if (/账号(?:已)?被锁定/.test(html)) sourceAccess.pause();
    sourceAccess.assertAvailable();
    return html;
  };
  const read = async (lesson: string, kind: QuestionKind, page: number) => {
    if (++indexReads > maxIndexReads) return { candidates: [], pages: 0 };
    const url = new URL(endpoint);
    url.searchParams.set('f', '0'); url.searchParams.set('q', lesson);
    url.searchParams.set('ct', kind === 'single' ? '1' : '4'); url.searchParams.set('pi', String(page));
    const html = await fetchHTML(url);
    return parsePage(html, lesson, kind, endpoint.href);
  };
  const excluded = new Set(request.excludeIds ?? []);
  const pools: Candidate[][] = [];
  const cursors: { lesson: string; kind: QuestionKind; pages: number[] }[] = [];
  const lessons = shuffle(request.lessonIds).slice(0, Math.min(request.count, Math.floor(Math.min(24, maxIndexReads) / (2 * request.kinds.length))));
  // Bounded batches avoid a large selected range exceeding free-runtime request limits.
  for (let offset = 0; offset < lessons.length; offset += 4) {
    await Promise.all(lessons.slice(offset, offset + 4).map(async lesson => {
      for (const kind of request.kinds) {
        const first = await read(lesson, kind, 1);
        const remaining = shuffle(Array.from({ length: Math.max(0, first.pages - 1) }, (_, n) => n + 2));
        const chosen = remaining.length ? await read(lesson, kind, remaining.shift()!) : first;
        pools.push([...shuffle(chosen.candidates), ...(chosen !== first ? shuffle(first.candidates) : [])]);
        cursors.push({ lesson, kind, pages: remaining });
      }
    }));
  }
  const questions: Question[] = [];
  const prompts = new Set<string>();
  const take = async () => {
    while (questions.length < request.count && pools.some(pool => pool.length)) {
      for (const pool of pools) {
        const entry = pool.shift();
        if (!entry) continue;
        let q: Question;
        if ('question' in entry) q = entry.question;
        else {
          const html = await fetchHTML(new URL(entry.url));
          const $ = load(html);
          const standard = $('fieldset.quesborder').first().find('.pt11').text().replace(/\s/g, '')
            .match(/^(?:【(?:参考)?答案】|(?:参考)?答案[:：])?([A-D]|√|×|正确|错误)[。．.]?$/i)?.[1].toUpperCase();
          if (!standard || (entry.kind === 'single' ? !/^[A-D]$/.test(standard) : !['√', '×', '正确', '错误'].includes(standard))) {
            throw new ServiceError('SOURCE_TEXT_INCOMPLETE', 503, '完整题目暂时无法查看，请联系老师检查剩余次数或稍后重试。');
          }
          const parsed = await parsePage(html, entry.lesson, entry.kind, endpoint.href);
          const full = parsed.candidates[0];
          if (!full || !('question' in full)) continue;
          q = full.question;
          const answer = entry.kind === 'single' ? String.fromCharCode(65 + q.choices.findIndex(c => c.id === q.answerId)) : q.answerId === 'true' ? '正确' : '错误';
          const expected = ['√', '正确'].includes(standard) ? '正确' : ['×', '错误'].includes(standard) ? '错误' : standard;
          if (answer !== expected) throw new ServiceError('SOURCE_TEXT_INCOMPLETE', 503, '题目与标准答案未能确认，请联系老师处理后再开始。');
        }
        if (excluded.has(q.id) || prompts.has(q.prompt.replace(/\s/g, ''))) continue;
        excluded.add(q.id); prompts.add(q.prompt.replace(/\s/g, '')); questions.push(q);
        if (questions.length === request.count) break;
      }
    }
  };
  await take();
  while (questions.length < request.count && cursors.some(cursor => cursor.pages.length) && indexReads < maxIndexReads) {
    const cursor = cursors.find(cursor => cursor.pages.length)!;
    const page = cursor.pages.shift()!;
    const result = await read(cursor.lesson, cursor.kind, page);
    if (page === 1) cursor.pages = shuffle(Array.from({ length: result.pages - 1 }, (_, n) => n + 2));
    pools.push(shuffle(result.candidates)); await take();
  }
  if (questions.length < request.count) throw new ServiceError('INSUFFICIENT_QUESTIONS', 422, '所选范围可用的新题不足，请扩大课时范围或减少题数。');
  return { id: crypto.randomUUID(), catalogId: request.catalogId, questions: shuffle(questions), preparedAt: new Date().toISOString(), origin: 'live' };
}
