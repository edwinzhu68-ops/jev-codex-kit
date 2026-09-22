import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { installAuto, commandQuote, hookCommand } from '../src/auto-install.mjs';
import { runAutoHook, eligiblePrompt, withinRoot } from '../src/auto-hook.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jev-auto-'));
  const skill = path.join(root, 'SKILL.md');
  await writeFile(skill, '---\nname: code-review\ndescription: Review code changes for regressions.\n---\nLocal body.');
  const codexHome = path.join(root, 'codex');
  await mkdir(codexHome);
  const original = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo existing' }] }] } };
  await writeFile(path.join(codexHome, 'hooks.json'), JSON.stringify(original));
  const installed = await installAuto({ roots: [root], skill_files: [skill] }, { home: path.join(root, 'kit'), codexHome });
  const config = JSON.parse(await readFile(installed.config_file));
  return { root, skill, installed, config, original, event: { hook_event_name: 'UserPromptSubmit', session_id: 'session', cwd: root, prompt: 'Review these code changes for regressions' } };
}

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
  for (const value of ['继续', '可以。', 'go ahead', '2+2', '```code```', 'apikey_' + 'a'.repeat(30), 'password="abcdefgh"', 'person@example.com', 'x'.repeat(1801), null]) assert.equal(eligiblePrompt(value), false);
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

test('error or uncertain result stops that session; no-match does not approve anything', async () => {
  for (const status of ['ERROR', 'REVIEW_REQUIRED', 'NO_MATCH']) {
    const f = await fixture(); let calls = 0;
    const deps = { configure: async () => {}, route: async () => { calls++; if (status === 'ERROR') throw Error('private provider text'); return { status }; } };
    assert.equal(await runAutoHook(f.event, f.installed.config_file, deps), null);
    await runAutoHook({ ...f.event, prompt: 'Review a different patch for bugs' }, f.installed.config_file, deps);
    assert.equal(calls, status === 'NO_MATCH' ? 2 : 1);
    assert(!(await readFile(path.join(path.dirname(f.installed.config_file), 'last-run.json'), 'utf8')).includes('private provider'));
  }
});

test('session and daily caps are reservations, not a model confidence decision', async () => {
  const f = await fixture(); let calls = 0;
  const deps = { configure: async () => {}, route: async () => { calls++; return { status: 'NO_MATCH' }; } };
  for (let s = 0; s < 6; s++) for (let n = 0; n < 7; n++) await runAutoHook({ ...f.event, session_id: 's' + s, prompt: 'Review code change number ' + n }, f.installed.config_file, deps);
  assert.equal(calls, 30);
});

test('stale skill and outside-root tasks never reach the model', async () => {
  const f = await fixture(); let calls = 0;
  const deps = { configure: async () => {}, route: async () => { calls++; } };
  assert.equal(await runAutoHook({ ...f.event, cwd: path.dirname(f.root) }, f.installed.config_file, deps), null);
  await writeFile(f.skill, 'changed');
  await assert.rejects(runAutoHook(f.event, f.installed.config_file, deps), /STALE/);
  assert.equal(calls, 0);
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
