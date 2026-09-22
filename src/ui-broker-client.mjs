import { readFile } from 'node:fs/promises';
import { createUISession } from './ui-loop.mjs';
import { serializeUIInput, brokerUnavailable } from './ui-contract.mjs';

export function brokerDecision(brokerFile) {
  return async (input, { signal }) => {
    let broker;
    try { broker = JSON.parse(await readFile(brokerFile, 'utf8')); }
    catch { throw brokerUnavailable('BROKER_NOT_READY'); }
    if (broker.protocol !== 2 || !Number.isInteger(broker.port) || broker.port < 1024 || broker.port > 65535 || !/^[a-f0-9]{64}$/.test(broker.token)) throw brokerUnavailable('BROKER_NOT_READY');
    const url = `http://127.0.0.1:${broker.port}`;
    const headers = { Authorization: 'Bearer ' + broker.token, 'Content-Type': 'application/json' };
    try {
      const health = await fetch(url + '/health', { redirect:'error', signal, headers });
      if (!health.ok || (await health.json()).status !== 'READY') throw Error();
    } catch { throw brokerUnavailable('BROKER_NOT_READY'); }
    const response = await fetch(url + '/judge', { method:'POST', redirect:'error', signal, headers, body:serializeUIInput(input) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 429 && result.inference_started === false) throw brokerUnavailable('BROKER_BUSY');
      throw Error('BROKER_JUDGMENT_FAILED');
    }
    return result;
  };
}

export function createBrokerSession(target, { brokerFile, ...options }) {
  if (typeof brokerFile !== 'string' || !brokerFile) throw Error('BROKER_FILE_REQUIRED');
  return createUISession(target, { ...options, configure: async () => {}, decide: brokerDecision(brokerFile) });
}
