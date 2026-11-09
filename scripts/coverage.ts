import { catalogSchema, validateBatch } from '../shared/contracts.ts';
import type { QuestionKind } from '../shared/types.ts';

export interface CoverageCheck {
  lessonId: string; lessonName: string; kind: QuestionKind;
  status: 'passed' | 'failed' | 'not-run'; count: number; code?: string;
}
export interface CoverageReport {
  checkedAt: string; api: string; publishable: boolean; catalogVerified: boolean;
  sampleCountPerKind: number; checks: CoverageCheck[]; error?: string;
}
interface Options {
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  onProgress?: (message: string) => void;
}

export async function checkCoverage(base: string, options: Options = {}): Promise<CoverageReport> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const count = 5;
  const report: CoverageReport = {
    checkedAt: new Date().toISOString(), api: base, publishable: false,
    catalogVerified: false, sampleCountPerKind: count, checks: [],
  };
  try {
    const response = await fetcher(base + '/api/catalog', { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    const catalog = catalogSchema.parse(await response.json());
    if (catalog.origin !== 'live' || catalog.edition !== '教科版（2024）' || catalog.grade !== 4 || catalog.term !== '上册'
      || catalog.units.map(u => u.name).join('|') !== '空气|呼吸与消化|声音'
      || catalog.units.some(u => u.lessons.length !== 8)) throw new Error('Catalog does not match the confirmed 2024 whole book.');
    report.catalogVerified = true;
    let blocked = '';
    for (const unit of catalog.units) for (const lesson of unit.lessons) for (const kind of ['single', 'boolean'] as const) {
      const check: CoverageCheck = { lessonId: lesson.id, lessonName: `${unit.name} / ${lesson.name}`, kind, status: blocked ? 'not-run' : 'failed', count: 0 };
      report.checks.push(check);
      if (blocked) { check.code = blocked; continue; }
      try {
        const request = { catalogId: catalog.id, lessonIds: [lesson.id], kinds: [kind], count };
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await fetcher(base + '/api/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(45000) });
          const raw = await result.json() as { error?: { code?: string } };
          if (result.status === 429 && raw.error?.code === 'RATE_LIMITED' && attempt < 2) {
            const seconds = Number(result.headers.get('Retry-After') ?? 60);
            const delay = Number.isFinite(seconds) ? Math.min(60, Math.max(1, seconds)) * 1000 : 60000;
            options.onProgress?.(`Rate limited; waiting ${delay / 1000}s before retrying ${check.lessonName}.`);
            await wait(delay);
            continue;
          }
          if (!result.ok) {
            check.code = raw.error?.code ?? `HTTP_${result.status}`;
            if (['SOURCE_NOT_CONFIGURED', 'ACCESS_REQUIRED', 'QUOTA_EXHAUSTED', 'SOURCE_TEXT_INCOMPLETE', 'SOURCE_ACCOUNT_LOCKED'].includes(check.code)) blocked = check.code;
            break;
          }
          const batch = validateBatch(raw, request, catalog);
          if (batch.origin !== 'live') throw new Error('PREVIEW_REJECTED');
          check.count = batch.questions.length;
          check.status = 'passed';
          break;
        }
      } catch (err) { check.code = err instanceof Error && err.name === 'TimeoutError' ? 'TIMEOUT' : 'INVALID_DATA'; }
    }
    report.publishable = report.checks.length === 48 && report.checks.every(c => c.status === 'passed');
  } catch (err) { report.error = err instanceof Error ? err.message : 'Coverage check failed'; }
  return report;
}
