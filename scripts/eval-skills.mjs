import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { routeSkills, hashText } from '../src/skill-router.mjs';
import { configureRuntime, loadKey, MODEL } from '../src/settings.mjs';

const stopWords = new Set(['the','a','an','and','or','to','of','in','from','with','for','is','this','does','not','without']);
const terms = text => new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => t.length > 2 && !stopWords.has(t)));
export function lexicalRoute(goal, candidates) {
  const query = terms(goal);
  const scored = candidates.map(c => ({ id: c.id, score: [...terms(c.name + ' ' + c.description)].filter(t => query.has(t)).length }));
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored[0]?.score > 0 ? scored[0].id : null;
}
export function summarize(rows) {
  const correct = (key) => rows.filter(r => r[key]?.correct === true).length;
  const evaluated = rows.filter(r => r.jev && !r.jev.error);
  return {
    cases: rows.length, lexical_correct: correct('lexical'), jev_evaluated: evaluated.length,
    jev_correct: correct('jev'), jev_abstentions: evaluated.filter(r => r.jev.status === 'REVIEW_REQUIRED').length,
    input_tokens: evaluated.reduce((n, r) => n + r.jev.usage.input_tokens, 0),
    output_tokens: evaluated.reduce((n, r) => n + r.jev.usage.output_tokens, 0),
    jev_elapsed_ms: evaluated.reduce((n, r) => n + r.jev.elapsed_ms, 0),
  };
}
async function main() {
  const argv = process.argv.slice(2);
  const live = argv.includes('--live');
  if (argv.length !== (live ? 3 : 2) || argv[0] !== '--output' || (live && argv[2] !== '--live')) throw Error('Usage: node scripts/eval-skills.mjs --output NEW_REPORT.json [--live]');
  const output = path.resolve(argv[1]);
  const datasetText = await readFile(new URL('../evals/skill-routing.json', import.meta.url), 'utf8');
  const dataset = JSON.parse(datasetText);
  if (dataset.cases.length > 8) throw Error('Evaluation cap: 8 distinct cases; no retries.');
  if (live) { await configureRuntime(); if (!await loadKey()) throw Error('API key required for live mode.'); }
  const receiptRoot = path.join(path.dirname(output), path.basename(output) + '.receipts');
  const report = {
    schema_version: 1, started_at: new Date().toISOString(), mode: live ? 'live_jev_vs_lexical' : 'offline_lexical_only', model: live ? MODEL : null,
    dataset_sha256: hashText(datasetText), dataset_description: dataset.description,
    limitations: ['Author-written synthetic examples; not independent or statistically representative.', 'Lexical overlap is a weak deterministic baseline, not Codex or another LLM.', 'No paid generation baseline, host token saving or end-to-end coding speed measured.', 'No provider fees inferred from tokens; review/unknown is an abstention, not correct no-match.', 'Descriptions and goals are sent; expected labels never go into the inference request.'],
    rows: [], complete: false,
  };
  await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  if (live) await mkdir(receiptRoot, { recursive: true, mode: 0o700 });
  let failed = false;
  for (const item of dataset.cases) {
    const began = performance.now(), lexical = lexicalRoute(item.goal, dataset.candidates);
    const row = { id: item.id, goal: item.goal, expected: item.expected, lexical: { selected: lexical, correct: item.expected.includes(lexical), elapsed_ms: performance.now() - began } };
    if (live) {
      const start = performance.now();
      try {
        const result = await routeSkills({ goal: item.goal, candidates: dataset.candidates }, { receiptRoot, signal: AbortSignal.timeout(35000) });
        const selected = result.recommendation?.id ?? null;
        row.jev = { status: result.status, selected, correct: ['SUGGESTED', 'NO_MATCH'].includes(result.status) && item.expected.includes(selected), elapsed_ms: Math.round(performance.now() - start), usage: result.usage, input_sha256: result.input_sha256, scores: result.scores, selection: result.selection };
      } catch { row.jev = { error: 'Inference/validation failed; live evaluation stopped without retry.' }; failed = true; }
    }
    report.rows.push(row);
    report.summary = summarize(report.rows);
    await writeFile(output, JSON.stringify(report, null, 2));
    if (failed) break;
  }
  report.complete = !failed && report.rows.length === dataset.cases.length;
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, complete: report.complete, mode: report.mode, summary: report.summary }));
  if (failed) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error('Evaluation failed; check arguments, output path, key and input limits. No raw provider error is printed.'); process.exitCode = 1; });
