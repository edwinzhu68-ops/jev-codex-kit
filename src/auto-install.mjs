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
export function hookCommand(entry, configFile, platform = process.platform) {
  if (platform !== 'win32') return [process.execPath, entry, configFile].map(v => commandQuote(v, platform)).join(' ');
  // Codex can run hooks through the configured PowerShell. A quoted executable
  // alone is a string expression there, not an invocation. An encoded inner
  // command preserves arguments under either cmd.exe or PowerShell.
  const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (/[\s"'`$%&|<>^!]/.test(shell)) throw Error('UNSUPPORTED_SYSTEM_PATH');
  const literal = v => "'" + v.replaceAll("'", "''") + "'";
  const script = '[Console]::InputEncoding=[Text.UTF8Encoding]::new();[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); & ' + [process.execPath, entry, configFile].map(literal).join(' ') + '; exit $LASTEXITCODE';
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
  return { version: 1, enabled: true, roots, skills };
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
  const config = await prepareAuto({ roots: old.roots, skill_files: old.skills.map(s => s.file) });
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

export async function uninstallAuto({ home = kitHome(), codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex') } = {}) {
  const file = path.join(codexHome, 'hooks.json');
  let before;
  try { before = await readFile(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return {status:'NOT_INSTALLED'}; throw e; }
  const hooks = JSON.parse(before), groups = hooks.hooks?.UserPromptSubmit;
  if (!Array.isArray(groups)) return {status:'NOT_INSTALLED'};
  const command = hookCommand(fileURLToPath(new URL('../bin/jev-auto-hook.mjs', import.meta.url)), path.join(path.resolve(home),'auto','config.json'));
  const owned = groups.filter(g => g.description === marker);
  if (!owned.length) return {status:'NOT_INSTALLED'};
  if (owned.length !== 1 || owned[0].hooks?.length !== 1 || owned[0].hooks[0].command !== command) throw Error('OWNED_HOOK_CHANGED_REVIEW_REQUIRED');
  hooks.hooks.UserPromptSubmit = groups.filter(g => g !== owned[0]);
  const backup = file + '.backup-' + randomUUID();
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  if (await readFile(file, 'utf8') !== before) throw Error('HOOKS_CHANGED');
  await writeFile(file, JSON.stringify(hooks,null,2)+'\n', {mode:0o600});
  return {status:'REMOVED',backup,note:'Only the owned hook was removed. Credentials, receipts, MCP servers and other hooks are preserved.'};
}
