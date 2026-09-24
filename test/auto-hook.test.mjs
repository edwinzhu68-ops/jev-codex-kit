import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { prepareAuto, installAuto, installWorkGate, commandQuote, hookCommand, refreshAuto, setAutoEnabled, setAutoMode, uninstallAuto } from '../src/auto-install.mjs';
import { runAutoHook, eligiblePrompt, withinRoot } from '../src/auto-hook.mjs';

async function fixture(mode = 'skills') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jev-auto-'));
  const skill = path.join(root, 'SKILL.md');
  await writeFile(skill, '---\nname: code-review\ndescription: Review code changes for regressions.\n---\nLocal body.');
  const codexHome = path.join(root, 'codex');
  await mkdir(codexHome);
  const original = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo existing' }] }] } };
  await writeFile(path.join(codexHome, 'hooks.json'), JSON.stringify(original));
  const installed = await installAuto({ roots: [root], skill_files: [skill], mode }, { home: path.join(root, 'kit'), codexHome });
  const config = JSON.parse(await readFile(installed.config_file));
  return { root, skill, installed, config, original, event: { hook_event_name: 'UserPromptSubmit', session_id: 'session', cwd: root, prompt: 'Review these code changes for regressions' } };
}

test('workflow reminder is local on each eligible work prompt and never calls Jev', async () => {
  const f = await fixture('workflow');
  assert.equal((await prepareAuto({ roots: [f.root], skill_files: [f.skill] })).mode, 'workflow');
  const deps = { configure: async () => assert.fail('No credential/provider work'), route: async () => assert.fail('No model request') };
  const first = await runAutoHook(f.event, f.installed.config_file, deps);
  assert.match(first.hookSpecificOutput.additionalContext, /zero model calls/);
  assert.match(first.hookSpecificOutput.additionalContext, /before each substantive task/);
  assert.match(first.hookSpecificOutput.additionalContext, /main host will execute or delegate/);
  assert.match(first.hookSpecificOutput.additionalContext, /Every different subagent assignment needs its own task_id/);
  assert.match(first.hookSpecificOutput.additionalContext, /Pass the packet, source hashes and receipt to subagents/);
  assert.doesNotMatch(first.hookSpecificOutput.additionalContext, /candidate ID|Inspect candidate/);
  const next = await runAutoHook({ ...f.event, prompt: 'Now examine a different set of logs' }, f.installed.config_file, deps);
  assert.match(next.hookSpecificOutput.additionalContext, /before each substantive task/);
  const last = JSON.parse(await readFile(path.join(path.dirname(f.installed.config_file), 'last-run.json')));
  assert.equal(last.status, 'WORKFLOW_REMINDER');
  assert.equal(last.metrics.workflow_inference_calls, 0);
  assert.equal(JSON.parse(await readFile(path.join(path.dirname(f.installed.config_file), 'sessions', last.session + '.json'))).count, 0);
  for (const prompt of ['继续', 'x'.repeat(5000), 'Review\n```js\ncode\n```']) assert(await runAutoHook({ ...f.event, prompt }, f.installed.config_file, deps));
  assert(await runAutoHook({ ...f.event, session_id: 'another-task' }, f.installed.config_file, deps));
});

test('work gate installation preserves trusted definitions and registers separate native review entries', async () => {
  const f = await fixture();
  const options = { home: path.dirname(path.dirname(f.installed.config_file)), codexHome: path.dirname(f.installed.hook_file) };
  const before = JSON.parse(await readFile(f.installed.hook_file));
  const result = await installWorkGate(options);
  assert.equal(result.status, 'INSTALLED_AWAITING_NATIVE_TRUST');
  const after = JSON.parse(await readFile(f.installed.hook_file));
  assert.deepEqual(after.hooks.UserPromptSubmit[0], before.hooks.UserPromptSubmit[0]);
  assert.deepEqual(after.hooks.Stop, before.hooks.Stop);
  assert.equal(after.hooks.PreToolUse[0].matcher, '.*');
  assert(!JSON.stringify(after).includes('trusted_hash'));
  assert.equal((await installWorkGate(options)).status, 'REGISTERED_TRUST_NOT_VERIFIED');
});

test('mode changes preserve prior decisions and refresh preserves the selected mode', async () => {
  const f = await fixture(); let calls = 0;
  const deps = { configure: async () => {}, route: async () => { calls++; return { status: 'NO_MATCH' }; } };
  await runAutoHook(f.event, f.installed.config_file, deps);
  const home = path.dirname(path.dirname(f.installed.config_file));
  const changed = await setAutoMode('workflow', { home });
  assert.equal(JSON.parse(await readFile(changed.backup)).mode, 'skills');
  assert(await runAutoHook(f.event, f.installed.config_file, deps));
  await refreshAuto({ home });
  assert.equal(JSON.parse(await readFile(f.installed.config_file)).mode, 'workflow');
  await setAutoMode('skills', { home });
  assert.equal(await runAutoHook(f.event, f.installed.config_file, deps), null);
  assert.equal(calls, 1);
  await assert.rejects(setAutoMode('unknown', { home }), /INVALID_AUTO_MODE/);
});

test('installation preserves other hooks and backs up bytes; never grants trust', async () => {
  const f = await fixture();
  assert.deepEqual(JSON.parse(await readFile(f.installed.backup)), f.original);
  const hooks = JSON.parse(await readFile(f.installed.hook_file));
  assert.deepEqual(hooks.hooks.Stop, f.original.hooks.Stop);
  assert.equal(hooks.hooks.UserPromptSubmit.length, 1);
  assert.equal(hooks.hooks.UserPromptSubmit[0].hooks[0].timeout, 12);
  assert.equal(f.installed.status, 'INSTALLED_AWAITING_NATIVE_TRUST');
  assert(!JSON.stringify(hooks).includes('trusted_hash'));
  await assert.rejects(installAuto({ roots: [f.root], skill_files: [f.skill] }, { home: path.dirname(path.dirname(f.installed.config_file)), codexHome: path.dirname(f.installed.hook_file) }), /already exists/);
});

test('continuations, secrets, code blocks, oversized inputs and arithmetic skip locally', () => {
  for (const value of ['等等','等一下','停止','暂停','wait','stop','修好','继续', '可以。', 'go ahead', '2+2', '```code```', 'apikey_' + 'a'.repeat(30), 'password="abcdefgh"', 'person@example.com', 'x'.repeat(1801), null]) assert.equal(eligiblePrompt(value), false);
  assert(eligiblePrompt('Review the patch for regressions'));
  assert(withinRoot(path.join(os.tmpdir(), 'a', 'b'), [path.join(os.tmpdir(), 'a')]));
  assert(!withinRoot(path.join(os.tmpdir(), 'ab'), [path.join(os.tmpdir(), 'a')]));
});

test('automatic hook makes one call, injects only opaque ID, and never replays same prompt', async () => {
  const f = await fixture(); let calls = 0;
  const deps = { configure: async () => {}, route: async input => { calls++; return { status: 'SUGGESTED', recommendation: input.candidates[0], model: 'jev-1.13.0' }; } };
  const result = await runAutoHook(f.event, f.installed.config_file, deps);
  assert.equal(calls, 1);
  assert(result.hookSpecificOutput.additionalContext.includes(f.config.skills[0].candidate.id));
  assert(!JSON.stringify(result).includes(f.config.skills[0].candidate.description));
  assert(!('systemMessage' in result)); assert(!('decision' in result));
  assert.equal(await runAutoHook(f.event, f.installed.config_file, deps), null);
  assert.equal(calls, 1);
});

test('error or uncertainty blocks only unchanged judgment, not subsequent new tasks', async () => {
  for (const status of ['ERROR', 'REVIEW_REQUIRED', 'NO_MATCH']) {
    const f = await fixture(); let calls = 0;
    const deps = { configure: async () => {}, route: async () => { calls++; if (status === 'ERROR') throw Error('private provider text'); return { status }; } };
    assert.equal(await runAutoHook(f.event, f.installed.config_file, deps), null);
    await runAutoHook(f.event, f.installed.config_file, deps);
    assert.equal(calls,1);
    await runAutoHook({ ...f.event, prompt: 'Review a different patch for bugs' }, f.installed.config_file, deps);
    assert.equal(calls,2);
    assert(!(await readFile(path.join(path.dirname(f.installed.config_file), 'last-run.json'), 'utf8')).includes('private provider'));
  }
});

test('distinct prompts continue beyond old per-session and daily counters', async () => {
  const f = await fixture(); let calls = 0;
  const deps = { configure: async () => {}, route: async () => { calls++; return { status: 'NO_MATCH' }; } };
  for (let s = 0; s < 6; s++) for (let n = 0; n < 7; n++) await runAutoHook({ ...f.event, session_id: 's' + s, prompt: 'Review code change number ' + n }, f.installed.config_file, deps);
  assert.equal(calls, 42);
});

test('stale skill and outside-root tasks never reach the model', async () => {
  const f = await fixture(); let calls = 0;
  const deps = { configure: async () => {}, route: async () => { calls++; } };
  assert.equal(await runAutoHook({ ...f.event, cwd: path.dirname(f.root) }, f.installed.config_file, deps), null);
  await writeFile(f.skill, 'changed');
  assert.equal(await runAutoHook(f.event, f.installed.config_file, deps),null);
  assert.equal(JSON.parse(await readFile(path.join(path.dirname(f.installed.config_file),'last-run.json'))).status,'STALE_SKILLS');
  assert.equal(calls, 0);
});

test('refresh, disable, enable and removal preserve receipts, decisions and unrelated hooks',async()=>{
  const f=await fixture(),home=path.dirname(path.dirname(f.installed.config_file));
  let calls=0;const deps={configure:async()=>{},route:async input=>{calls++;return {status:'SUGGESTED',recommendation:input.candidates[0]};}};
  await runAutoHook(f.event,f.installed.config_file,deps);
  await writeFile(f.skill,(await readFile(f.skill,'utf8'))+'\nUpdated instructions.');
  await runAutoHook({...f.event,prompt:'Review another patch'},f.installed.config_file,deps);
  assert.equal(JSON.parse(await readFile(path.join(home,'auto','last-run.json'))).status,'STALE_SKILLS');
  const refreshed=await refreshAuto({home});assert.equal(refreshed.status,'REFRESHED');assert(refreshed.backup);
  await setAutoEnabled(false,{home});await runAutoHook({...f.event,prompt:'Review after disabling'},f.installed.config_file,deps);assert.equal(calls,1);
  await setAutoEnabled(true,{home});await runAutoHook({...f.event,prompt:'Review another patch'},f.installed.config_file,deps);assert.equal(calls,2);
  assert.equal((await uninstallAuto({home,codexHome:path.dirname(f.installed.hook_file)})).status,'REMOVED');
  const hooks=JSON.parse(await readFile(f.installed.hook_file));assert.deepEqual(hooks.hooks.Stop,f.original.hooks.Stop);assert.equal(hooks.hooks.UserPromptSubmit.length,0);
  assert.equal((await uninstallAuto({home,codexHome:path.dirname(f.installed.hook_file)})).status,'NOT_INSTALLED');
});

test('old stopped sessions migrate without replaying prior failed prompts',async()=>{
  const f=await fixture();const {hashText}=await import('../src/skill-router.mjs');
  const old={day:'2026-09-22',count:30,sessions:{[hashText(f.event.session_id)]:{count:6,stopped:true,goals:[hashText(f.event.prompt)]}}};
  const file=path.join(path.dirname(f.installed.config_file),'state.json');await writeFile(file,JSON.stringify(old));
  let calls=0;const deps={configure:async()=>{},route:async()=>{calls++;return {status:'NO_MATCH'};}};
  await runAutoHook(f.event,f.installed.config_file,deps);assert.equal(calls,0);
  await runAutoHook({...f.event,prompt:'Review a new current task'},f.installed.config_file,deps);assert.equal(calls,1);
  assert.deepEqual(JSON.parse(await readFile(file)),old);
});

test('uncertain selected skill reaches host as review evidence, never automatic approval',async()=>{
 const f=await fixture();const result=await runAutoHook(f.event,f.installed.config_file,{configure:async()=>{},route:async i=>({status:'REVIEW_REQUIRED',recommendation:null,selection:{choice:i.candidates[0].id}})});
 assert.match(result.hookSpecificOutput.additionalContext,/REVIEW_REQUIRED, not an accepted recommendation/);
 assert.match(result.hookSpecificOutput.additionalContext,/confirm the skill is available and applicable/);
 assert(!('decision' in result));
});

test('independent simultaneous task receipts remain readable and do not lose reservations',async()=>{
 const f=await fixture();let calls=0;const events=['one','two','three'].map(session_id=>({...f.event,session_id}));
 const deps={configure:async()=>{},route:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return {status:'NO_MATCH'};}};
  await Promise.all(events.map(e=>runAutoHook(e,f.installed.config_file,deps)));
  const {autoStatus}=await import('../src/auto-status.mjs');const home=path.dirname(path.dirname(f.installed.config_file));
  assert.equal(calls,3);assert.equal((await autoStatus(home)).status,'NO_MATCH');
  for(const e of events)assert.equal((await autoStatus(home,e.session_id)).status,'NO_MATCH');
 await Promise.all(events.map(e=>runAutoHook(e,f.installed.config_file,deps)));assert.equal(calls,3);
});

test('canonical scope accepts aliases of approved roots and rejects junction escapes',async()=>{
  const f=await fixture(), outside=await mkdtemp(path.join(os.tmpdir(),'jev-alias-'));
  const alias=path.join(outside,'approved-alias'), escape=path.join(f.root,'outside-link');
  await symlink(f.root,alias,process.platform==='win32'?'junction':'dir');
  await symlink(outside,escape,process.platform==='win32'?'junction':'dir');
  let calls=0;const deps={configure:async()=>{},route:async()=>{calls++;return {status:'NO_MATCH'};}};
  await runAutoHook({...f.event,cwd:alias},f.installed.config_file,deps);assert.equal(calls,1);
  await runAutoHook({...f.event,cwd:escape,prompt:'Review another diff'},f.installed.config_file,deps);assert.equal(calls,1);
});

test('CLI handler errors produce exit zero, empty stdout and empty stderr', async () => {
  for (const input of ['not json', JSON.stringify({ hook_event_name: 'Stop' }), 'x'.repeat(70000)]) {
    const child = spawnSync(process.execPath, ['bin/jev-auto-hook.mjs', path.join(os.tmpdir(), 'missing', 'auto', 'config.json')], { input, encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, 0); assert.equal(child.stdout, ''); assert.equal(child.stderr, '');
  }
});

test('command paths reject Windows shell substitution characters', () => {
  for (const value of ['a%PATH%', 'a"b', 'a&b', 'a`b', 'a$b']) assert.throws(() => commandQuote(value, 'win32'));
  assert.equal(commandQuote('C:\\Program Files\\node.exe', 'win32'), '"C:\\Program Files\\node.exe"');
  assert.equal(commandQuote("a'b", 'linux'), "'a'\\''b'");
});

test('Windows hook command launches a quoted Node path through PowerShell', {skip:process.platform!=='win32'}, async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'jev hook '));
  const entry=path.join(root,"test's handler.mjs");
  await writeFile(entry,"process.stdout.write('HOOK_ARGUMENT_OK:'+process.argv[2]);");
  const command=hookCommand(entry,'argument with spaces');
  const child=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(child.status,0);assert.equal(child.stdout,'HOOK_ARGUMENT_OK:argument with spaces');assert.equal(child.stderr,'');
});
