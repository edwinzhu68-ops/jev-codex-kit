#!/usr/bin/env node
// Separate entry: installing this gate changes the native hook definition and
// requires native review. Never silently repurpose an already-trusted reminder.
import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { workGate } from '../src/work-gate.mjs';
let event;
const denied = () => JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Work gate failed locally; no valid receipt was established. Inspect configuration without rerunning inference.' } });
const timer = setTimeout(() => { process.stdout.write(denied()); process.exit(0); }, 8000);
try {
  const configFile = process.argv[2];
  if (!configFile || !path.isAbsolute(configFile)) throw Error('CONFIG');
  process.env.JEV_KIT_HOME = path.dirname(path.dirname(configFile));
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) throw Error('EVENT_TOO_LARGE'); chunks.push(chunk); }
  event = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  if (config.enabled !== false) {
    const cwd = await realpath(event.cwd);
    const roots = await Promise.all(config.roots.map(r => realpath(r)));
    if (roots.some(root => { const rel = path.relative(root, cwd); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); })) {
      const output = await workGate(event); if (output) process.stdout.write(JSON.stringify(output));
    }
  }
} catch { if (!event || event.hook_event_name === 'PreToolUse') process.stdout.write(denied()); }
finally { clearTimeout(timer); }
