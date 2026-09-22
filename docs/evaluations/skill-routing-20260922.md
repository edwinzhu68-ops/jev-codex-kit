# Skill routing diagnostic run — 2026-09-22

Model: `jev-1.13.0`. Eight prewritten synthetic tasks, four synthetic skill descriptions, one pass, no threshold or prompt tuning after viewing results. The expected labels were not sent to the model. [Dataset](../../evals/skill-routing.json) · [Raw report](skill-routing-20260922.json) · [Runner](../../scripts/eval-skills.mjs).

Dataset SHA256: `1ff61130ca86b5e9ef218b99ffd28eb3d59ff0ab5fb1e2cb0e31b2196e005fcc`.

| Case | Lexical baseline | Jev outcome | Jev elapsed ms |
| --- | --- | --- | ---: |
| English patch review | Correct | Correct skill | 583 |
| Chinese Godot save repair | Correct | Correct skill | 259 |
| CSV chart | Correct | Correct skill | 220 |
| Chinese release notes | Missed skill | Correct skill | 181 |
| Simple arithmetic | Correct no-match | Correct no-match | 196 |
| Translate skill words, do not perform them | Wrong skill | Correct no-match | 365 |
| Missing audio capability | Correct no-match | Correct no-match | 212 |
| Multi-goal task, choose first step | Correct | Correct skill | 200 |

- Exact expected-result matches: Jev 8/8; lexical overlap 6/8. No abstentions on this set.
- Summed Jev elapsed time: 2216 ms; range 181–583 ms. These are local route invocation measurements including request/validation/receipt work, not provider-only inference or full task time.
- Provider-reported usage: 8528 input tokens and 1037 output tokens. No cost inferred from token counts.
- Eight distinct workflow inference calls; no application-level reruns. The local encrypted-key loader initially rejected surrounding whitespace before any request; trimming the existing encrypted value resolved that setup error. No live case was repeated.

## What this establishes

This version can select among four descriptions on these concrete requests, handle two Chinese tasks and reject the vocabulary trap. The model supplied a useful semantic distinction that the simple lexical baseline missed.

## What it does not establish

The author wrote the cases and labels, and the sample is small and easy. Lexical overlap is a weak baseline and is not Codex, Claude or an equivalent LLM. It runs locally faster than a network call. This result does not show reduced Codex workload/tokens, an end-to-end speedup, monetary savings, a calibrated confidence threshold or accuracy over large real skill catalogs. We retained a fixed dataset and report so later comparisons can expose regressions rather than rewriting the demonstration around a favorable result.
