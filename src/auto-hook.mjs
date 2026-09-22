import { readFile, mkdir, rmdir, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { rmdirSync } from 'node:fs';
import { hashText, assertNoSecret, routeSkills, skillCandidateSchema } from './skill-router.mjs';
import { configureRuntime } from './settings.mjs';
import { writePrivateJSON } from './private-json.mjs';

export function eligiblePrompt(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || text.length > 1800 || /^(继续|可以|好的?|开始|然后呢|同意|确认|等等|等一下|先停一下|暂停|停止|停|修好|yes|ok|continue|go ahead|wait|pause|stop)[。.!！?？\s]*$/i.test(text)) return false;
  // Conservative exclusions, not a general personal-data detector.
  if (/```|BEGIN .*KEY|\b\S+@\S+\.\S+\b|https?:\/\/\S*[?&#]|\b\d{11,}\b|(?:密码|密钥|身份证|手机号)|(?:password|secret|token)\s*[:=]/i.test(text)) return false;
  try { assertNoSecret(text); } catch { return false; }
  return !/^[\d\s+*/().=−-]+$/.test(text);
}

export function withinRoot(cwd, roots) {
  if (!path.isAbsolute(cwd)) return false;
  return roots.some(root => {
    const relative = path.relative(root, cwd);
    return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
  });
}

export async function freshSkills(config) {
  if (config.version !== 1 || !Array.isArray(config.skills) || !config.skills.length || config.skills.length > 19) throw Error('CONFIG');
  const candidates = [];
  for (const skill of config.skills) {
    if (!path.isAbsolute(skill.file) || (await stat(skill.file)).size > 128 * 1024) throw Error('SOURCE');
    const bytes = await readFile(skill.file);
    if (hashText(bytes) !== skill.sha256) throw Error('STALE');
    candidates.push(skillCandidateSchema.parse(skill.candidate));
  }
  return candidates;
}

// Only opaque IDs are emitted. Skill descriptions and user text never become
// developer instructions. The host resolves the ID against the local config.
export function hookContext(id, configFile, reviewRequired = false) {
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext:
    (reviewRequired ? 'Jev skill routing is REVIEW_REQUIRED, not an accepted recommendation. Inspect candidate ID ' : 'Jev automatic skill routing suggests candidate ID ') + JSON.stringify(id) +
    ' in local configuration ' + JSON.stringify(configFile) +
    '. This is advisory, not authorization or task acceptance. Resolve that ID locally, confirm the skill is available and applicable under current host rules, and read its SKILL.md before use. Preserve explicit skill requirements and ongoing task context. Continue authorized work without asking the user to name Jev or launch it. Keep routine auxiliary judgments quiet; report material blockers or limitations. Do not repeat this skill-selection judgment through another route.' } };
}

export function workflowContext() {
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext:
    'Jev pre-work guidance (local, zero model calls): before each substantive task or independent work package, prepare bounded semantic judgments for Jev before doing that sorting yourself, whether the main host will execute or delegate. Every different subagent assignment needs its own task_id, goal, evidence scope, constraints, acceptance and preparation; never reuse another task\'s judgments even with shared files. For unresolved grouping/checks, use one available work-preparation/evidence route with minimal authorized originals. Preserve unknowns and all requirements; the host resolves conflicts and ownership. Pass the packet, source hashes and receipt to subagents only for that same task; do not repeat unchanged same-task judgments. Exact searches, calculations, known steps and simple fixes stay local. Jev does not generate plans, choose an executor, authorize actions or prove correctness. Codex owns architecture, execution and final acceptance. Do not look up hook configuration, acknowledge this notice or call Jev merely because it appeared. This reminder is not evidence that Jev ran.' } };
}

export async function runAutoHook(event, configFile, {
  route = routeSkills, configure = configureRuntime, now = () => new Date(),
} = {}) {
  if (event.hook_event_name !== 'UserPromptSubmit' || !eligiblePrompt(event.prompt) || typeof event.session_id !== 'string' || !event.session_id || typeof event.cwd !== 'string') return null;
  const home = path.dirname(configFile);
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  if (config.enabled === false) return null;
  if (!Array.isArray(config.roots) || config.roots.some(r => typeof r !== 'string' || !path.isAbsolute(r))) return null;
  // macOS /var aliases and Windows short paths must resolve to the same scope;
  // conversely a junction inside an allowed root must not authorize its outside target.
  const canonicalCwd = await realpath(event.cwd);
  if (!withinRoot(canonicalCwd, config.roots)) return null;
  const session = hashText(event.session_id), goal = hashText(event.prompt.trim());
  const sessions = path.join(home, 'sessions');
  await mkdir(sessions, { recursive: true, mode: 0o700 });
  const record = async value => {
    const content = { at: now().toISOString(), session, prompt_sha256: goal, ...value };
    await writePrivateJSON(path.join(sessions, session + '.last.json'), content);
    // The task record is authoritative. Windows may deny simultaneous renames
    // onto the optional global index; that must not relabel a valid judgment.
    try { await writePrivateJSON(path.join(home, 'last-run.json'), content); } catch {}
  };
  const lock = path.join(sessions, session + '.lock');
  try { await mkdir(lock); } catch (e) { if (e.code === 'EEXIST') return null; throw e; }
  const cleanup = () => { try { rmdirSync(lock); } catch {} };
  process.once('exit', cleanup);
  let state = { version: 2, count: 0, decisions: [], legacy_goals: [] };
  const stateFile = path.join(sessions, session + '.json');
  try {
    try { state = JSON.parse(await readFile(stateFile, 'utf8')); }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      // Preserve old attempted prompts and receipts. Retire the accidental
      // session-wide ban without replaying its unchanged failed judgment.
      try {
        const old = JSON.parse(await readFile(path.join(home, 'state.json'), 'utf8')).sessions?.[session];
        if (old) { state.legacy_goals = old.goals ?? []; state.count = old.count ?? 0; }
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    const candidates = await freshSkills(config);
    // Legacy configurations keep their explicitly installed skill router. New
    // setups use a local pre-work hint on each eligible prompt; no Jev call.
    const mode = config.mode ?? 'skills';
    if (!['workflow', 'skills'].includes(mode)) throw Error('CONFIG');
    if (mode === 'workflow') {
      const hint = hashText(JSON.stringify({ workflow_hint: 1, skills: config.skills.map(s => [s.file, s.sha256]) }));
      if (state.decisions.includes(hint)) {
        await record({ status: 'WORKFLOW_REMINDER', mode, model: null, metrics: { workflow_inference_calls: 0, question_count: 0 } });
        return workflowContext();
      }
      state.decisions.push(hint);
      await writePrivateJSON(stateFile, state);
      await record({ status: 'WORKFLOW_HINT', mode, model: null, metrics: { workflow_inference_calls: 0, question_count: 0 } });
      return workflowContext();
    }
    const decision = hashText(JSON.stringify({ goal, skills: config.skills.map(s => [s.file, s.sha256, s.candidate]) }));
    if (state.legacy_goals.includes(goal) || state.decisions.includes(decision)) { await record({ status: 'SKIPPED_REPEAT' }); return null; }
    // One attempt per unchanged input. No artificial daily/session quota.
    state.count++; state.decisions.push(decision);
    await writePrivateJSON(stateFile, state);
    try {
      await configure();
      const result = await route({ goal: event.prompt.trim(), candidates }, { signal: AbortSignal.timeout(5000), receiptRoot: path.join(home, 'receipts') });
      await freshSkills(config);
      await record({ status: result.status, model: result.model, metrics: result.metrics, usage: result.usage });
      const selected = result.recommendation?.id;
      if (result.status === 'SUGGESTED' && candidates.some(c => c.id === selected && c.enabled)) return hookContext(selected, configFile);
      // Uncertain selection is evidence for the host to inspect, never approval.
      // A real route can pick UI strongly but fail the separate applicability
      // threshold. Silently hiding that result defeats advisory collaboration.
      const tentative = result.selection?.choice;
      if (result.status === 'REVIEW_REQUIRED' && candidates.some(c => c.id === tentative && c.enabled)) return hookContext(tentative, configFile, true);
      return null;
    } catch (e) {
      await record({ status: e.message === 'STALE' ? 'STALE_SKILLS' : 'ERROR_DECISION_STOPPED' });
      return null;
    }
  } catch (e) {
    await record({ status: e.message === 'STALE' ? 'STALE_SKILLS' : 'LOCAL_CONFIGURATION_ERROR' });
    return null;
  } finally { process.removeListener('exit', cleanup); await rmdir(lock); }
}
