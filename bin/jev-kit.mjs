#!/usr/bin/env node
import { readFile, writeFile, mkdir, access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { addRoot, readSettings, loadKey, saveKey, configureRuntime, kitHome } from '../src/settings.mjs';
import { clientConfig, installClient, skillContent, serverSpec } from '../src/clients.mjs';

const entry = fileURLToPath(import.meta.url);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const argv = process.argv.slice(2);
const command = argv.shift() || 'help';
const help = `Jev Coding Kit 0.4.0 (repository/package: jev-codex-kit)
  setup --root PATH [--client CLIENT,...] [--no-key-prompt]
                                             Authorize project and install selected clients
  Clients: codex, claude, cursor, opencode, pi, vscode, none
  --codex                                    Compatibility alias for --client codex
  doctor                                      Local checks only; no paid request
  serve                                       Start stdio MCP with all 12 tools
  call TOOL INPUT.json NEW_OUTPUT.json         Invoke one tool; refuse existing output
  config [--client CLIENT]                     Export client-specific configuration (no key)
  skills catalog DIRECTORY NEW_CATALOG.json   Inspect direct skill folders offline
  skills suggest CATALOG.json GOAL NEW.json [--ids ID,ID]
                                             Route a bounded, fresh skill catalog
  auto install SPEC.json                     Install silent Codex submit hook (native trust required)
  auto status                                Read last private automatic routing status
  ui start                                   Start bounded local API broker silently
  ui install                                 Install the Codex UI loop skill
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
  const spec = serverSpec();
  const version = runCodex(['--version']);
  if (version.status !== 0) throw Error('Codex CLI not found. Run config for a manual MCP entry.');
  await mkdir(process.env.CODEX_HOME || path.join(homedir(), '.codex'), { recursive: true });
  const existing = runCodex(['mcp', 'get', 'jev-kit', '--json']);
  if (existing.status === 0) {
    const data = JSON.parse(existing.stdout);
    if (data.transport?.command !== process.execPath || JSON.stringify(data.transport?.args) !== JSON.stringify([entry, 'serve'])) throw Error('A different jev-kit registration exists. It was not overwritten.');
    if ((data.transport?.env?.JEV_KIT_HOME || undefined) !== spec.env?.JEV_KIT_HOME) throw Error('Existing Codex storage configuration differs; merge config --client codex manually.');
  } else {
    const added = runCodex(['mcp', 'add', 'jev-kit', ...(spec.env ? ['--env', 'JEV_KIT_HOME=' + spec.env.JEV_KIT_HOME] : []), '--', process.execPath, entry, 'serve']);
    if (added.status !== 0) throw Error('Codex registration failed. Run config for a manual MCP entry.');
  }
  const target = path.join(homedir(), '.agents', 'skills', 'jev-codex-kit');
  await mkdir(target, { recursive: true });
  const content = await skillContent();
  const skill = path.join(target, 'SKILL.md');
  try { await writeFile(skill, content, { flag: 'wx' }); }
  catch (e) { if (e.code !== 'EEXIST' || await readFile(skill, 'utf8') !== content) throw Error('Existing skill was preserved; install the bundled skill manually if needed.'); }
  await installUISkill();
  console.log('Codex MCP registered as jev-kit; dedicated skills installed. Open a new task if current tools are stale.');
}
async function installUISkill() {
  const directory=path.join(homedir(),'.agents','skills','jev-ui');
  const text=(await readFile(path.join(packageRoot,'skills','jev-ui','SKILL.md'),'utf8')).replaceAll('{{KIT_ROOT}}',packageRoot.replaceAll('\\','/')).replaceAll('file:///ABSOLUTE/KIT',pathToFileURL(packageRoot.replace(/[\\/]$/,'')).href);
  await mkdir(directory,{recursive:true});
  const target=path.join(directory,'SKILL.md');
  try{await writeFile(target,text,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||await readFile(target,'utf8')!==text)throw Error('Existing jev-ui skill preserved; review an explicit upgrade.');}
  return {skill:target};
}
async function main() {
  if (['help','--help','-h'].includes(command)) { console.log(help); return; }
  if (command === 'ui' && argv.length === 1 && argv[0] === 'start') {
    const {startUIBroker}=await import('../src/ui-broker-start.mjs');
    console.log(JSON.stringify(await startUIBroker())); return;
  }
  if (command === 'ui' && argv.length === 1 && argv[0] === 'install') {console.log(JSON.stringify(await installUISkill()));return;}
  if (command === 'auto') {
    if (argv[0] === 'install' && argv.length === 2) {
      const { installAuto } = await import('../src/auto-install.mjs');
      console.log(JSON.stringify(await installAuto(JSON.parse(await readFile(argv[1], 'utf8'))), null, 2));
    } else if (argv[0] === 'status' && argv.length === 1) {
      try { console.log(await readFile(path.join(kitHome(), 'auto', 'last-run.json'), 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; console.log(JSON.stringify({ status: 'NO_OBSERVED_RUN', hint: 'Installation does not prove native trust or current client support.' })); }
    } else throw Error('Use auto install SPEC.json or auto status');
    return;
  }
  if (command === 'skills') {
    const [action, ...args] = argv;
    const { collectSkillCatalog, catalogInput } = await import('../src/skill-catalog.mjs');
    if (action === 'catalog' && args.length === 2) {
      const catalog = await collectSkillCatalog(args[0]);
      await writeFile(args[1], JSON.stringify(catalog, null, 2), { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ output: path.resolve(args[1]), candidates: catalog.candidates.length, excluded: catalog.excluded.length, network_requests: 0 }));
      return;
    }
    if (action !== 'suggest' || ![3,5].includes(args.length) || (args.length === 5 && args[3] !== '--ids')) throw Error('Use skills catalog DIRECTORY NEW.json or skills suggest CATALOG.json GOAL NEW.json [--ids ID,ID]');
    const [file, goal, output] = args;
    const ids = args.length === 5 ? args[4].split(',') : undefined;
    const { input, catalog_coverage } = await catalogInput(file, goal, ids);
    await writeFile(output, JSON.stringify({ status: 'STARTING' }), { flag: 'wx', mode: 0o600 });
    try {
      await configureRuntime();
      const { routeSkills } = await import('../src/skill-router.mjs');
      const result = await routeSkills(input, { signal: AbortSignal.timeout(35000) });
      try { await catalogInput(file, goal, ids); }
      catch { result.status = 'STALE_CATALOG'; result.recommendation = null; result.required = []; }
      result.catalog_coverage = catalog_coverage;
      result.source_validation = result.status === 'STALE_CATALOG' ? 'stale' : 'fresh_at_readback';
      const receipt = JSON.parse(await readFile(result.receipt_path, 'utf8'));
      receipt.result = result;
      await writeFile(result.receipt_path, JSON.stringify(receipt, null, 2));
      await writeFile(output, JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ output: path.resolve(output), status: result.status }));
    } catch {
      await writeFile(output, JSON.stringify({ status: 'ERROR', message: 'No skill decision. Check input, catalog freshness, limits, credential and service.' }));
      throw Error('Skill routing failed; no valid recommendation.');
    }
    return;
  }
  if (command === 'config') {
    if(argv.length && (argv.length!==2||argv[0]!=='--client'))throw Error('config [--client CLIENT]');
    const client=option('--client')||'generic',config=clientConfig(client);
    if(client==='codex'){
      const spec=config.mcp_servers['jev-kit'];
      console.log('[mcp_servers.jev-kit]\ncommand = '+JSON.stringify(spec.command)+'\nargs = '+JSON.stringify(spec.args)+(spec.env?'\n[mcp_servers.jev-kit.env]\nJEV_KIT_HOME = '+JSON.stringify(spec.env.JEV_KIT_HOME):''));
    }else console.log(JSON.stringify(config,null,2));
    return;
  }
  if (command === 'setup') {
    const known = new Set(['--root','--client','--codex','--no-key-prompt']);
    for (let i = 0; i < argv.length; i++) { if (!known.has(argv[i])) throw Error('Unknown setup option'); if (['--root','--client'].includes(argv[i])) {if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing option value');i++;} }
    if(argv.includes('--codex')&&argv.includes('--client'))throw Error('Use --client or --codex, not both.');
    let selected=argv.includes('--codex')?'codex':option('--client');
    if(!selected&&process.stdin.isTTY){
      const rl=createInterface({input:process.stdin,output:process.stdout});
      try{selected=(await rl.question('Coding tool [codex/claude/cursor/opencode/pi/vscode/none; comma-separated, default codex]: ')).trim()||'codex';}finally{rl.close();}
    }
    const clients=[...new Set((selected||'none').split(',').map(s=>s.trim().toLowerCase()))];
    if(clients.some(c=>!['none','codex','claude','cursor','opencode','pi','vscode'].includes(c))||(clients.includes('none')&&clients.length>1))throw Error('Invalid client selection. Use codex, claude, cursor, opencode, pi, vscode, or none.');
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
    for(const client of clients){
      if(client==='none')continue;
      if(client==='codex')await registerCodex();
      else console.log(JSON.stringify(await installClient(client,{root:await realpath(root)})));
    }
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
