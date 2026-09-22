import { readFile, writeFile, mkdir, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { rmdirSync } from 'node:fs';
import { hashText, assertNoSecret, routeSkills, skillCandidateSchema } from './skill-router.mjs';
import { configureRuntime } from './settings.mjs';

export function eligiblePrompt(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || text.length > 1800 || /^(继续|可以|好的?|开始|然后呢|同意|确认|yes|ok|continue|go ahead)[。.!！?？\s]*$/i.test(text)) return false;
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
export function hookContext(id, configFile) {
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext:
    'Jev automatic skill routing suggests candidate ID ' + JSON.stringify(id) +
    ' in local configuration ' + JSON.stringify(configFile) +
    '. This is advisory, not authorization or task acceptance. Resolve that ID locally, confirm the skill is available and applicable under current host rules, and read its SKILL.md before use. Preserve explicit skill requirements and ongoing task context. Continue authorized work without asking the user to name Jev or launch it. Keep routine auxiliary judgments quiet; report material blockers or limitations. Do not repeat this skill-selection judgment through another route.' } };
}

export async function runAutoHook(event, configFile, {
  route = routeSkills, configure = configureRuntime, now = () => new Date(),
} = {}) {
  if (event.hook_event_name !== 'UserPromptSubmit' || !eligiblePrompt(event.prompt) || typeof event.session_id !== 'string' || !event.session_id || typeof event.cwd !== 'string') return null;
  const home = path.dirname(configFile);
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  if (!Array.isArray(config.roots) || config.roots.some(r => typeof r !== 'string' || !path.isAbsolute(r)) || !withinRoot(event.cwd, config.roots)) return null;
  const candidates = await freshSkills(config);
  const lock = path.join(home, 'running.lock');
  try { await mkdir(lock); } catch (e) { if (e.code === 'EEXIST') return null; throw e; }
  const cleanup = () => { try { rmdirSync(lock); } catch {} };
  process.once('exit', cleanup);
  const session = hashText(event.session_id), goal = hashText(event.prompt.trim());
  const day = now().toISOString().slice(0, 10);
  let state = { day, count: 0, sessions: {} };
  const stateFile = path.join(home, 'state.json');
  const record = async value => writeFile(path.join(home, 'last-run.json'), JSON.stringify({ at: now().toISOString(), session, prompt_sha256: goal, ...value }), { mode: 0o600 });
  try {
    try { const saved = JSON.parse(await readFile(stateFile, 'utf8')); if (saved.day === day) state = saved; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const current = state.sessions[session] || { count: 0, goals: [], stopped: false };
    if (state.count >= 30 || current.count >= 6 || current.stopped || current.goals.includes(goal)) { await record({ status: 'SKIPPED_BUDGET_OR_REPEAT' }); return null; }
    // Reserve before network work. Failure cannot refund or reset the budget.
    current.count++; current.goals.push(goal); state.count++; state.sessions[session] = current;
    await writeFile(stateFile, JSON.stringify(state), { mode: 0o600 });
    try {
      await configure();
      const result = await route({ goal: event.prompt.trim(), candidates }, { signal: AbortSignal.timeout(5000), receiptRoot: path.join(home, 'receipts') });
      await freshSkills(config);
      if (!['SUGGESTED', 'NO_MATCH'].includes(result.status)) current.stopped = true;
      await writeFile(stateFile, JSON.stringify(state), { mode: 0o600 });
      await record({ status: result.status, model: result.model, metrics: result.metrics, usage: result.usage });
      const selected = result.recommendation?.id;
      return result.status === 'SUGGESTED' && candidates.some(c => c.id === selected && c.enabled) ? hookContext(selected, configFile) : null;
    } catch {
      current.stopped = true;
      await writeFile(stateFile, JSON.stringify(state), { mode: 0o600 });
      await record({ status: 'ERROR_SESSION_STOPPED' });
      return null;
    }
  } finally { process.removeListener('exit', cleanup); await rmdir(lock); }
}
