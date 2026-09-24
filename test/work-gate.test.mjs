import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { beginWork, reviewWork, closeWork, exceptionWork, workGate } from '../src/work-gate.mjs';
import { prepareWork } from '../src/work-preparation.mjs';
const denied = r => r?.hookSpecificOutput?.permissionDecision === 'deny';
async function fixture() {
  const home = await mkdtemp(path.join(os.tmpdir(), 'jev-work-gate-'));
  await writeFile(path.join(home, 'issue.txt'), 'Rejected queue commands must leave state unchanged. Current code mutates state before validation.');
  const work = { task_id: 'repair-queue', task: 'Fix mutation before validation', root: home,
    constraints: ['Only edit queue'], acceptance: ['Rejected commands leave state unchanged'],
    sources: [{ id: 'issue', path: 'issue.txt' }],
    checks: [{ id: 'ordering', claim: 'Validation must precede state mutation.', evidence_ids: ['issue'] }],
  };
  const event = { hook_event_name: 'PreToolUse', session_id: 's1', cwd: home, tool_name: 'apply_patch', tool_input: { command: 'some patch' } };
  let calls = 0;
  const options = { home, configure: async () => ({ roots: [home] }), prepare: (input, opts) => prepareWork(input, { ...opts, evaluate: async request => {
    calls++;
    return { model: 'jev-1.13.0', coverage: { complete: true }, action: 'auto', truncated: false,
      answers: Object.fromEntries(Object.entries(request.questions).map(([id, q]) => [id, { type: 'choice', choice: Object.keys(q.criteria)[0], confidence: 1, probabilities: Object.fromEntries(Object.keys(q.criteria).map((k, i) => [k, i === 0 ? 1 : 0])) }])), usage: { input_tokens: 5, output_tokens: 1 } };
  } }) };
  const begin = (patch = {}) => beginWork({ session_id: 's1', work: { ...work, ...patch } }, options);
  const review = (actions = [event], task_id = work.task_id) => reviewWork({ session_id: 's1', task_id, disposition: 'adopt', explanation: 'Checked original evidence and kept all constraints.', actions: actions.map(({tool_name,tool_input}) => ({tool_name,tool_input})) }, options);
  return { home, work, event, options, begin, review, calls: () => calls };
}
test('execution requires actual judgment, host review and a one-shot exact action', async () => {
  const f = await fixture(); assert(denied(await workGate(f.event, f.options)));
  const packet = await f.begin(); assert.equal(packet.judgment_state, 'JEV_JUDGED');
  assert(denied(await workGate(f.event, f.options)));
  await f.review(); assert(!denied(await workGate(f.event, f.options)));
  assert(denied(await workGate(f.event, f.options))); assert.equal(f.calls(), 1);
});
test('spawn and follow-up assignments cannot borrow another task action even for the same file', async () => {
  const f = await fixture(); await f.begin();
  const first = { ...f.event, tool_name: 'spawn_agent', tool_input: { message: 'Fix queue.js' } };
  await f.review([first]);
  const next = { ...first, tool_name: 'followup_task', tool_input: { message: 'Audit queue.js persistence' } };
  await assert.rejects(f.review([next]), /DIFFERENT_ASSIGNMENT_REQUIRES_NEW_TASK/);
  assert(denied(await workGate(next, f.options))); assert(!denied(await workGate(first, f.options)));
  await f.begin({ task_id: 'audit-persistence', task: 'Audit persistence in the same file' });
  await f.review([next], 'audit-persistence'); assert(!denied(await workGate(next, f.options))); assert.equal(f.calls(), 2);
});
test('long prompts and code blocks invalidate old task; continue retains only an open task', async () => {
  const f = await fixture(); await f.begin(); await f.review();
  await workGate({ ...f.event, hook_event_name: 'UserPromptSubmit', prompt: '继续' }, f.options);
  assert(!denied(await workGate(f.event, f.options)));
  await f.review(); await workGate({ ...f.event, hook_event_name: 'UserPromptSubmit', prompt: 'New task\n' + 'x'.repeat(5000) + '\n```js\ncode\n```' }, f.options);
  assert(denied(await workGate(f.event, f.options)));
  await f.begin({ task_id: 'next-task' }); await closeWork('s1', 'next-task', f.options);
  await workGate({ ...f.event, hook_event_name: 'UserPromptSubmit', prompt: '继续' }, f.options);
  assert(denied(await workGate(f.event, f.options)));
});
test('zero inference, stale evidence and changed receipts never grant execution', async () => {
  const f = await fixture(); await assert.rejects(f.begin({ checks: [] }), /JUDGMENTS_REQUIRED/);
  const packet = await f.begin(); await f.review();
  await writeFile(path.join(f.home, 'issue.txt'), 'changed'); assert(denied(await workGate(f.event, f.options)));
  const g = await fixture(); const p = await g.begin(); await g.review();
  await writeFile(p.receipt_path, '{}'); assert(denied(await workGate(g.event, g.options)));
  assert.equal(packet.metrics.workflow_inference_calls, 1);
});
test('failure cannot reroll unchanged task or masquerade as judgment; explicit degradation is separate', async () => {
  const f = await fixture(); let attempts = 0;
  const options = { ...f.options, prepare: async () => { attempts++; throw Error('offline'); } };
  const input = { session_id: 's1', work: f.work };
  await assert.rejects(beginWork(input, options), /offline/);
  await assert.rejects(beginWork(input, options), /TASK_ID_ALREADY_ATTEMPTED/);
  assert(denied(await workGate(f.event, options))); assert.equal(attempts, 1);
  const result = await exceptionWork({ session_id: 's1', task_id: f.work.task_id, kind: 'service_unavailable', explanation: 'Provider was unavailable; continue locally with independent source checks.', actions: [{ tool_name: f.event.tool_name, tool_input: f.event.tool_input }] }, options);
  assert.equal(result.status, 'DEGRADED'); assert.equal(result.actual_judgment, false);
  const response = await workGate(f.event, options); assert(!denied(response)); assert.match(response.hookSpecificOutput.additionalContext, /NOT a successful/);
});
test('collection is allowed but shell composition and unrelated preparation writes are blocked', async () => {
  const f = await fixture();
  for (const command of ['rg -n "queue" src', 'Get-Content "issue.txt"']) assert.equal(await workGate({ ...f.event, tool_name: 'Bash', tool_input: { command } }, f.options), null);
  for (const command of ['Get-Content issue.txt; node mutate.mjs', 'rg --pre=evil issue', 'Get-Content $(evil)', 'git diff --ext-diff']) assert(denied(await workGate({ ...f.event, tool_name: 'Bash', tool_input: { command } }, f.options)));
  const input = path.join(f.home, 'auto', 'inbox', 'one.json');
  const command = `*** Begin Patch\n*** Add File: ${input}\n+{}\n*** End Patch`;
  assert.equal(await workGate({ ...f.event, tool_input: { command } }, f.options), null);
  assert(denied(await workGate({ ...f.event, tool_input: { command: command.replace('one.json', '../source.js') } }, f.options)));
});
