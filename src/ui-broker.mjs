import http from 'node:http';
import { TextDecoder } from 'node:util';
import { UI_INPUT_CHARS, UI_INPUT_BYTES, UI_RECENT_ACTIONS } from './ui-contract.mjs';

// Only host requests cause inference; there is no busy flag or lifetime quota.
export function createUIBroker({ token, decide, idleMs = 600000, onIdle = () => {} }) {
  let active = 0, calls = 0, lastUsed = Date.now(), timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (active) arm(); else { server.close(); onIdle(); } }, idleMs);
    timer.unref();
  };
  const server = http.createServer(async (req, res) => {
    const finish = (status, value) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); } };
    if (req.headers.origin || req.headers.authorization !== 'Bearer ' + token) return finish(403, { error: 'UNAUTHORIZED' });
    if (req.url === '/health' && req.method === 'GET') return finish(200, { status: 'READY', protocol: 2, active, calls, idle_expires: lastUsed + idleMs });
    if (req.url !== '/judge' || req.method !== 'POST') return finish(403, { error: 'UNAUTHORIZED' });
    active++; lastUsed = Date.now(); arm();
    let inferenceStarted = false;
    const controller = new AbortController();
    const abort = () => controller.abort();
    res.once('close', abort);
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > UI_INPUT_BYTES) return finish(413, { error: 'INPUT_LIMIT', inference_started: false }); chunks.push(chunk); }
      const json = new TextDecoder('utf8', { fatal: true }).decode(Buffer.concat(chunks));
      if (json.length > UI_INPUT_CHARS) return finish(413, { error: 'INPUT_LIMIT', inference_started: false });
      let input;
      try { input = JSON.parse(json); } catch { return finish(400, { error: 'SCHEMA', inference_started: false }); }
      if (!input || typeof input.goal !== 'string' || !input.goal.trim() || input.goal.length > 1800 || typeof input.state !== 'string' || input.state.length > 16000 || !Array.isArray(input.actions) || input.actions.length > 19 || !Array.isArray(input.history) || input.history.length > UI_RECENT_ACTIONS || input.actions.some((a,i) => !a || a.id !== 'a'+i || !['click','scroll'].includes(a.op) || typeof a.name !== 'string' || a.name.length > 160)) return finish(400, { error: 'SCHEMA', inference_started: false });
      controller.signal.throwIfAborted();
      inferenceStarted = true; calls++;
      const result = await decide(input, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
      finish(200, result);
    } catch { finish(502, { error: 'JUDGMENT_FAILED', inference_started: inferenceStarted }); }
    finally { active--; lastUsed = Date.now(); arm(); res.removeListener('close', abort); }
  });
  server.requestTimeout = 8000; server.headersTimeout = 8000;
  server.once('close', () => clearTimeout(timer));
  arm();
  return server;
}
