import { readFile } from 'node:fs/promises';
import { createUISession } from './ui-loop.mjs';

export function createBrokerSession(target, { brokerFile, ...options }) {
  if (typeof brokerFile !== 'string' || !brokerFile) throw Error('BROKER_FILE_REQUIRED');
  return createUISession(target, { ...options, configure: async () => {}, decide: async (input, { signal }) => {
    const broker = JSON.parse(await readFile(brokerFile, 'utf8'));
    if (!Number.isInteger(broker.port) || broker.port < 1024 || broker.port > 65535 || !/^[a-f0-9]{64}$/.test(broker.token) || Date.now() >= broker.expires) throw Error('BROKER_NOT_READY');
    const response = await fetch(`http://127.0.0.1:${broker.port}/judge`, { method:'POST',redirect:'error',signal,headers:{Authorization:'Bearer '+broker.token,'Content-Type':'application/json'},body:JSON.stringify(input) });
    if (!response.ok) throw Error('BROKER_JUDGMENT_FAILED');
    return response.json();
  } });
}
