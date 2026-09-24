#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { beginWork, reviewWork, closeWork, exceptionWork } from '../src/work-gate.mjs';
import { kitHome } from '../src/settings.mjs';
import { hashText } from '../src/skill-router.mjs';
import path from 'node:path';
try {
  const [command, file, task] = process.argv.slice(2);
  if (command === 'close') console.log(JSON.stringify(await closeWork(file, task)));
  else if (command === 'status') console.log(await readFile(path.join(kitHome(), 'auto', 'work', hashText(file) + '.json'), 'utf8'));
  else {
    if (!['prepare', 'review', 'exception'].includes(command)) throw Error('INVALID_COMMAND');
    const input = JSON.parse(await readFile(file, 'utf8'));
    console.log(JSON.stringify(await ({ prepare: beginWork, review: reviewWork, exception: exceptionWork }[command](input))));
  }
} catch (e) {
  if (Array.isArray(e.issues)) {
    console.error(JSON.stringify({ status: 'INPUT_REJECTED', inference_calls: 0,
      issues: e.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code, message: issue.message })) }));
    process.exitCode = 1;
  } else {
  // Never serialize provider exceptions (they may contain request data).
  const code = /^(ROOT_NOT_ALLOWED|PATH_NOT_ALLOWED|TASK_ID_ALREADY_ATTEMPTED|JUDGMENTS_REQUIRED|CONSTRAINTS_AND_ACCEPTANCE_REQUIRED|TASK_NOT_CURRENT|NO_VALID_JUDGMENT|STALE_SOURCE|WORK_STATE_BUSY)/.exec(e.message)?.[1];
  if (code === 'ROOT_NOT_ALLOWED') console.error('The requested root is not configured. Use the current narrower work directory and relative source paths if it is inside an authorized project. An overly broad root does not prove the actual task files are forbidden. This local scope check made no model request.');
  console.error(code ?? 'WORK_OPERATION_FAILED: inspect local status; no successful judgment was granted'); process.exitCode = 1;
  }
}
