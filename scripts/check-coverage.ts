import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogSchema, validateBatch } from '../shared/contracts.ts';
import type { QuestionKind } from '../shared/types.ts';

const base = (process.env.QUIZ_API_URL ?? '').replace(/\/$/, '');
if (!base || !/^https?:\/\//.test(base)) { process.stderr.write('Set QUIZ_API_URL to the Quiz API base URL.\n'); process.exit(1); }
const count = 5;
const output = resolve(process.env.QUIZ_COVERAGE_REPORT ?? 'coverage/live-coverage.json');
const report: { checkedAt: string; api: string; publishable: boolean; catalogVerified: boolean; sampleCountPerKind: number; checks: { lessonId: string; lessonName: string; kind: QuestionKind; status: 'passed' | 'failed' | 'not-run'; count: number; code?: string }[]; error?: string } = {
  checkedAt: new Date().toISOString(), api: base, publishable: false, catalogVerified: false, sampleCountPerKind: count, checks: [],
};
try {
  const response = await fetch(base + '/api/catalog', { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const catalog = catalogSchema.parse(await response.json());
  if (catalog.origin !== 'live' || catalog.edition !== '教科版（2024）' || catalog.grade !== 4 || catalog.term !== '上册'
    || catalog.units.map(u => u.name).join('|') !== '空气|呼吸与消化|声音'
    || catalog.units.some(u => u.lessons.length !== 8)) throw new Error('Catalog does not match the confirmed 2024 whole book.');
  report.catalogVerified = true;
  let blocked = '';
  for (const unit of catalog.units) for (const lesson of unit.lessons) for (const kind of ['single', 'boolean'] as const) {
    const check: (typeof report.checks)[number] = { lessonId: lesson.id, lessonName: `${unit.name} / ${lesson.name}`, kind, status: blocked ? 'not-run' : 'failed', count: 0 };
    report.checks.push(check);
    if (blocked) { check.code = blocked; continue; }
    try {
      const request = { catalogId: catalog.id, lessonIds: [lesson.id], kinds: [kind], count };
      const result = await fetch(base + '/api/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(45000) });
      const raw = await result.json() as { error?: { code?: string } };
      if (!result.ok) {
        check.code = raw.error?.code ?? `HTTP_${result.status}`;
        if (['SOURCE_NOT_CONFIGURED', 'ACCESS_REQUIRED', 'QUOTA_EXHAUSTED'].includes(check.code)) blocked = check.code;
        continue;
      }
      const batch = validateBatch(raw, request, catalog);
      if (batch.origin !== 'live') throw new Error('PREVIEW_REJECTED');
      check.count = batch.questions.length;
      check.status = 'passed';
    } catch (err) { check.code = err instanceof Error && err.name === 'TimeoutError' ? 'TIMEOUT' : 'INVALID_DATA'; }
  }
  report.publishable = report.checks.length === 48 && report.checks.every(c => c.status === 'passed');
} catch (err) { report.error = err instanceof Error ? err.message : 'Coverage check failed'; }
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(`${report.publishable ? 'PASS' : 'BLOCKED'}: ${report.checks.filter(c => c.status === 'passed').length}/48 checks; ${output}\n`);
process.exitCode = report.publishable ? 0 : 1;
