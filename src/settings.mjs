import { readFile, writeFile, mkdir, realpath, stat, copyFile, chmod } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export const MODEL = 'jev-1.13.0';
export const kitHome = () => path.resolve(process.env.JEV_KIT_HOME || path.join(homedir(), '.jev-codex-kit'));
export const runsHome = () => path.join(kitHome(), 'runs');
export async function readSettings() {
  try {
    const value = JSON.parse(await readFile(path.join(kitHome(), 'config.json'), 'utf8'));
    if (value.version !== 1 || !Array.isArray(value.roots) || value.roots.some(r => typeof r !== 'string' || !path.isAbsolute(r))) throw Error('Invalid configuration');
    return value;
  } catch (error) { if (error.code === 'ENOENT') return { version: 1, roots: [] }; throw Error('Invalid kit configuration. Restore its backup or run setup.'); }
}
export async function addRoot(input) {
  const root = await realpath(path.resolve(input));
  if (!(await stat(root)).isDirectory() || root === path.parse(root).root) throw Error('Choose a project directory, not a disk root.');
  const settings = await readSettings();
  if (!settings.roots.includes(root)) settings.roots.push(root);
  await mkdir(kitHome(), { recursive: true, mode: 0o700 });
  const file = path.join(kitHome(), 'config.json');
  try { await copyFile(file, file + '.backup-' + randomUUID(), constants.COPYFILE_EXCL); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await writeFile(file, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
  return settings;
}
function windowsSecret(value, decrypt) {
  const script = decrypt
    ? "$s=[Console]::In.ReadToEnd()|ConvertTo-SecureString;try{[Console]::Out.Write([System.Net.NetworkCredential]::new('', $s).Password)}finally{$s.Dispose()}"
    : "$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd()) -AsPlainText -Force;try{[Console]::Out.Write(($s|ConvertFrom-SecureString))}finally{$s.Dispose()}";
  // PowerShell 7 module paths can break Windows PowerShell 5.1 security imports.
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.toLowerCase() === 'psmodulepath') delete env[name];
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop';" + script], { input: value, encoding: 'utf8', env, windowsHide: true, timeout: 10000 });
  if (r.status !== 0 || !r.stdout.trim()) throw Error('Windows credential protection failed. Use TYPESAFE_API_KEY instead.');
  return r.stdout.trim();
}
export async function saveKey(key) {
  if (!key.trim() || /[\r\n\0]/.test(key)) throw Error('Invalid API key');
  await mkdir(kitHome(), { recursive: true, mode: 0o700 });
  const encoding = process.platform === 'win32' ? 'windows-dpapi' : 'user-file';
  const value = encoding === 'windows-dpapi' ? windowsSecret(key.trim(), false) : key.trim();
  const file = path.join(kitHome(), 'credentials.json');
  await writeFile(file, JSON.stringify({ encoding, value }), { mode: 0o600 });
  if (process.platform !== 'win32') await chmod(file, 0o600);
}
export async function loadKey() {
  if (process.env.TYPESAFE_API_KEY?.trim()) return process.env.TYPESAFE_API_KEY.trim();
  try {
    const secret = JSON.parse(await readFile(path.join(kitHome(), 'credentials.json'), 'utf8'));
    if (secret.encoding === 'windows-dpapi' && process.platform === 'win32') return windowsSecret(secret.value, true);
    if (secret.encoding === 'user-file' && process.platform !== 'win32' && typeof secret.value === 'string') return secret.value;
    throw Error('Unsupported credential storage');
  } catch (e) { if (e.code === 'ENOENT') return ''; throw Error('Cannot read kit credential. Run setup or set TYPESAFE_API_KEY.'); }
}
export async function configureRuntime() {
  const key = await loadKey();
  if (key) process.env.TYPESAFE_API_KEY = key;
  process.env.JEV_MCP_MODEL = MODEL;
  process.env.TYPESAFE_BASE_URL = 'https://api.typesafe.ai';
  process.env.JEV_MCP_TIMEOUT_MS = '30000';
  process.env.JEV_MCP_AUTO_ACCEPT = '0.9';
  delete process.env.JEV_MCP_MOCK;
  return readSettings();
}
