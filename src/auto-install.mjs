import { readFile, writeFile, mkdir, copyFile, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseDocument } from 'yaml';
import { kitHome } from './settings.mjs';
import { hashText, skillCandidateSchema, assertNoSecret } from './skill-router.mjs';

const marker = 'jev-kit-auto-skills-v1';
const gateMarker = 'jev-kit-work-gate-v1';
const gateMarkerV2 = 'jev-kit-work-gate-v2';
export async function installWorkGate({ home = kitHome(), codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex') } = {}) {
  const configFile = path.join(path.resolve(home), 'auto', 'config.json');
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  if (!Array.isArray(config.roots) || !config.roots.length) throw Error('CONFIGURE_AUTHORIZED_ROOTS_FIRST');
  const file = path.join(codexHome, 'hooks.json');
  const before = await readFile(file, 'utf8'), hooks = JSON.parse(before);
  hooks.hooks ??= {};
  const command = hookCommand(fileURLToPath(new URL('../bin/jev-work-hook.mjs', import.meta.url)), configFile);
  for (const event of ['UserPromptSubmit', 'PreToolUse']) {
    const groups = hooks.hooks[event] ?? [];
    if (!Array.isArray(groups)) throw Error('INVALID_EXISTING_HOOKS');
    const owned = groups.filter(g => g.description === gateMarker);
    const desired = { description: gateMarker, ...(event === 'PreToolUse' ? { matcher: '.*' } : {}), hooks: [{ type: 'command', command, timeout: 12 }] };
    if (owned.length && (owned.length !== 1 || JSON.stringify(owned[0]) !== JSON.stringify(desired))) throw Error('OWNED_GATE_CHANGED_REVIEW_REQUIRED');
    if (!owned.length) groups.push(desired);
    hooks.hooks[event] = groups;
  }
  const after = JSON.stringify(hooks, null, 2) + '\n';
  if (after === before) return { status: 'REGISTERED_TRUST_NOT_VERIFIED', hook_file: file };
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('HOOKS_CHANGED');
  await mkdir(path.join(home, 'auto', 'inbox'), { recursive: true, mode: 0o700 });
  await writeFile(file, after, { mode: 0o600 });
  return { status: 'INSTALLED_AWAITING_NATIVE_TRUST', hook_file: file, backup, note: 'New native hook definitions require review. No trust state changed; existing sessions were not restarted.' };
}
// v2 uses a fixed event argument so a timeout can fail open for message submit
// while still failing closed for tool execution. It never changes native trust.
export async function installWorkGateV2({ home = kitHome(), codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex'), replaceV1 = false } = {}) {
  const configFile = path.join(path.resolve(home), 'auto', 'config.json');
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  if (!Array.isArray(config.roots) || !config.roots.length) throw Error('CONFIGURE_AUTHORIZED_ROOTS_FIRST');
  const file = path.join(codexHome, 'hooks.json');
  const before = await readFile(file, 'utf8'), hooks = JSON.parse(before);
  hooks.hooks ??= {};
  const entry = fileURLToPath(new URL('../bin/jev-work-hook.mjs', import.meta.url));
  const legacyCommand = hookCommand(entry, configFile);
  for (const event of ['UserPromptSubmit', 'PreToolUse']) {
    const groups = hooks.hooks[event] ?? [];
    if (!Array.isArray(groups)) throw Error('INVALID_EXISTING_HOOKS');
    const old = groups.filter(group => group.description === gateMarker);
    const oldDesired = { description: gateMarker, ...(event === 'PreToolUse' ? { matcher: '.*' } : {}), hooks: [{ type: 'command', command: legacyCommand, timeout: 12 }] };
    if (old.length && (!replaceV1 || old.length !== 1 || JSON.stringify(old[0]) !== JSON.stringify(oldDesired))) throw Error('V1_GATE_PRESENT_REQUIRES_EXPLICIT_MIGRATION');
    const command = hookCommand(entry, configFile, process.platform, event);
    const desired = { description: gateMarkerV2, ...(event === 'PreToolUse' ? { matcher: '.*' } : {}), hooks: [{ type: 'command', command, timeout: event === 'UserPromptSubmit' ? 5 : 12 }] };
    const existing = groups.filter(group => group.description === gateMarkerV2);
    if (existing.length && (existing.length !== 1 || JSON.stringify(existing[0]) !== JSON.stringify(desired))) throw Error('OWNED_GATE_CHANGED_REVIEW_REQUIRED');
    hooks.hooks[event] = groups.filter(group => group !== old[0]);
    if (!existing.length) hooks.hooks[event].push(desired);
  }
  const after = JSON.stringify(hooks, null, 2) + '\n';
  if (after === before) return { status: 'REGISTERED_TRUST_NOT_VERIFIED', hook_file: file };
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('HOOKS_CHANGED');
  await mkdir(path.join(home, 'auto', 'inbox'), { recursive: true, mode: 0o700 });
  await writeFile(file, after, { mode: 0o600 });
  return { status: 'INSTALLED_AWAITING_NATIVE_TRUST', hook_file: file, backup, note: 'Distinct submit/tool hook definitions require native review. Enabled state is unchanged.' };
}
export async function uninstallWorkGateV2({ home = kitHome(), codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex') } = {}) {
  const file = path.join(codexHome, 'hooks.json');
  const before = await readFile(file, 'utf8'), hooks = JSON.parse(before);
  const configFile = path.join(path.resolve(home), 'auto', 'config.json');
  const entry = fileURLToPath(new URL('../bin/jev-work-hook.mjs', import.meta.url));
  let removed = 0;
  for (const event of ['UserPromptSubmit', 'PreToolUse']) {
    const groups = hooks.hooks?.[event];
    if (groups == null) continue;
    if (!Array.isArray(groups)) throw Error('INVALID_EXISTING_HOOKS');
    const owned = groups.filter(group => group.description === gateMarkerV2);
    if (!owned.length) continue;
    const desired = { description: gateMarkerV2, ...(event === 'PreToolUse' ? { matcher: '.*' } : {}), hooks: [{ type: 'command', command: hookCommand(entry, configFile, process.platform, event), timeout: event === 'UserPromptSubmit' ? 5 : 12 }] };
    if (owned.length !== 1 || JSON.stringify(owned[0]) !== JSON.stringify(desired)) throw Error('OWNED_GATE_CHANGED_REVIEW_REQUIRED');
    hooks.hooks[event] = groups.filter(group => group !== owned[0]);
    removed++;
  }
  if (!removed) return { status: 'NOT_INSTALLED' };
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('HOOKS_CHANGED');
  await writeFile(file, JSON.stringify(hooks, null, 2) + '\n', { mode: 0o600 });
  return { status: 'REMOVED', removed, backup, note: 'Only exact owned v2 gate definitions were removed. Native trust and other hooks were preserved.' };
}
export function hookCommand(entry, configFile, platform = process.platform, expectedEvent = null) {
  const args = [process.execPath, entry, configFile, ...(expectedEvent ? [expectedEvent] : [])];
  if (platform !== 'win32') return args.map(v => commandQuote(v, platform)).join(' ');
  // Codex can run hooks through the configured PowerShell. A quoted executable
  // alone is a string expression there, not an invocation. An encoded inner
  // command preserves arguments under either cmd.exe or PowerShell.
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (/[\s"'`$%&|<>^!]/.test(shell)) throw Error('UNSUPPORTED_SYSTEM_PATH');
  const literal = v => "'" + v.replaceAll("'", "''") + "'";
  const script = '[Console]::InputEncoding=[Text.UTF8Encoding]::new();[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); & ' + args.map(literal).join(' ') + '; exit $LASTEXITCODE';
  return shell + ' -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ' + Buffer.from(script, 'utf16le').toString('base64');
}
export function commandQuote(value, platform = process.platform) {
  if (/[\r\n\0]/.test(value)) throw Error('UNSAFE_COMMAND_PATH');
  if (platform === 'win32') {
    if (/["%&|<>^!`$]/.test(value)) throw Error('UNSAFE_COMMAND_PATH');
    return '"' + value + '"';
  }
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

// Intentional one-time setup. It never writes hooks.state or bypasses native trust.
export async function prepareAuto(spec) {
  const mode = spec.mode ?? 'workflow';
  if (!['workflow', 'skills'].includes(mode)) throw Error('INVALID_AUTO_MODE');
  if (!Array.isArray(spec.roots) || !spec.roots.length || !Array.isArray(spec.skill_files) || !spec.skill_files.length || spec.skill_files.length > 19) throw Error('Provide roots and 1-19 explicit skill_files.');
  const roots = [];
  for (const root of spec.roots) {
    const resolved = await realpath(root);
    if (!(await stat(resolved)).isDirectory() || resolved === path.parse(resolved).root) throw Error('INVALID_ROOT');
    roots.push(resolved);
  }
  const skills = [];
  for (const file of spec.skill_files) {
    const resolved = await realpath(file);
    if ((await stat(resolved)).size > 128 * 1024) throw Error('SKILL_TOO_LARGE');
    const bytes = await readFile(resolved);
    const front = bytes.toString('utf8').replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!front) throw Error('SKILL_METADATA');
    const document = parseDocument(front[1], { uniqueKeys: true });
    if (document.errors.length) throw Error('SKILL_METADATA');
    const data = document.toJS({ maxAliasCount: 0 });
    const candidate = skillCandidateSchema.parse({ id: 's_' + hashText(resolved).slice(0, 16), name: data.name, description: data.description, enabled: data['disable-model-invocation'] !== true });
    assertNoSecret(JSON.stringify(candidate));
    skills.push({ file: resolved, sha256: hashText(bytes), candidate });
  }
  if (new Set(skills.map(s => s.file)).size !== skills.length) throw Error('DUPLICATE_SKILL');
  return { version: 1, enabled: true, mode, roots, skills };
}

export async function installAuto(spec, { home = kitHome(), codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex') } = {}) {
  const config = await prepareAuto(spec), { roots, skills } = config;
  const directory = path.join(path.resolve(home), 'auto');
  const configFile = path.join(directory, 'config.json');
  const hookFile = path.join(codexHome, 'hooks.json');
  let hooks = {};
  try { hooks = JSON.parse(await readFile(hookFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (hooks.hooks != null && (typeof hooks.hooks !== 'object' || Array.isArray(hooks.hooks))) throw Error('INVALID_EXISTING_HOOKS');
  hooks.hooks ??= {};
  if (hooks.hooks.UserPromptSubmit != null && !Array.isArray(hooks.hooks.UserPromptSubmit)) throw Error('INVALID_EXISTING_HOOKS');
  const groups = hooks.hooks.UserPromptSubmit ?? [];
  // Description is metadata, not a matcher or an instruction.
  if (groups.some(g => g.description === marker)) throw Error('Auto hook already exists; preserve it and review/update explicitly.');
  const entry = fileURLToPath(new URL('../bin/jev-auto-hook.mjs', import.meta.url));
  const command = hookCommand(entry, configFile);
  groups.push({ description: marker, hooks: [{ type: 'command', command, timeout: 12 }] });
  hooks.hooks.UserPromptSubmit = groups;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await mkdir(codexHome, { recursive: true });
  // Existing unrelated config is never overwritten. A matching second install
  // is deliberately explicit rather than silently changing a trusted command.
  await writeFile(configFile, JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
  let backup = null;
  try { backup = hookFile + '.backup-' + randomUUID(); await copyFile(hookFile, backup, constants.COPYFILE_EXCL); }
  catch (e) { if (e.code !== 'ENOENT') throw e; backup = null; }
  await writeFile(hookFile, JSON.stringify(hooks, null, 2) + '\n', { mode: 0o600 });
  return { status: 'INSTALLED_AWAITING_NATIVE_TRUST', hook_file: hookFile, config_file: configFile, backup, skills: skills.length, roots: roots.length };
}

export async function refreshAuto({ home = kitHome() } = {}) {
  const file = path.join(home, 'auto', 'config.json');
  const before = await readFile(file, 'utf8'), old = JSON.parse(before);
  const config = await prepareAuto({ roots: old.roots, skill_files: old.skills.map(s => s.file), mode: old.mode ?? 'skills' });
  config.enabled = old.enabled !== false;
  const after = JSON.stringify(config, null, 2);
  if (after === before) return { status: 'UNCHANGED', config_file: file };
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('CONFIG_CHANGED_DURING_REFRESH');
  await writeFile(file, after, { mode: 0o600 });
  return { status: 'REFRESHED', config_file: file, backup, note: 'Explicitly accepted current selected skill bytes. Hook trust and decision history unchanged.' };
}

export async function setAutoEnabled(enabled, { home = kitHome() } = {}) {
  const file = path.join(home, 'auto', 'config.json'), before = await readFile(file, 'utf8');
  const config = JSON.parse(before);
  if (enabled) await prepareAuto({ roots: config.roots, skill_files: config.skills.map(s => s.file) });
  config.enabled = enabled;
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('CONFIG_CHANGED');
  await writeFile(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  return { status: enabled ? 'ENABLED' : 'DISABLED', backup };
}

export async function setAutoMode(mode, { home = kitHome() } = {}) {
  if (!['workflow', 'skills'].includes(mode)) throw Error('INVALID_AUTO_MODE');
  const file = path.join(home, 'auto', 'config.json'), before = await readFile(file, 'utf8');
  const config = JSON.parse(before);
  if ((config.mode ?? 'skills') === mode) return { status: 'UNCHANGED', mode };
  config.mode = mode;
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('CONFIG_CHANGED');
  await writeFile(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  return { status: 'MODE_CHANGED', mode, backup, note: 'Existing decision history and native hook trust were preserved.' };
}

export async function uninstallAuto({ home = kitHome(), codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex') } = {}) {
  const file = path.join(codexHome, 'hooks.json');
  let before;
  try { before = await readFile(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return {status:'NOT_INSTALLED'}; throw e; }
  const hooks = JSON.parse(before), groups = hooks.hooks?.UserPromptSubmit;
  if (!Array.isArray(groups)) return {status:'NOT_INSTALLED'};
  const command = hookCommand(fileURLToPath(new URL('../bin/jev-auto-hook.mjs', import.meta.url)), path.join(path.resolve(home),'auto','config.json'));
  const owned = groups.filter(g => g.description === marker);
  if (!owned.length) return {status:'NOT_INSTALLED'};
  if (owned.length !== 1 || owned[0].hooks?.length !== 1 ||
      (owned[0].hooks[0].command !== command && !sameWindowsAutoHookCommand(owned[0].hooks[0].command, command))) throw Error('OWNED_HOOK_CHANGED_REVIEW_REQUIRED');
  hooks.hooks.UserPromptSubmit = groups.filter(g => g !== owned[0]);
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('HOOKS_CHANGED');
  await writeFile(file, JSON.stringify(hooks,null,2)+'\n', {mode:0o600});
  return {status:'REMOVED',backup,note:'Only the owned hook was removed. Credentials, receipts, MCP servers and other hooks are preserved.'};
}

function sameWindowsAutoHookCommand(actual, expected) {
  const prefix = expected.split(' -EncodedCommand ')[0] + ' -EncodedCommand ';
  if (typeof actual !== 'string' || !actual.startsWith(prefix)) return false;
  const decode = value => {
    const encoded = value.slice(prefix.length);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
    const script = Buffer.from(encoded, 'base64').toString('utf16le');
    const match = script.match(/^\[Console\]::InputEncoding=\[Text\.UTF8Encoding\]::new\(\);\[Console\]::OutputEncoding=\[Text\.UTF8Encoding\]::new\(\); & '([^']+)' '([^']+)' '([^']+)'; exit \$LASTEXITCODE$/);
    return match?.slice(1) ?? null;
  };
  const a = decode(actual), b = decode(expected);
  return !!a && !!b && a.length === b.length && a.every((item, i) => path.win32.normalize(item.replaceAll('/', '\\')).toLowerCase() === path.win32.normalize(b[i].replaceAll('/', '\\')).toLowerCase());
}
