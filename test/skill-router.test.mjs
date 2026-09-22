import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { routeSkills, skillRouteSchema } from '../src/skill-router.mjs';
import { collectSkillCatalog, catalogInput } from '../src/skill-catalog.mjs';

const candidates = [{ id: 'code', name: 'Code review', description: 'Review a proposed code diff for regressions.' }, { id: 'chart', name: 'Charts', description: 'Plot numeric data from a CSV.' }];
const input = () => ({ goal: 'Review the changes for bugs', candidates: structuredClone(candidates) });
const fixture = () => mkdtemp(path.join(os.tmpdir(), 'jev-skills-'));
function reply(request, { chosen = 's0', fit = [0.99, 0.01], confidence = 1 } = {}) {
  return { model: 'jev-1.13.0', truncated: false, coverage: { complete: true }, usage: { input_tokens: 42, output_tokens: 2 }, answers: {
    selection: { type: 'choice', choice: chosen, confidence, probabilities: Object.fromEntries(Object.keys(request.questions.selection.criteria).map(key => [key, key === chosen ? 1 : 0])) },
    ...Object.fromEntries(fit.map((noul, i) => ['fit_' + i, { type: 'noul', noul }]))
  } };
}

test('routing makes one bounded call, returns selected description and preserves full receipt', async () => {
  const receiptRoot = await fixture(); let calls = 0;
  const result = await routeSkills(input(), { receiptRoot, evaluate: async r => { calls++; return reply(r); } });
  assert.equal(calls, 1); assert.equal(result.status, 'SUGGESTED'); assert.equal(result.recommendation.id, 'code');
  assert.equal(result.metrics.question_count, 3); assert.equal(result.scores.length, 2);
  const receipt = JSON.parse(await readFile(result.receipt_path));
  assert.equal(receipt.input.candidates[1].description, candidates[1].description);
  assert.equal(receipt.raw_result.answers.fit_1.noul, 0.01);
});

test('none and uncertainty remain distinct; another candidate fitting cannot approve selected skill', async () => {
  const receiptRoot = await fixture();
  for (const [config, expected] of [[{ chosen: 'none', fit: [0.01, 0.01] }, 'NO_MATCH'], [{ chosen: 'none', fit: [0.99, 0.01] }, 'REVIEW_REQUIRED'], [{ chosen: 's1', fit: [0.99, 0.1] }, 'REVIEW_REQUIRED'], [{ confidence: 0.89 }, 'REVIEW_REQUIRED']]) {
    const result = await routeSkills(input(), { receiptRoot, evaluate: async r => reply(r, config) });
    assert.equal(result.status, expected); assert.equal(result.recommendation, null);
  }
});

test('host-required skills and empty/disabled catalogs bypass inference, never override requirements', async () => {
  const receiptRoot = await fixture(); let calls = 0;
  const options = { receiptRoot, evaluate: async () => { calls++; throw Error('Must not call'); } };
  const result = await routeSkills({ ...input(), required_ids: ['code', 'chart'] }, options);
  assert.equal(result.status, 'REQUIRED_SKILLS'); assert.equal(result.required.length, 2);
  assert.equal((await routeSkills({ goal: 'Hello', candidates: [] }, options)).status, 'EMPTY_CATALOG');
  const disabled = input(); disabled.candidates.forEach(c => c.enabled = false);
  assert.equal((await routeSkills(disabled, options)).status, 'EMPTY_CATALOG');
  await assert.rejects(routeSkills({ ...disabled, required_ids: ['code'] }, options), /MISSING_OR_DISABLED/);
  assert.equal(calls, 0);
});

test('duplicates, secret-like data, input limits and cancellation never reach inference', async () => {
  const receiptRoot = await fixture(); let calls = 0;
  const options = { receiptRoot, evaluate: async () => { calls++; } };
  const large = { goal: 'x'.repeat(1800), candidates: Array.from({ length: 19 }, (_, i) => ({ id: 'c' + i, name: 'Candidate', description: 'a'.repeat(1100) })) };
  for (const value of [{ ...input(), candidates: [candidates[0], candidates[0]] }, { ...input(), required_ids: ['code', 'code'] }, { ...input(), goal: 'Bearer ' + 'a'.repeat(25) }, large, { ...input(), candidates: Array.from({ length: 20 }, (_, i) => ({ ...candidates[0], id: 'c' + i })) }]) await assert.rejects(routeSkills(value, options));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(routeSkills(input(), { ...options, signal: controller.signal }));
  assert.equal(calls, 0);
});

test('bad model, incomplete coverage, malformed distributions/usage and API failures do not approve', async () => {
  const receiptRoot = await fixture();
  for (const mutate of [r => r.model = 'other', r => r.coverage.complete = false, r => r.truncated = true, r => delete r.answers.fit_1, r => r.answers.fit_0.noul = NaN, r => r.answers.selection.probabilities.s1 = 1, r => r.answers.selection.choice = 'unknown', r => r.usage.input_tokens = -1]) {
    await assert.rejects(routeSkills(input(), { receiptRoot, evaluate: async request => { const r = reply(request); mutate(r); return r; } }));
  }
  await assert.rejects(routeSkills(input(), { receiptRoot, evaluate: async () => { throw Error('private provider error'); } }), /SKILL_INFERENCE_FAILED/);
});

async function skill(root, name, body) { await mkdir(path.join(root, name)); await writeFile(path.join(root, name, 'SKILL.md'), body); }
test('offline catalog supports YAML descriptions, preserves duplicates by path ID and never exports bodies', async () => {
  const root = await fixture();
  await skill(root, 'a', '---\nname: same\ndescription: >-\n  Review code\n  for regressions.\n---\nPRIVATE BODY NEVER SENT');
  await skill(root, 'b', '---\nname: same\ndescription: "Draw charts: CSV data"\ndisable-model-invocation: true\n---\nBody');
  const result = await collectSkillCatalog(root);
  assert.equal(result.candidates.length, 2); assert.notEqual(result.candidates[0].id, result.candidates[1].id);
  assert.equal(result.candidates[0].description, 'Review code for regressions.'); assert.equal(result.candidates[1].enabled, false);
  assert.ok(!JSON.stringify(result).includes('PRIVATE BODY'));
  assert.equal(result.network_requests, 0);
});

test('catalog links, malformed YAML and overlong descriptions are not silently sent/truncated', async () => {
  const root = await fixture(), outside = await fixture();
  await skill(outside, 'real', '---\nname: linked\ndescription: review code\n---\nbody');
  await symlink(path.join(outside, 'real'), path.join(root, 'link'), 'junction');
  assert.equal((await collectSkillCatalog(root)).candidates.length, 0);
  await skill(root, 'bad', '---\nname: a\nname: b\ndescription: bad\n---\n');
  await assert.rejects(collectSkillCatalog(root), /CATALOG_SKILL_INVALID/);
  await writeFile(path.join(root, 'bad', 'SKILL.md'), '---\nname: a\ndescription: ' + 'x'.repeat(1201) + '\n---\n');
  await assert.rejects(collectSkillCatalog(root), /CATALOG_SKILL_INVALID/);
});

test('catalog is revalidated by full-file hash and descriptions cannot be edited to impersonate a skill', async () => {
  const root = await fixture(); await skill(root, 'a', '---\nname: review\ndescription: Review code\n---\nbody');
  const catalog = await collectSkillCatalog(root), file = path.join(root, 'catalog.json'); await writeFile(file, JSON.stringify(catalog));
  const selected = await catalogInput(file, 'Review a patch'); assert.equal(selected.input.candidates.length, 1);
  await assert.rejects(catalogInput(file, 'x', ['missing']), /UNKNOWN/);
  catalog.candidates[0].description = 'Different capability'; await writeFile(file, JSON.stringify(catalog));
  await assert.rejects(catalogInput(file, 'x'), /STALE/);
  await writeFile(file, JSON.stringify(await collectSkillCatalog(root)));
  await writeFile(path.join(root, 'a', 'SKILL.md'), '---\nname: review\ndescription: Review code\n---\nchanged body');
  await assert.rejects(catalogInput(file, 'x'), /STALE/);
});

test('nineteen candidates use exactly twenty questions without implicit batching', async () => {
  const receiptRoot = await fixture();
  const data = { goal: 'Choose an applicable skill', candidates: Array.from({ length: 19 }, (_, i) => ({ id: 'c' + i, name: 'Skill ' + i, description: 'Small candidate ' + i })) };
  const result = await routeSkills(data, { receiptRoot, evaluate: async request => {
    assert.equal(Object.keys(request.questions).length, 20);
    return reply(request, { chosen: 'none', fit: Array(19).fill(0) });
  } });
  assert.equal(result.status, 'NO_MATCH'); assert.equal(skillRouteSchema.parse(data).candidates.length, 19);
});
