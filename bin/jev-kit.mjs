#!/usr/bin/env node
import { readFile, writeFile, mkdir, access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { addRoot, readSettings, loadKey, saveKey, configureRuntime, kitHome } from '../src/settings.mjs';

const entry = fileURLToPath(import.meta.url);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const argv = process.argv.slice(2);
const command = argv.shift() || 'help';
const help = `Jev Codex Kit 0.1.0
  setup --root PATH [--codex] [--no-key-prompt]  Authorize a project; optionally register Codex and install skill
  doctor                                      Local checks only; no paid request
  serve                                       Start stdio MCP with all 11 tools
  call TOOL INPUT.json NEW_OUTPUT.json         Invoke one tool; refuse existing output
  config                                      Print portable MCP configuration (no key)
  help
Use your own TypeSafe API key. Keep this installation folder after registering.
`;
function option(name) { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; }
function runCodex(args) {
  // Windows .cmd wrappers require a shell; reject command metacharacters first.
  if (process.platform === 'win32') {
    const items = ['codex', ...args];
    if (items.some(x => /["\r\n&|<>^%!]/.test(x))) throw Error('Unsafe characters for Windows Codex launcher; use the config command instead.');
    return spawnSync(items.map(x => '"' + x + '"').join(' '), { shell: true, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  }
  return spawnSync('codex', args, { encoding: 'utf8', timeout: 15000 });
}
function mcpConfig() { return { mcpServers: { 'jev-kit': { command: process.execPath, args: [entry, 'serve'] } } }; }
async function hiddenKey() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw Error('Set TYPESAFE_API_KEY or run setup in an interactive terminal.');
  process.stdout.write('TypeSafe API Key (hidden; Enter skips): ');
  const previous = process.stdin.isRaw;
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (error) => {
      process.stdin.off('data', onData); process.stdin.setRawMode(previous); process.stdin.pause();
      process.stdout.write('\n'); error ? reject(error) : resolve(value);
    };
    const onData = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === '\u0003') return done(Error('Cancelled'));
        if (c === '\r' || c === '\n') return done();
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else if (c >= ' ') value += c;
      }
    };
    process.stdin.on('data', onData);
  });
}
async function registerCodex() {
  const version = runCodex(['--version']);
  if (version.status !== 0) throw Error('Codex CLI not found. Run config for a manual MCP entry.');
  await mkdir(process.env.CODEX_HOME || path.join(homedir(), '.codex'), { recursive: true });
  const existing = runCodex(['mcp', 'get', 'jev-kit', '--json']);
  if (existing.status === 0) {
    const data = JSON.parse(existing.stdout);
    if (data.transport?.command !== process.execPath || JSON.stringify(data.transport?.args) !== JSON.stringify([entry, 'serve'])) throw Error('A different jev-kit registration exists. It was not overwritten.');
  } else {
    const added = runCodex(['mcp', 'add', 'jev-kit', '--', process.execPath, entry, 'serve']);
    if (added.status !== 0) throw Error('Codex registration failed. Run config for a manual MCP entry.');
  }
  const target = path.join(homedir(), '.agents', 'skills', 'jev-codex-kit');
  await mkdir(target, { recursive: true });
  const content = (await readFile(path.join(packageRoot, 'skills', 'jev-codex-kit', 'SKILL.md'), 'utf8')).replaceAll('__KIT_ENTRY__', entry.replaceAll('\\', '/'));
  const skill = path.join(target, 'SKILL.md');
  try { await writeFile(skill, content, { flag: 'wx' }); }
  catch (e) { if (e.code !== 'EEXIST' || await readFile(skill, 'utf8') !== content) throw Error('Existing skill was preserved; install the bundled skill manually if needed.'); }
  console.log('Codex MCP registered as jev-kit; dedicated skill installed. Open a new task if current tools are stale.');
}
async function main() {
  if (['help','--help','-h'].includes(command)) { console.log(help); return; }
  if (command === 'config') { console.log(JSON.stringify(mcpConfig(), null, 2)); return; }
  if (command === 'setup') {
    const known = new Set(['--root','--codex','--no-key-prompt']);
    for (let i = 0; i < argv.length; i++) { if (!known.has(argv[i])) throw Error('Unknown setup option'); if (argv[i] === '--root') i++; }
    let root = option('--root');
    if (!root && process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try { root = await rl.question('Project directory to authorize: '); } finally { rl.close(); }
    }
    if (!root || root.startsWith('--')) throw Error('setup requires --root PATH');
    await addRoot(root);
    if (!await loadKey() && !argv.includes('--no-key-prompt')) {
      console.log('Credentials: Windows uses current-user DPAPI; macOS/Linux use a local mode-0600 file outside the project. Alternatively set TYPESAFE_API_KEY.');
      const key = await hiddenKey(); if (key) await saveKey(key);
    }
    if (argv.includes('--codex')) await registerCodex();
    console.log('Setup saved in ' + kitHome() + '. Run doctor to check it.');
    return;
  }
  if (command === 'doctor') {
    const settings = await readSettings();
    const roots = await Promise.all(settings.roots.map(async r => { try { await realpath(r); return { path: r, exists: true }; } catch { return { path: r, exists: false }; } }));
    const built = await access(path.join(packageRoot,'vendor/jev-mcp/dist/tools/evaluate.js')).then(()=>true,()=>false);
    const rg = spawnSync('rg', ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const keyPresent = Boolean(await loadKey());
    const ready = built && keyPresent && roots.length > 0 && roots.every(r=>r.exists) && rg.status === 0;
    console.log(JSON.stringify({ status: ready ? 'READY' : 'SETUP_REQUIRED', node: process.version, built, key_present: keyPresent, ripgrep: rg.status === 0, roots, storage: kitHome(), network_requests: 0, note: 'Local readiness only; not a live API or semantic quality test.' }, null, 2));
    if (!ready) process.exitCode = 1;
    return;
  }
  if (command === 'serve') {
    if (argv.length) throw Error('serve takes no arguments');
    await configureRuntime();
    const { serve } = await import('../src/server.mjs'); await serve(); return;
  }
  if (command === 'call') {
    if (argv.length !== 3) throw Error('call requires TOOL INPUT.json NEW_OUTPUT.json');
    const [name, inputFile, outputFile] = argv;
    const input = JSON.parse((await readFile(inputFile, 'utf8')).replace(/^\uFEFF/, ''));
    await configureRuntime();
    const { toolCatalog, executeTool } = await import('../src/tools.mjs');
    const catalog = await toolCatalog();
    if (!catalog.has(name)) throw Error('Unknown tool');
    await writeFile(outputFile, JSON.stringify({status:'STARTING'}), { flag: 'wx', mode: 0o600 });
    try {
      const result = await executeTool(catalog, name, input, AbortSignal.timeout(35000));
      await writeFile(outputFile, JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ output: path.resolve(outputFile), status: result.status ?? result.action ?? 'RESULT' }));
    } catch {
      await writeFile(outputFile, JSON.stringify({status:'ERROR',message:'No valid verdict. Check root, input, limits, credentials and service.'}));
      throw Error('Call failed; details withheld to protect credentials. The output records failure.');
    }
    return;
  }
  throw Error('Unknown command. Run help.');
}
main().catch(error => {
  // These messages are local fixed strings / Node file errors, never raw provider errors.
  console.error(error.code === 'EEXIST' ? 'Output already exists; choose a new output path.' : error.message);
  process.exitCode = 1;
});
