import { observedActions, validateState, assertNoSecret, hashText } from './ui-loop.mjs';
import { brokerDecision } from './ui-broker-client.mjs';

// Official @oai/sky adapter. Deliberately no run() loop: the Windows host must
// emit/inspect each observation in one cell, then take one action in the next.
export function createWindowsSession(sky, window, { brokerFile, decide = brokerDecision(brokerFile), minConfidence = .9 } = {}) {
  if (sky?.target !== 'windows' || typeof sky.get_window_state !== 'function' || typeof sky.click !== 'function' || !Number.isSafeInteger(window?.id) || !window?.app || minConfidence < .9 || minConfidence > 1 || !Number.isFinite(minConfidence)) throw Error('WINDOWS_TARGET_REQUIRED');
  const bound = { id: window.id, app: window.app };
  let current = null, terminal = false, busy = false;
  const history = [], metrics = { decisions: 0, actions: 0, input_tokens: 0, output_tokens: 0 };
  const sameWindow = w => w?.id === bound.id && w?.app === bound.app;
  const observe = async () => {
    current = null;
    const snapshot = await sky.get_window_state({ window, include_screenshot: false, include_text: true });
    if (!sameWindow(snapshot.window)) throw Error('WINDOW_CHANGED');
    window = snapshot.window;
    current = { window, state: snapshot.accessibility?.tree ?? '', status: snapshot.accessibility?.tree ? 'OBSERVED' : 'HOST_VISUAL_REQUIRED' };
    return current;
  };
  return {
    async observe() { if (busy) throw Error('BUSY'); return observe(); },
    metrics: () => ({ ...metrics }),
    async step({ observation, inspected = false, authorized = false, goal, controls }) {
      const finish = (status, observed = current) => ({ status, verified: false, observation: observed, history: [...history], metrics: { ...metrics } });
      if (terminal || busy) return finish(terminal ? 'SESSION_STOPPED' : 'BUSY');
      if (observation !== current || !current || inspected !== true || authorized !== true) throw Error('OBSERVE_INSPECT_AUTHORIZE_FIRST');
      if (current.status === 'HOST_VISUAL_REQUIRED') return finish('HOST_VISUAL_REQUIRED');
      if (typeof goal !== 'string' || !goal.trim() || goal.length > 1800 || !Array.isArray(controls) || controls.length > 19 || controls.some(c => c.op !== 'click')) throw Error('BOUNDED_CLICK_TASK_REQUIRED');
      assertNoSecret(goal); validateState(current.state, {kind:'native',boundByHost:true});
      busy = true;
      try {
        const state = current.state, actions = observedActions(state, controls);
        metrics.decisions++;
        const d = await decide({ goal, state, actions, history }, { signal: AbortSignal.timeout(5000) });
        metrics.input_tokens += d.usage?.input_tokens ?? 0; metrics.output_tokens += d.usage?.output_tokens ?? 0;
        if (!Number.isFinite(d.confidence) || d.confidence < minConfidence) { terminal = true; return finish('REVIEW_REQUIRED'); }
        const fresh = await observe();
        if (fresh.state !== state || fresh.status !== 'OBSERVED') return finish('STALE_STATE');
        if (['DONE','HANDOFF','BLOCKED'].includes(d.choice)) { terminal = d.choice === 'BLOCKED'; return finish(d.choice === 'DONE' ? 'NEEDS_VERIFICATION' : d.choice); }
        const action = actions.find(a => a.id === d.choice);
        if (!action) throw Error('UNOBSERVED_ACTION');
        const record = { state_sha256: hashText(state), name: action.name, choice: d.choice, executed: false };
        if (history.some(h => h.state_sha256 === record.state_sha256 && h.name === record.name)) { terminal = true; return finish('REPEATED_ACTION'); }
        history.push(record); current = null;
        await sky.click({ window: fresh.window, element_index: action.index });
        record.executed = true; metrics.actions++;
        const next = await observe();
        if (next.state === state) { terminal = true; return finish('NO_PROGRESS'); }
        return finish(next.status === 'OBSERVED' ? 'OBSERVE_REQUIRED' : 'HOST_VISUAL_REQUIRED');
      } catch (e) {
        if (e.beforeInference === true) return finish(e.code);
        terminal = true; current = null; return finish('ERROR_HANDOFF');
      } finally { busy = false; }
    }
  };
}
