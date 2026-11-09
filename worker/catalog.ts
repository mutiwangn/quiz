import { load } from 'cheerio/slim';
import { catalogSchema } from '../shared/contracts.ts';
import type { Catalog } from '../shared/types.ts';

export async function readPublicCatalog(endpoint: string, bookId: string, fetcher: typeof fetch): Promise<Catalog> {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('目录地址必须使用 HTTPS');
  const response = await fetcher(url.href, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ a: bookId, f: '0', cb: '_setQ', ncf: '2' }),
  });
  if (!response.ok) throw new Error('目录请求失败');
  const html = await response.text();
  if (html.length > 2000000) throw new Error('目录响应过大');
  const $ = load(html);
  const units = $('#JYE_POINT_TREE_HOLDER').children('li[pk][nm]').toArray().map(node => {
    const element = $(node);
    const lessons = element.children('ul').children('li[pk][nm]').toArray()
      .filter(child => /^\d+\s+/.test($(child).attr('nm') ?? ''))
      .map(child => ({ id: $(child).attr('pk')!, name: $(child).attr('nm')!.replace(/^\d+\s+/, '') }));
    return { id: element.attr('pk')!, name: element.attr('nm')!.replace(/^第[一二三四五六七八九十]+单元\s*/, ''), lessons };
  });
  if (units.some(u => !u.id.startsWith(bookId + '~') || u.lessons.some(l => !l.id.startsWith(bookId + '~')))) throw new Error('目录不属于指定教材');
  return catalogSchema.parse({ id: bookId, title: '小学科学', edition: '教科版（2024）', grade: 4, term: '上册', units, fetchedAt: new Date().toISOString(), origin: 'live' });
}
