import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { inputSchema, prepareEvidence } from './evidence-workflow.mjs';

// Execution ownership is metadata, never a model/provider routing decision.
export const workPreparationSchema = inputSchema.extend({
  task_id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/).describe('Unique work-package ID. Each distinct delegated task needs its own ID and preparation, even with shared source files.'),
  executor: z.enum(['main', 'subagent']).default('main'),
  constraints: z.array(z.string().min(1).max(500)).max(10).default([]),
  acceptance: z.array(z.string().min(1).max(500)).max(10).default([]),
}).strict();

export async function prepareWork(raw, options = {}) {
  const { task_id, executor, constraints, acceptance, ...input } = workPreparationSchema.parse(raw);
  const workContext = { task_id, executor, constraints, acceptance };
  // Every supplied source remains available, including low-priority material,
  // contradictions and unknown groups. No model judgment can shrink the task.
  const bundle = await prepareEvidence({
    ...input, sources: input.sources.map(source => ({ ...source, pinned: true })),
  }, { ...options, workContext });
  const groups = (input.labels ?? []).map(label => ({ ...label, evidence_ids: [] }));
  const unassigned = [];
  for (const selection of bundle.selections) {
    const group = groups.find(group => group.id === selection.label?.value);
    if (group) group.evidence_ids.push(selection.id);
    else unassigned.push(selection.id);
  }
  const reviewItems = [
    ...bundle.checks.filter(check => check.needs_review).map(check => ({
      kind: 'check', id: check.id, evidence_ids: check.evidence_ids, verdict: check.verdict,
    })),
    ...(input.labels ? unassigned.map(id => ({ kind: 'unassigned', evidence_ids: [id] })) : []),
    ...bundle.stale_sources.map(id => ({ kind: 'stale_source', evidence_ids: [id] })),
  ];
  const packet = {
    ...bundle,
    format: 'jev-work-packet-v1',
    status: bundle.status === 'EVIDENCE_READY' ? 'WORK_PREPARED' : bundle.status,
    preparation_status: bundle.status,
    host_review_required: true,
    task: input.task, ...workContext, groups, unassigned, review_items: reviewItems,
    packet_path: path.join(path.dirname(bundle.receipt_path), 'work-packet.json'),
    limitations: [...bundle.limitations,
      'Groups and checks are suggestions, not generated tasks, root-cause findings or execution authority.',
      'The host resolves constraints, ownership and dependencies and retains all acceptance requirements.',
      'This packet belongs only to task_id. Every different delegated task needs separate preparation, even when sources overlap.',
      'Only hand off unchanged judgments within this same task_id, goal, constraints, questions and source snapshot. No cross-task cache is used.',
    ],
  };
  await writeFile(packet.packet_path, JSON.stringify(packet, null, 2), { flag: 'wx', mode: 0o600 });
  return packet;
}
