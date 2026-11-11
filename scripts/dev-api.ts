import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { createService } from '../worker/service.ts';

if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars');
const service = createService({ ...process.env, ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN ?? 'http://127.0.0.1:5173' });
createServer(async (incoming, outgoing) => {
  try {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of incoming) {
      length += chunk.length;
      if (length > 280000) { outgoing.writeHead(413); outgoing.end(); return; }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const method = incoming.method ?? 'GET';
    const request = new Request(`http://127.0.0.1:8787${incoming.url}`, { method, headers, body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks) });
    const response = await service.fetch(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500); outgoing.end('{"error":{"code":"LOCAL_ERROR","message":"本地服务启动失败，请重试。"}}'); }
}).listen(8787, '127.0.0.1', () => process.stdout.write('Quiz local API: http://127.0.0.1:8787\n'));
