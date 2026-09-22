import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { prepareWork } from '../src/work-preparation.mjs';
import { toolResponse } from '../src/result-view.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jev-work-prep-'));
  await writeFile(path.join(root, 'issue.txt'), 'A refused queue command changed state.');
  await writeFile(path.join(root, 'constraint.txt'), 'Host is held by another author.');
  return {
    input: { task_id: 'queue-repair', task: 'Prepare the queue repair', root,
      constraints: ['Only edit the queue module'], acceptance: ['Refused commands leave state unchanged'],
      sources: [{ id: 'issue', path: 'issue.txt' }, { id: 'constraint', path: 'constraint.txt' }],
    },
    options: { allowedRoots: [root], receiptRoot: path.join(root, 'receipts') },
  };
}
function reply(request, choices = {}) {
  return { model: 'jev-1.13.0', action: 'auto', truncated: false, coverage: { complete: true },
    usage: { input_tokens: 1, output_tokens: 1 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([key, question]) => {
      const choice = choices[key] ?? Object.keys(question.criteria)[0];
      return [key, { type: 'choice', choice, confidence: 1,
        probabilities: Object.fromEntries(Object.keys(question.criteria).map(value => [value, value === choice ? 1 : 0])),
      }];
    })),
  };
}
const labels = [{ id: 'repair', description: 'Queue defects' }, { id: 'coordination', description: 'Author ownership' }];

test('main and subagent preparation preserve all sources and requirements with zero inference when no judgments exist', async () => {
  const f = await fixture();
  for (const executor of ['main', 'subagent']) {
    const packet = await prepareWork({ ...f.input, executor }, { ...f.options, evaluate: () => assert.fail('No judgment needed') });
    assert.equal(packet.status, 'WORK_PREPARED'); assert.equal(packet.host_review_required, true);
    assert.equal(packet.executor, executor); assert.equal(packet.metrics.workflow_inference_calls, 0);
    assert.deepEqual(packet.constraints, f.input.constraints); assert.deepEqual(packet.acceptance, f.input.acceptance);
    assert.deepEqual(packet.unassigned, ['issue', 'constraint']); assert.equal(packet.evidence.length, 2);
    for (const source of packet.evidence) assert.equal(source.text, await readFile(path.join(f.input.root, source.path), 'utf8'));
    assert.deepEqual(JSON.parse(await readFile(packet.packet_path)), packet);
    const receipt = JSON.parse(await readFile(packet.receipt_path));
    assert.deepEqual(receipt.request.state.work_context, { task_id: f.input.task_id, executor, constraints: f.input.constraints, acceptance: f.input.acceptance });
  }
});

test('one batch creates advisory groups and retains unknown material and unsupported checks in the text handoff', async () => {
  const f = await fixture(); let calls = 0;
  const packet = await prepareWork({ ...f.input, executor: 'subagent', labels,
    checks: [{ id: 'ran', claim: 'The queue test passed', evidence_ids: ['issue'] }],
  }, { ...f.options, evaluate: async request => {
    calls++;
    assert.deepEqual(Object.keys(request.questions), ['label_issue', 'label_constraint', 'check_ran']);
    assert.equal(request.state.work_context.constraints[0], f.input.constraints[0]);
    return reply(request, { label_issue: 'repair', label_constraint: 'unknown', check_ran: 'unsupported' });
  } });
  assert.equal(calls, 1); assert.equal(packet.status, 'REVIEW_REQUIRED');
  assert.deepEqual(packet.groups[0].evidence_ids, ['issue']); assert.deepEqual(packet.unassigned, ['constraint']);
  assert.deepEqual(packet.review_items.map(item => item.kind), ['check', 'unassigned']);
  assert.equal(packet.evidence.length, 2);
  const view = JSON.parse(toolResponse(packet).content[0].text);
  assert.equal(view.format, 'jev-work-text-v1'); assert.equal(view.host_review_required, true);
  for (const field of ['task_id', 'task', 'executor', 'constraints', 'acceptance', 'groups', 'review_items', 'packet_path']) assert.deepEqual(view[field], packet[field]);
  assert.deepEqual(view.evidence.map(item => item.text), packet.evidence.map(item => item.text));
});

test('source mutation during preparation remains stale, never work prepared', async () => {
  const f = await fixture();
  const packet = await prepareWork({ ...f.input, labels }, { ...f.options, evaluate: async request => {
    await writeFile(path.join(f.input.root, 'issue.txt'), 'New issue'); return reply(request);
  } });
  assert.equal(packet.status, 'STALE_SOURCE'); assert.deepEqual(packet.stale_sources, ['issue']);
  assert(packet.review_items.some(item => item.kind === 'stale_source'));
});

test('context changes bind a new receipt; sensitive or oversized context and missing evidence reject before inference', async () => {
  const f = await fixture(); const never = { ...f.options, evaluate: () => assert.fail('Must reject or collect locally') };
  const first = await prepareWork(f.input, never);
  const second = await prepareWork({ ...f.input, constraints: ['Read-only investigation'] }, never);
  const hashes = await Promise.all([first, second].map(async packet => JSON.parse(await readFile(packet.receipt_path)).input_sha256));
  assert.notEqual(hashes[0], hashes[1]);
  await assert.rejects(prepareWork({ ...f.input, constraints: ['Authorization: Bearer exampleSensitiveToken123456789'] }, never), /SENSITIVE_INPUT/);
  await assert.rejects(prepareWork({ ...f.input, checks: [{ id: 'x', claim: 'Done', evidence_ids: ['missing'] }] }, never), /UNKNOWN_EVIDENCE_ID/);
  await writeFile(path.join(f.input.root, 'issue.txt'), 'x'.repeat(16000));
  await assert.rejects(prepareWork({ ...f.input, constraints: Array(10).fill('c'.repeat(500)), acceptance: Array(10).fill('a'.repeat(500)) }, never), /INPUT_CHARACTER_LIMIT/);
});

test('provider failure and incomplete coverage cannot produce a successful work packet', async () => {
  const f = await fixture();
  await assert.rejects(prepareWork({ ...f.input, labels }, { ...f.options, evaluate: async () => { throw Error('offline'); } }), /offline/);
  await assert.rejects(prepareWork({ ...f.input, labels }, { ...f.options, evaluate: async request => ({ ...reply(request), coverage: { complete: false } }) }), /INCOMPLETE_OR_INVALID_RESPONSE/);
});

test('different tasks sharing sources get independent inference, context, receipts and groups', async () => {
  const f = await fixture(); const seen = [];
  const options = { ...f.options, evaluate: async request => {
    seen.push(request.state.work_context.task_id);
    return reply(request, { label_issue: request.state.work_context.task_id === 'repair-task' ? 'repair' : 'coordination' });
  } };
  const a = await prepareWork({ ...f.input, task_id: 'repair-task', executor: 'subagent', labels }, options);
  const b = await prepareWork({ ...f.input, task_id: 'ownership-task', task: 'Investigate author coordination', executor: 'subagent', labels, constraints: ['Read only'], acceptance: ['Identify current author'] }, options);
  assert.deepEqual(seen, ['repair-task', 'ownership-task']);
  assert.notEqual(a.run_id, b.run_id); assert.notEqual(a.packet_path, b.packet_path);
  assert.deepEqual(a.groups[0].evidence_ids, ['issue', 'constraint']);
  assert.deepEqual(b.groups[1].evidence_ids, ['issue']);
  assert.deepEqual(b.constraints, ['Read only']); assert.deepEqual(b.acceptance, ['Identify current author']);
  assert.equal(a.evidence[0].file_sha256, b.evidence[0].file_sha256);
  const missing = { ...f.input }; delete missing.task_id;
  await assert.rejects(prepareWork(missing, options)); assert.equal(seen.length, 2);
});
