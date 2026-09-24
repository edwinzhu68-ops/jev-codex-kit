// Presentation only: never re-judge, summarize, truncate or omit retained text.
// Full structured results and on-disk receipts keep the original public contract.
export function evidenceTextView(result) {
  if (!Array.isArray(result?.evidence) || !Array.isArray(result?.selections) || !result.receipt_path) return result;
  const selections = new Map(result.selections.map(s => [s.id, s]));
  const retained = new Set(result.evidence.map(s => s.id));
  return {
    format: 'jev-evidence-text-v1', run_id: result.run_id, status: result.status, advisory_only: true,
    root: result.root,
    ...(result.format === 'jev-work-packet-v1' ? {
      format: 'jev-work-text-v1', task_id: result.task_id, task: result.task, executor: result.executor,
      preparation_status: result.preparation_status, host_review_required: result.host_review_required,
      judgment_state: result.judgment_state, model: result.model,
      constraints: result.constraints, acceptance: result.acceptance, groups: result.groups,
      unassigned: result.unassigned, review_items: result.review_items, packet_path: result.packet_path,
    } : {}),
    evidence: result.evidence.map(s => {
      const selection = selections.get(s.id);
      const item = { id: s.id, path: s.path, lines: [s.start_line, s.end_line], text: s.text,
        file_sha256: s.file_sha256, disposition: selection?.disposition };
      if (s.excerpt_sha256 !== s.file_sha256) item.excerpt_sha256 = s.excerpt_sha256;
      if (s.pinned) item.pinned = true;
      if (s.symbol) item.symbol = s.symbol;
      if (selection?.relevance != null) item.relevance = selection.relevance;
      if (selection?.counterevidence != null) item.counterevidence = selection.counterevidence;
      if (selection?.label) item.label = selection.label;
      return item;
    }),
    // Exclusions still have identities and hashes; their full originals are in
    // the receipt. Retained identities no longer repeat a second source manifest.
    excluded: (result.source_index ?? []).filter(s => !retained.has(s.id)).map(s => ({ ...s, selection: selections.get(s.id) })),
    checks: result.checks, stale_sources: result.stale_sources, metrics: result.metrics,
    receipt_path: result.receipt_path, limitations: result.limitations,
  };
}

export function toolResponse(result) {
  return { content: [{ type: 'text', text: JSON.stringify(evidenceTextView(result)) }], structuredContent: result };
}
