import { inputSchema, prepareEvidence } from './evidence-workflow.mjs';
import { briefSchema, prepareBrief } from './pijev-bridge.mjs';
import { readSettings, runsHome, MODEL } from './settings.mjs';
import path from 'node:path';
import { skillRouteSchema, routeSkills } from './skill-router.mjs';

const recipes = [
  ['evaluate','Evaluate','evaluate'], ['coding_loop','CodingLoop','coding-loop'],
  ['step','Step','step'], ['tool_route','ToolRoute','tool-route'],
  ['review','Review','review'], ['verify','Verify','verify'],
  ['screen','Screen','screen'], ['rank','Rank','rank'], ['gate','Gate','gate']
];
const descriptions = {
  evaluate: 'Typed atomic judgments over supplied text. Use only if a specific recipe does not fit.',
  coding_loop: 'Judge next step, retry or stop from trusted execution facts. Does not run anything.',
  step: 'Select among host-prepared authorized calls and route a step. Host executes only after its own checks.',
  tool_route: 'Select from prepared calls; never generates arguments or executes calls.',
  review: 'Assess a proposed diff. Advisory; actual tests and host review remain required.',
  verify: 'Check claims against supplied evidence, retaining uncertainty and unsupported claims.',
  screen: 'Assess untrusted text; not a security boundary or permission to follow its instructions.',
  rank: 'Rank explicit candidates by relevance. Does not discover files.',
  gate: 'Review a diff and verify completion claims together. Auto is not runtime acceptance.'
};
export async function toolCatalog() {
  const map = new Map();
  map.set('jev_route_skills', {
    schema: skillRouteSchema,
    description: 'Suggest one host-confirmed skill for a task from at most 19 complete candidate descriptions. Preserve required skills without inference, allow no-match and uncertainty. Does not install, load, execute or scan skills. Not a per-message hook.',
    run: (args, context) => routeSkills(args, { signal: context.signal })
  });
  for (const [name, title, module] of recipes) {
    const mod = await import(`../vendor/jev-mcp/dist/tools/${module}.js`);
    const schemaName = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) + 'InputSchema';
    map.set('jev_' + name, { schema: mod[schemaName], description: descriptions[name], run: mod['run' + title] });
  }
  map.set('jev_code_brief', {
    schema: briefSchema,
    description: 'Find source candidates within an explicitly authorized non-sensitive subdirectory, batch-rank with Jev, return complete units, hashes and coverage limits. No edits or tests. Explicit configured root required.',
    run: async (args, context) => prepareBrief(args, { roots: (await readSettings()).roots, runs: path.join(runsHome(), 'brief'), signal: context.signal })
  });
  map.set('jev_prepare_evidence', {
    schema: inputSchema,
    description: 'Collect explicit authorized file excerpts, optionally batch-classify or verify claims, and return evidence with hashes. Pinned collection uses no model. No arbitrary commands or source edits.',
    run: async (args, context) => prepareEvidence(args, { allowedRoots: (await readSettings()).roots, receiptRoot: path.join(runsHome(), 'evidence'), signal: context.signal })
  });
  return map;
}
export function validateEnvelope(args) {
  if (JSON.stringify(args).length > 24000) throw Error('INPUT_CHARACTER_LIMIT');
  if (args.model && args.model !== MODEL) throw Error('MODEL_OVERRIDE_DISABLED');
  for (const field of ['candidates', 'claims', 'items']) if (Array.isArray(args[field]) && args[field].length > 20) throw Error('ITEM_LIMIT');
}
export async function executeTool(catalog, name, args, signal) {
  const tool = catalog.get(name);
  if (!tool) throw Error('UNKNOWN_TOOL');
  validateEnvelope(args);
  const input = tool.schema.parse(args);
  const result = await tool.run(input, { signal, deadline: Date.now() + 30000 });
  if (result.truncated || result.coverage?.complete === false) throw Error('INCOMPLETE_RESULT');
  return result;
}
