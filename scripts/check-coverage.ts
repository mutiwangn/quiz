import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkCoverage } from './coverage.ts';

const base = (process.env.QUIZ_API_URL ?? '').replace(/\/$/, '');
if (!base || !/^https?:\/\//.test(base)) { process.stderr.write('Set QUIZ_API_URL to the Quiz API base URL.\n'); process.exit(1); }
const output = resolve(process.env.QUIZ_COVERAGE_REPORT ?? 'coverage/live-coverage.json');
const report = await checkCoverage(base, { onProgress: message => process.stdout.write(message + '\n') });
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(`${report.publishable ? 'PASS' : 'BLOCKED'}: ${report.checks.filter(c => c.status === 'passed').length}/48 checks; ${output}\n`);
process.exitCode = report.publishable ? 0 : 1;
