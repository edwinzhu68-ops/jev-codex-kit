import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceTextView, toolResponse } from '../src/result-view.mjs';

test('text view preserves full evidence, uncertainty, exclusions, checks and stale status', () => {
  const evidence = [{ id: 'kept', path: 'src/a.txt', start_line: 2, end_line: 4, text: 'Counterevidence\n中文\n', pinned: true, file_sha256: 'file-hash', excerpt_sha256: 'excerpt-hash' }];
  const selections = [{ id: 'kept', disposition: 'review', relevance: .3, counterevidence: .9,
    label: { value: 'unknown', raw: { confidence: .4, probabilities: { bug: .6, unknown: .4 } } } },
  { id: 'excluded', disposition: 'exclude', relevance: .01, counterevidence: .01 }];
  const full = { status: 'STALE_SOURCE', root: '/project', evidence, selections,
    source_index: [...evidence, { id: 'excluded', path: 'other.txt', file_sha256: 'other-hash' }],
    checks: [{ id: 'claim', verdict: 'unsupported', needs_review: true }], stale_sources: ['kept'],
    metrics: { workflow_inference_calls: 1 }, receipt_path: '/private/receipt.json', limitations: ['partial coverage'] };
  const before = structuredClone(full), r = toolResponse(full), view = JSON.parse(r.content[0].text);
  assert.equal(r.structuredContent, full);
  assert.deepEqual(full, before);
  assert.equal(view.status, full.status);
  assert.equal(view.evidence[0].text, evidence[0].text);
  assert.equal(view.evidence[0].excerpt_sha256, 'excerpt-hash');
  assert.deepEqual(view.evidence[0].label, selections[0].label);
  assert.equal(view.excluded[0].selection.disposition, 'exclude');
  assert.deepEqual(view.checks, full.checks);
  assert.deepEqual(view.stale_sources, full.stale_sources);
  assert.deepEqual(view.limitations, full.limitations);
});

test('other tool results keep their contract and equal file/excerpt hashes need no duplicate', () => {
  const raw = { action: 'review', results: [{ verdict: 'unsupported' }] };
  assert.equal(evidenceTextView(raw), raw);
  const full = { evidence: [{ id: 'a', path: 'a.txt', text: 'full original', file_sha256: 'same', excerpt_sha256: 'same', start_line: 1, end_line: 1 }],
    selections: [{ id: 'a', disposition: 'retain' }], source_index: [], receipt_path: '/receipt' };
  const v = evidenceTextView(full);
  assert.equal(v.evidence[0].file_sha256, 'same');
  assert(!('excerpt_sha256' in v.evidence[0]));
  assert.equal(v.evidence[0].text, 'full original');
});
