import { readFile, mkdir, realpath, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { hashText } from './skill-router.mjs';
import { writePrivateJSON } from './private-json.mjs';
import { prepareWork, workPreparationSchema } from './work-preparation.mjs';
import { configureRuntime, kitHome } from './settings.mjs';

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/);
const action = z.object({ tool_name: z.string().min(1), tool_input: z.unknown() }).strict();
export const gateRequestSchema = z.object({
  session_id: z.string().min(1).max(200), work: workPreparationSchema,
}).strict();
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
export const actionHash = a => hashText(JSON.stringify(stable(a)));
const base = home => path.join(home, 'auto', 'work');
const sessionPath = (home, session) => path.join(base(home), hashText(session) + '.json');
async function readJSON(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function sessionState(home, session) {
  try { return await readJSON(sessionPath(home, session)); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return { version: 1, tasks: {}, active: null, revision: 0 }; }
}
async function audit(home, session, record) {
  await mkdir(base(home), { recursive: true, mode: 0o700 });
  await appendFile(path.join(base(home), hashText(session) + '.events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...record }) + '\n', { mode: 0o600 });
}
async function locked(home, session, fn) {
  await mkdir(base(home), { recursive: true, mode: 0o700 });
  const lock = sessionPath(home, session) + '.lock';
  try { await mkdir(lock); } catch (e) { if (e.code === 'EEXIST') throw Error('WORK_STATE_BUSY'); throw e; }
  try { return await fn(); } finally { const { rmdir } = await import('node:fs/promises'); await rmdir(lock); }
}
export async function beginWork(raw, { home = kitHome(), prepare = prepareWork, configure = configureRuntime } = {}) {
  const input = gateRequestSchema.parse(raw), { session_id, work } = input;
  // No inference-free work packet can silently satisfy the execution gate.
  if (!work.labels && !work.checks.length) throw Error('JUDGMENTS_REQUIRED: supply task-specific groups or relationship checks');
  if (!work.constraints.length || !work.acceptance.length) throw Error('CONSTRAINTS_AND_ACCEPTANCE_REQUIRED');
  return locked(home, session_id, async () => {
    const state = await sessionState(home, session_id), key = work.task_id;
    if (state.tasks[key]) throw Error('TASK_ID_ALREADY_ATTEMPTED: inspect its receipt; changed work needs a new revision ID');
    const record = { task_id: key, work, status: 'COLLECTED', revision: state.revision, actions: [], created_at: new Date().toISOString() };
    state.tasks[key] = record; state.active = key;
    await writePrivateJSON(sessionPath(home, session_id), state);
    await audit(home, session_id, { task_id: key, status: 'COLLECTED' });
    try {
      const settings = await configure();
      const packet = await prepare(work, { allowedRoots: settings.roots, receiptRoot: path.join(home, 'runs', 'work') });
      if (packet.metrics.workflow_inference_calls !== 1 || packet.metrics.question_count < 1 || packet.model !== 'jev-1.13.0') throw Error('NO_REAL_JUDGMENT');
      if (packet.stale_sources.length) throw Error('STALE_SOURCE');
      record.packet_path = packet.packet_path;
      record.packet_sha256 = hashText(await readFile(packet.packet_path));
      record.receipt_path = packet.receipt_path;
      record.receipt_sha256 = hashText(await readFile(packet.receipt_path));
      record.status = packet.judgment_state;
      await writePrivateJSON(sessionPath(home, session_id), state);
      await audit(home, session_id, { task_id: key, status: record.status, model: packet.model, metrics: packet.metrics, packet_path: packet.packet_path });
      return packet;
    } catch (e) {
      record.status = 'DEGRADED'; record.reason = 'PREPARATION_FAILED';
      await writePrivateJSON(sessionPath(home, session_id), state);
      await audit(home, session_id, { task_id: key, status: 'DEGRADED', reason: record.reason });
      throw e;
    }
  });
}
async function verifyRecord(record) {
  if (!['JEV_JUDGED', 'REVIEW_REQUIRED'].includes(record.status)) throw Error('NO_VALID_JUDGMENT');
  if (hashText(await readFile(record.packet_path)) !== record.packet_sha256 || hashText(await readFile(record.receipt_path)) !== record.receipt_sha256) throw Error('RECEIPT_CHANGED');
  const packet = await readJSON(record.packet_path);
  if (packet.task_id !== record.task_id || packet.model !== 'jev-1.13.0' || packet.metrics.workflow_inference_calls !== 1 || packet.metrics.question_count < 1) throw Error('INVALID_RECEIPT');
  for (const source of packet.source_index) {
    const resolved = await realpath(path.resolve(packet.root, source.path));
    const relative = path.relative(await realpath(packet.root), resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative) || hashText(await readFile(resolved)) !== source.file_sha256) throw Error('STALE_SOURCE');
  }
  return packet;
}
// Review is a host decision with an explanation, never a second model vote.
export async function reviewWork(raw, { home = kitHome() } = {}) {
  const input = z.object({ session_id: z.string().min(1), task_id: id,
    disposition: z.enum(['adopt', 'retain_for_inspection', 'override']),
    explanation: z.string().min(10).max(4000), actions: z.array(action).min(1).max(30),
  }).strict().parse(raw);
  return locked(home, input.session_id, async () => {
    const state = await sessionState(home, input.session_id), record = state.tasks[input.task_id];
    if (!record || record.revision !== state.revision) throw Error('TASK_NOT_CURRENT');
    await verifyRecord(record);
    const assignments = input.actions.filter(a => /(?:^|[._])(?:spawn_agent|followup_task|send_input|send_message|send_message_to_thread)$/.test(a.tool_name));
    const assignmentHashes = [...new Set(assignments.map(actionHash))];
    if (assignmentHashes.length > 1 || (record.assignment_sha256 && assignmentHashes.some(h => h !== record.assignment_sha256))) throw Error('DIFFERENT_ASSIGNMENT_REQUIRES_NEW_TASK');
    if (assignmentHashes.length) record.assignment_sha256 = assignmentHashes[0];
    record.review = { disposition: input.disposition, explanation: input.explanation };
    record.actions = input.actions.map(a => ({ hash: actionHash(a), used: false }));
    state.active = input.task_id;
    await writePrivateJSON(sessionPath(home, input.session_id), state);
    await audit(home, input.session_id, { task_id: input.task_id, status: 'HOST_REVIEWED', review: record.review, action_count: record.actions.length });
    return { status: 'HOST_REVIEWED', task_id: input.task_id, action_count: record.actions.length };
  });
}
export async function closeWork(session, task, { home = kitHome() } = {}) {
  id.parse(task);
  return locked(home, session, async () => {
    const state = await sessionState(home, session), record = state.tasks[task];
    if (!record) throw Error('UNKNOWN_TASK');
    record.closed = true; record.actions = [];
    if (state.active === task) state.active = null;
    await writePrivateJSON(sessionPath(home, session), state);
    await audit(home, session, { task_id: task, status: 'CLOSED' });
    return { status: 'CLOSED', task_id: task };
  });
}
// Pure parsing only. Reject shell syntax, substitutions, redirects and multiline
// commands instead of claiming that an arbitrary shell program is read-only.
export function simpleWords(command) {
  if (typeof command !== 'string' || /[\r\n;|&<>`$]/.test(command)) return null;
  const words = command.match(/"[^"\r\n]*"|'[^'\r\n]*'|[^\s"']+/g);
  if (!words || words.join(' ').replace(/\s+/g, ' ') !== command.trim().replace(/\s+/g, ' ')) return null;
  return words.map(w => /^['"]/.test(w) ? w.slice(1, -1) : w);
}
export async function exceptionWork(raw, { home = kitHome() } = {}) {
  const input = z.object({ session_id: z.string().min(1), task_id: id,
    kind: z.enum(['pure_calculation', 'mechanical_step', 'data_not_authorized', 'service_unavailable']),
    explanation: z.string().min(20).max(4000), actions: z.array(action).min(1).max(30),
  }).strict().parse(raw);
  return locked(home, input.session_id, async () => {
    const state = await sessionState(home, input.session_id);
    let record = state.tasks[input.task_id];
    if (input.kind === 'service_unavailable' && record?.status !== 'DEGRADED') throw Error('NO_FAILED_ATTEMPT');
    if (record && record.status !== 'DEGRADED') throw Error('EXISTING_JUDGMENT_MUST_BE_REVIEWED');
    record ??= { task_id: input.task_id, revision: state.revision };
    if (record.revision !== state.revision) throw Error('TASK_NOT_CURRENT');
    record.status = ['data_not_authorized', 'service_unavailable'].includes(input.kind) ? 'DEGRADED' : 'EXEMPT';
    record.exception = { kind: input.kind, explanation: input.explanation };
    record.actions = input.actions.map(a => ({ hash: actionHash(a), used: false }));
    state.tasks[input.task_id] = record; state.active = input.task_id;
    await writePrivateJSON(sessionPath(home, input.session_id), state);
    await audit(home, input.session_id, { task_id: input.task_id, status: record.status, exception: record.exception });
    return { status: record.status, task_id: input.task_id, actual_judgment: false };
  });
}
function collectionCall(event) {
  if (['wait', 'wait_agent', 'list_agents', 'get_goal'].includes(event.tool_name)) return true;
  if (event.tool_name !== 'Bash') return false;
  const words = simpleWords(event.tool_input?.command ?? event.tool_input?.cmd);
  if (!words) return false;
  const command = words[0].toLowerCase();
  if (['get-content', 'get-item', 'get-childitem', 'get-location', 'resolve-path', 'pwd', 'cat'].includes(command)) return !words.some(w => /^-(?:outvariable|ov|pipelinevariable|pv)$/i.test(w));
  if (command === 'rg') return !words.some(w => /^--(pre|hostname-bin)(=|$)/.test(w));
  if (command === 'git') return ['status', 'diff', 'log', 'show', 'ls-files'].includes(words[1]) && !words.some(w => /ext-diff|textconv|output|--exec|--open-files-in-pager/.test(w));
  const entry = fileURLToPath(new URL('../bin/jev-work.mjs', import.meta.url));
  return (command === 'node' || path.resolve(words[0]) === process.execPath) && words[1] && path.resolve(words[1]) === entry
    && ['prepare', 'review', 'exception', 'close', 'status'].includes(words[2]) && words.length === (words[2] === 'close' ? 5 : 4);
}
function preparationPatch(event, home) {
  if (event.tool_name !== 'apply_patch') return false;
  const text = typeof event.tool_input === 'string' ? event.tool_input : event.tool_input?.command;
  if (typeof text !== 'string' || !text.startsWith('*** Begin Patch\n') || !text.trimEnd().endsWith('*** End Patch')) return false;
  const lines = text.trimEnd().split('\n').slice(1, -1); let files = 0;
  for (const line of lines) {
    if (line.startsWith('*** Add File: ')) {
      const file = path.resolve(line.slice(14));
      if (path.dirname(file) !== path.join(home, 'auto', 'inbox') || !/^[a-zA-Z0-9_.-]+\.json$/.test(path.basename(file))) return false;
      files++;
    } else if (!line.startsWith('+')) return false;
  }
  return files > 0;
}
const context = (event, message, deny = false) => ({ hookSpecificOutput: {
  hookEventName: event.hook_event_name,
  ...(deny ? { permissionDecision: 'deny', permissionDecisionReason: message } : { additionalContext: message }),
} });
export async function workGate(event, { home = kitHome() } = {}) {
  if (!['UserPromptSubmit', 'PreToolUse'].includes(event.hook_event_name)) return null;
  if (typeof event.session_id !== 'string' || !event.session_id) return context(event, 'Missing session identity; task preparation cannot be verified.', event.hook_event_name === 'PreToolUse');
  if (event.hook_event_name === 'UserPromptSubmit') {
    return locked(home, event.session_id, async () => {
      const state = await sessionState(home, event.session_id);
      const continuation = /^(继续|开始|修好|continue|go ahead)[。.!！?？\s]*$/i.test(event.prompt?.trim() ?? '');
      const current = state.tasks[state.active];
      // Keep same-task continuation, including a degraded task: never reroll it.
      if (!continuation || !current || current.closed) { state.revision++; state.active = null; }
      state.prompt_sha256 = hashText(event.prompt ?? '');
      await writePrivateJSON(sessionPath(home, event.session_id), state);
      await audit(home, event.session_id, { status: 'TASK_BOUNDARY', revision: state.revision, continuation: continuation && !!state.active, prompt_sha256: state.prompt_sha256 });
      return context(event, 'Every new substantive work package needs a real task-specific judgment before execution. Gather only necessary authorized sources, prepare with jev-work.mjs, inspect the result and bind exact next calls with review. A continuation reuses only the still-open same task; close it before the next task. No prompt text was sent to a model by this hook.');
    });
  }
  if (collectionCall(event) || preparationPatch(event, home)) return null;
  return locked(home, event.session_id, async () => {
    const state = await sessionState(home, event.session_id), record = state.tasks[state.active];
    let reason = 'NO_TASK_RECEIPT';
    try {
      if (!record || record.closed || record.revision !== state.revision || (!record.review && !record.exception)) throw Error('NO_REVIEWED_TASK');
      if (!record.exception) await verifyRecord(record);
      const digest = actionHash({ tool_name: event.tool_name, tool_input: event.tool_input });
      const bound = record.actions.find(a => a.hash === digest && !a.used);
      if (!bound) throw Error('UNBOUND_ACTION: a different assignment needs its own task and judgment');
      // One-shot action binding prevents another assignment from borrowing it.
      bound.used = true;
      await writePrivateJSON(sessionPath(home, event.session_id), state);
      await audit(home, event.session_id, { task_id: record.task_id, status: record.exception ? 'EXCEPTION_EXECUTION' : 'EXECUTION_CHECK_PASSED', tool_name: event.tool_name, action_sha256: digest });
      return context(event, record.exception
        ? `Task ${record.task_id} proceeds under explicit ${record.status}: ${record.exception.kind}. This is NOT a successful Jev judgment. Report this limitation.`
        : `Task ${record.task_id} has a real judgment and host review. This check is not authorization or task acceptance.`);
    } catch (e) { reason = /^[A-Z_: a-z-]+$/.test(e.message) ? e.message : 'RECEIPT_VALIDATION_FAILED'; }
    await audit(home, event.session_id, { task_id: record?.task_id ?? null, status: 'EXECUTION_BLOCKED', tool_name: event.tool_name, reason });
    const entry = fileURLToPath(new URL('../bin/jev-work.mjs', import.meta.url));
    return context(event, `Task preparation required (${reason}). Session: ${event.session_id}. Read ${fileURLToPath(new URL('../docs/execution-gate.md', import.meta.url))}. Gather minimal evidence with simple reads; use apply_patch to add JSON inputs under ${path.join(home, 'auto', 'inbox')}. Run node "${entry}" prepare INPUT.json, inspect its full receipt, then review REVIEW.json binding this task's exact calls. Do not reroll a failed judgment or reuse another task.`, true);
  });
}
