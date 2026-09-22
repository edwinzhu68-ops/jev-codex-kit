import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lexicalRoute, summarize } from '../scripts/eval-skills.mjs';

test('evaluation treats abstention and missing/failed live calls separately from correct no-match', () => {
  const rows = [
    { lexical: { correct: true }, jev: { correct: true, status: 'NO_MATCH', usage: { input_tokens: 10, output_tokens: 2 }, elapsed_ms: 5 } },
    { lexical: { correct: false }, jev: { correct: false, status: 'REVIEW_REQUIRED', usage: { input_tokens: 20, output_tokens: 3 }, elapsed_ms: 8 } },
    { lexical: { correct: true }, jev: { error: 'stopped' } },
  ];
  assert.deepEqual(summarize(rows), { cases: 3, lexical_correct: 2, jev_evaluated: 2, jev_correct: 1, jev_abstentions: 1, input_tokens: 30, output_tokens: 5, jev_elapsed_ms: 13 });
  assert.equal(lexicalRoute('hello', [{ id: 'code', name: 'Review', description: 'Inspect diffs' }]), null);
});
