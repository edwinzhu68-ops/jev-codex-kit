#!/usr/bin/env node
// Separate entry: installing this gate changes the native hook definition and
// requires native review. Never silently repurpose an already-trusted reminder.
import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { workGate } from '../src/work-gate.mjs';
let event;
const expectedEvent = process.argv[3];
const denied = () => JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Work gate failed locally; no valid receipt was established. Inspect configuration without rerunning inference.' } });
// The v2 hook definition passes its own event type as a fixed argument. That
// lets tool failures deny without ever sending a tool denial to message submit.
// Unchanged v1 definitions retain their original fallback while disabled.
const denyToolEvent = () => {
  if (expectedEvent === 'PreToolUse' || (!expectedEvent && (!event || event.hook_event_name === 'PreToolUse'))) process.stdout.write(denied());
};
const timer = setTimeout(() => { denyToolEvent(); process.exit(0); }, expectedEvent === 'UserPromptSubmit' ? 2000 : 8000);
try {
  if (expectedEvent && !['UserPromptSubmit', 'PreToolUse'].includes(expectedEvent)) throw Error('HOOK_EVENT');
  const configFile = process.argv[2];
  if (!configFile || !path.isAbsolute(configFile)) throw Error('CONFIG');
  process.env.JEV_KIT_HOME = path.dirname(path.dirname(configFile));
  const configuration = await readFile(configFile, 'utf8').then(bytes => {
    try { return { config: JSON.parse(bytes) }; } catch (error) { return { error }; }
  }, error => ({ error }));
  // Recovery must not wait for the hook input stream to finish.
  if (configuration.config?.enabled === false) process.exit(0);
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) throw Error('EVENT_TOO_LARGE'); chunks.push(chunk); }
  event = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (expectedEvent && event.hook_event_name !== expectedEvent) throw Error('HOOK_EVENT_MISMATCH');
  if (configuration.error) throw configuration.error;
  const cwd = await realpath(event.cwd);
  const roots = await Promise.all(configuration.config.roots.map(r => realpath(r)));
  if (roots.some(root => { const rel = path.relative(root, cwd); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); })) {
    const output = await workGate(event); if (output) process.stdout.write(JSON.stringify(output));
  }
} catch { denyToolEvent(); }
finally { clearTimeout(timer); }
