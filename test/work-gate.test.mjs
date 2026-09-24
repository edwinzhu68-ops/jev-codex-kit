import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rmdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { beginWork, reviewWork, closeWork, exceptionWork, workGate, authorizedWorkScope } from '../src/work-gate.mjs';
import { prepareWork } from '../src/work-preparation.mjs';
import { autoStatus } from '../src/auto-status.mjs';
import { hookCommand } from '../src/auto-install.mjs';
import { hashText } from '../src/skill-router.mjs';
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
test('reviewed task scope permits adaptive main-host steps but not a new task or unbound delegation', async () => {
  const f = await fixture();
  await f.begin();
  await reviewWork({ session_id: 's1', task_id: f.work.task_id, disposition: 'adopt',
    explanation: 'Keep the source requirements and execute this one queue repair.', execution_scope: 'task' }, f.options);
  assert(!denied(await workGate(f.event, f.options)));
  await writeFile(path.join(f.home, 'issue.txt'), 'Queue repair in progress.');
  const followup = { ...f.event, tool_name: 'Bash', tool_input: { command: 'npm test' } };
  assert(!denied(await workGate(followup, f.options)));
  const assignment = { ...f.event, tool_name: 'spawn_agent', tool_input: { message: 'Fix the queue independently.' } };
  assert(denied(await workGate(assignment, f.options)));
  await workGate({ ...f.event, hook_event_name: 'UserPromptSubmit', prompt: 'Start a different task' }, f.options);
  assert(denied(await workGate(followup, f.options)));
  assert.equal(f.calls(), 1);
});
test('task scope checks sources before first execution and still checks receipt bytes thereafter', async () => {
  const f = await fixture();
  const packet = await f.begin();
  await reviewWork({ session_id: 's1', task_id: f.work.task_id, disposition: 'adopt',
    explanation: 'Use one reviewed packet for queue repair.', execution_scope: 'task' }, f.options);
  await writeFile(path.join(f.home, 'issue.txt'), 'Changed before work started.');
  assert(denied(await workGate(f.event, f.options)));
  const g = await fixture();
  const current = await g.begin();
  await reviewWork({ session_id: 's1', task_id: g.work.task_id, disposition: 'adopt',
    explanation: 'Use one reviewed packet for queue repair.', execution_scope: 'task' }, g.options);
  assert(!denied(await workGate(g.event, g.options)));
  await writeFile(current.receipt_path, '{}');
  assert(denied(await workGate(g.event, g.options)));
  assert.equal(packet.metrics.workflow_inference_calls, 1);
});
test('task-scoped main actions do not relax exact fresh delegation bindings', async () => {
  const f = await fixture();
  await f.begin();
  const assignment = { ...f.event, tool_name: 'spawn_agent', tool_input: { message: 'Fix queue within this prepared task.' } };
  await reviewWork({ session_id: 's1', task_id: f.work.task_id, disposition: 'adopt',
    explanation: 'Keep the queue task and one exact executor handoff.', execution_scope: 'task',
    actions: [{ tool_name: assignment.tool_name, tool_input: assignment.tool_input }] }, f.options);
  assert(!denied(await workGate(f.event, f.options)));
  assert(!denied(await workGate(assignment, f.options)));
  assert(denied(await workGate(assignment, f.options)));
  const different = { ...assignment, tool_input: { message: 'Audit queue persistence instead.' } };
  assert(denied(await workGate(different, f.options)));
  const g = await fixture();
  await g.begin();
  await reviewWork({ session_id: 's1', task_id: g.work.task_id, disposition: 'adopt',
    explanation: 'Keep the queue task and one exact executor handoff.', execution_scope: 'task',
    actions: [{ tool_name: assignment.tool_name, tool_input: assignment.tool_input }] }, g.options);
  assert(!denied(await workGate(g.event, g.options)));
  await writeFile(path.join(g.home, 'issue.txt'), 'Host edited the source before delegation.');
  assert(denied(await workGate(assignment, g.options)));
});
test('parallel native checks wait briefly for the same-session state lock', async () => {
  const f = await fixture();
  await f.begin();
  await reviewWork({ session_id: 's1', task_id: f.work.task_id, disposition: 'adopt',
    explanation: 'Review the queue repair before concurrent tool calls.', execution_scope: 'task' }, f.options);
  const lock = path.join(f.home, 'auto', 'work', hashText('s1') + '.json.lock');
  await mkdir(lock);
  const unlock = (async () => { await new Promise(resolve => setTimeout(resolve, 90)); await rmdir(lock); })();
  const result = await workGate(f.event, f.options);
  await unlock;
  assert(!denied(result));
});
test('passive waits and narrowly read-only GitHub Actions queries do not need a work receipt', async () => {
  const f = await fixture();
  for (const name of ['clocksleep', 'clock__curr_time', 'web.run'])
    assert.equal(await workGate({ ...f.event, tool_name: name, tool_input: {} }, f.options), null);
  for (const command of ['gh run list -R owner/repo --limit 3', 'gh run view 123 --json status', 'gh workflow list'])
    assert.equal(await workGate({ ...f.event, tool_name: 'Bash', tool_input: { command } }, f.options), null);
  for (const command of ['gh run cancel 123', 'gh run view 123; Remove-Item issue.txt'])
    assert(denied(await workGate({ ...f.event, tool_name: 'Bash', tool_input: { command } }, f.options)));
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

test('a nested authorized work directory prepares without widening roots or accepting traversal', async () => {
  const f = await fixture(), nested = path.join(f.home, 'nested'); await mkdir(nested);
  await writeFile(path.join(nested, 'issue.txt'), 'Validation precedes mutation.');
  const packet = await f.begin({ root: nested });
  assert.equal(packet.root, await import('node:fs/promises').then(m => m.realpath(f.home)));
  assert.equal(packet.source_index[0].path, 'nested/issue.txt');
  assert.equal(f.calls(), 1);
  await assert.rejects(authorizedWorkScope({ ...f.work, root: nested, sources: [{id:'x',path:'../issue.txt'}] }, [f.home]), /PATH_NOT_ALLOWED/);
  const outside = await mkdtemp(path.join(os.tmpdir(), 'jev-gate-outside-'));
  await symlink(outside, path.join(f.home, 'alias'), 'junction');
  await assert.rejects(authorizedWorkScope({ ...f.work, root: path.join(f.home, 'alias') }, [f.home]), /ROOT_NOT_ALLOWED/);
});

test('blocked calls expose a private exact canonical binding, not inferred public tool arguments', async () => {
  const f = await fixture();
  const result = await workGate(f.event, f.options);
  const reason = result.hookSpecificOutput.permissionDecisionReason;
  const pending = reason.match(/Exact canonical pending action is in (.*?); use it/)[1];
  assert.deepEqual(JSON.parse(await readFile(pending, 'utf8')), {tool_name:f.event.tool_name,tool_input:f.event.tool_input});
  assert.match(reason, /bound actions and every delegation/);
});

test('correcting a locally rejected root does not reserve or repeat an inference attempt', async () => {
  const f = await fixture();
  await assert.rejects(f.begin({root:os.tmpdir()}), /ROOT_NOT_ALLOWED/);
  assert.equal(f.calls(), 0);
  const packet = await f.begin();
  assert.equal(packet.judgment_state, 'JEV_JUDGED'); assert.equal(f.calls(), 1);
});

test('an executed exact child handoff preserves parent preparation once; new messages still invalidate it', async () => {
  const f = await fixture(); await f.begin();
  const spawn = {...f.event,tool_name:'spawn_agent',tool_input:{message:'Inspect original queue evidence for repair-queue only.'}};
  await f.review([spawn,f.event]); assert(!denied(await workGate(spawn,f.options)));
  const submit = {...f.event,hook_event_name:'UserPromptSubmit',prompt:spawn.tool_input.message};
  assert.match((await workGate(submit,f.options)).hookSpecificOutput.additionalContext,/same-task handoff/);
  assert(!denied(await workGate(f.event,f.options))); assert.equal(f.calls(),1);
  await f.review([f.event]); await workGate(submit,f.options);
  assert(denied(await workGate(f.event,f.options)));
});

test('unused delegation and different multi-agent followups never count as a handoff', async () => {
  const f=await fixture(); await f.begin();
  const first={...f.event,tool_name:'multi_agent_v1followup_task',tool_input:{message:'Check original text'}};
  await f.review([first]);
  await assert.rejects(f.review([{...first,tool_input:{message:'Check categories instead'}}]),/DIFFERENT_ASSIGNMENT_REQUIRES_NEW_TASK/);
  await workGate({...f.event,hook_event_name:'UserPromptSubmit',prompt:first.tool_input.message},f.options);
  assert(denied(await workGate(first,f.options)));
  assert.equal(await workGate({...f.event,tool_name:'multi_agent_v1wait_agent',tool_input:{}},f.options),null);
  assert.equal(await workGate({...f.event,tool_name:'Bash',tool_input:{command:'Get-FileHash issue.txt'}},f.options),null);
});

test('hook failures are specific to the event and disabled recovery never waits on stdin', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'jev-hook-recovery-'));
  const configFile = path.join(home, 'auto', 'config.json');
  await mkdir(path.dirname(configFile));
  await writeFile(configFile, JSON.stringify({ enabled: true, roots: [home] }));
  const entry = path.resolve('bin/jev-work-hook.mjs');
  const invalidCwd = path.join(home, 'missing');
  for (const [eventName, shouldDeny] of [['UserPromptSubmit', false], ['PreToolUse', true]]) {
    const input = JSON.stringify({ hook_event_name: eventName, session_id: 'recovery', cwd: invalidCwd,
      ...(eventName === 'PreToolUse' ? { tool_name: 'Bash', tool_input: { command: 'node -e 1' } } : { prompt: 'Fix queue' }) });
    const result = spawnSync(process.execPath, [entry, configFile], { input, encoding: 'utf8', timeout: 3000 });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    if (shouldDeny) assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    else assert.equal(result.stdout, '');
  }
  await writeFile(configFile, JSON.stringify({ enabled: false, roots: [home] }));
  const child = spawn(process.execPath, [entry, configFile], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const result = await Promise.race([once(child, 'exit'), new Promise((_, reject) => setTimeout(() => reject(Error('disabled hook waited for input')), 2000))]).finally(() => child.kill());
  assert.equal(result[0], 0); assert.equal(stdout, ''); assert.equal(stderr, '');
  const status = await autoStatus(home);
  assert.equal(status.enabled, false); assert.equal(status.status, 'DISABLED'); assert.equal(status.last_run, null);
  const missingSession = await autoStatus(home, 'never-seen');
  assert.equal(missingSession.status, 'DISABLED'); assert.equal(missingSession.last_run, null);
});

test('Windows installed-style PowerShell hook does not deny message submission on local failure', { skip: process.platform !== 'win32' }, async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'jev-hook-shell-'));
  const configFile = path.join(home, 'auto', 'config.json');
  await mkdir(path.dirname(configFile));
  await writeFile(configFile, JSON.stringify({ enabled: true, roots: [home] }));
  const entry = path.resolve('bin/jev-work-hook.mjs');
  const command = hookCommand(entry, configFile);
  for (const [eventName, expectedDenial] of [['UserPromptSubmit', false], ['PreToolUse', true]]) {
    const input = JSON.stringify({ hook_event_name: eventName, session_id: 'shell-test', cwd: path.join(home, 'missing'),
      ...(eventName === 'PreToolUse' ? { tool_name: 'Bash', tool_input: { command: 'node -e 1' } } : { prompt: 'Fix queue' }) });
    const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
      { input, encoding: 'utf8', timeout: 6000, windowsHide: true });
    assert.equal(result.status, 0); assert.equal(result.stderr, '');
    if (expectedDenial) assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    else assert.equal(result.stdout, '');
  }
});

test('event-specific v2 handler denies unknown tool input and never denies submit input', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'jev-hook-v2-'));
  const configFile = path.join(home, 'auto', 'config.json');
  await mkdir(path.dirname(configFile));
  await writeFile(configFile, JSON.stringify({ enabled: true, roots: [home] }));
  const entry = path.resolve('bin/jev-work-hook.mjs');
  for (const [expectedEvent, shouldDeny] of [['UserPromptSubmit', false], ['PreToolUse', true]]) {
    const result = spawnSync(process.execPath, [entry, configFile, expectedEvent], { input: 'not json', encoding: 'utf8', timeout: 3000 });
    assert.equal(result.status, 0); assert.equal(result.stderr, '');
    if (shouldDeny) assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    else assert.equal(result.stdout, '');
  }
});

test('event-specific v2 watchdog does not deny a stalled submit but denies a stalled tool call', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'jev-hook-v2-timeout-'));
  const configFile = path.join(home, 'auto', 'config.json');
  await mkdir(path.dirname(configFile));
  await writeFile(configFile, JSON.stringify({ enabled: true, roots: [home] }));
  const entry = path.resolve('bin/jev-work-hook.mjs');
  for (const [eventName, shouldDeny, deadline] of [['UserPromptSubmit', false, 4000], ['PreToolUse', true, 10000]]) {
    const child = spawn(process.execPath, [entry, configFile, eventName], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    let timeout;
    try {
      const result = await Promise.race([
        once(child, 'exit'),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('hook watchdog did not exit')), deadline); }),
      ]);
      assert.equal(result[0], 0);
    } finally {
      clearTimeout(timeout);
      if (child.exitCode === null) child.kill();
    }
    assert.equal(stderr, '');
    if (shouldDeny) assert.equal(JSON.parse(stdout).hookSpecificOutput.permissionDecision, 'deny');
    else assert.equal(stdout, '');
  }
});

test('Windows v2 installed-style commands retain event-specific failure behavior', { skip: process.platform !== 'win32' }, async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'jev-hook-v2-shell-'));
  const configFile = path.join(home, 'auto', 'config.json');
  await mkdir(path.dirname(configFile));
  await writeFile(configFile, JSON.stringify({ enabled: true, roots: [home] }));
  const entry = path.resolve('bin/jev-work-hook.mjs');
  for (const [expectedEvent, shouldDeny] of [['UserPromptSubmit', false], ['PreToolUse', true]]) {
    const command = hookCommand(entry, configFile, process.platform, expectedEvent);
    const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
      { input: 'not json', encoding: 'utf8', timeout: 6000, windowsHide: true });
    assert.equal(result.status, 0); assert.equal(result.stderr, '');
    if (shouldDeny) assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    else assert.equal(result.stdout, '');
  }
});
