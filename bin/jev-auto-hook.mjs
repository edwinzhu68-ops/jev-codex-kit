#!/usr/bin/env node
// Native Codex UserPromptSubmit handler: exit zero and no stderr on every path.
// No shell, browser, transcript, repository scan, or user-facing announcement.
const deadline = setTimeout(() => process.exit(0), 8000);
try {
  const { default: path } = await import('node:path');
  if (!process.argv[2] || !path.isAbsolute(process.argv[2])) process.exit(0);
  process.env.JEV_KIT_HOME = path.dirname(path.dirname(process.argv[2]));
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 64 * 1024) process.exit(0);
    chunks.push(chunk);
  }
  const { runAutoHook } = await import('../src/auto-hook.mjs');
  const output = await runAutoHook(JSON.parse(Buffer.concat(chunks).toString('utf8')), process.argv[2]);
  if (output) process.stdout.write(JSON.stringify(output));
} catch { /* Fail open; never expose provider errors or credentials. */ }
finally { clearTimeout(deadline); }
