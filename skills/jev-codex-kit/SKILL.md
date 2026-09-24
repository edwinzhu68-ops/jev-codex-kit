---
name: jev-codex-kit
description: Prepare source-linked work packets for main-host execution or subagent handoff, locate source, suggest a skill from explicit candidates, and review supplied changes using jev-kit. Jev judges; the host edits and tests.
---

# Jev Coding Kit

Use Jev only when a bounded judgment would change the host's next step and the
minimal necessary context is authorized to send. Codex may execute or delegate
without a Jev call. When using work preparation, gather task-specific originals,
review the result and preserve uncertainty. The experimental Codex execution
gate is not part of on-demand use; it failed the existing Desktop message-send
path and must not be installed or enabled automatically. See `VALIDATION.md`.

For Codex, Claude Code, Cursor, OpenCode, Pi and other coding hosts. The repository/package and skill identifier remain `jev-codex-kit` for compatibility. Pi uses a native extension; other clients use stdio MCP. Hosts may prefix MCP tool names with the server name. Pi provides `/jev-status` to check its MCP bridge without a model request.

Select one route based on the task. Exact search, math and predetermined reads use local tools.

- Semantic source location: `jev_code_brief`, with a configured `root` and explicit non-sensitive relative subdirectory `path`. The scanner only searches that scope. Returned candidates are partial coverage, not proof that all relevant code was found.
- Explicit source/log collection and checks: `jev_prepare_evidence`. Bind required sources to checks or mark them `pinned`; fixed collection uses no model.
- Optional main-host or subagent work preparation: `jev_prepare_work`. When its grouping or relationship checks would save actual work, supply minimal originals, candidate groups, atomic checks, constraints and acceptance requirements. Every source is retained. Resolve conflicts and ownership in the host, then use the packet yourself or pass it to the executor without re-judging unchanged material. See `docs/work-preparation.md`; this prepares material, not models or autonomous plans.

If Jev is used for distinct assignments, give each judgment its own task_id and task-specific context. A packet may pass from the main host to the executor of that same task only. Do not reuse another task's judgments or share a generic packet across different assignments. Verify task meaning, constraints, questions and hashes before reusing same-task judgments.
- Skill selection when the task goal is clear but the appropriate skill is not: `jev_route_skills`. Supply at most 19 host-confirmed candidates with complete names/descriptions. Use actual active skill metadata; filesystem discovery alone does not establish that the client enabled a skill. Preserve explicit requirements through `required_ids` (zero inference). Never ask Jev to override mandatory skills or instruction priority. `SUGGESTED` is a pointer to inspect, `NO_MATCH` covers only these candidates, and `REVIEW_REQUIRED` is an abstention. No every-message routing or automatic installation. See `docs/skill-routing.md` for offline catalog and CLI usage.
- Other semantic judgments: `jev_rank`, `jev_verify`, `jev_review`, `jev_gate`, `jev_screen`, or prepared-call routing via `jev_step`. Use `jev_evaluate` only when no recipe fits. Use `jev_coding_loop` or `jev_tool_route` only if the fused step does not fit.

The server is named `jev-kit`; server names are not tool names. Check actual registry availability. If absent, select the same operation through the CLI before inference:

```text
node "__KIT_ENTRY__" call TOOL INPUT.json NEW_OUTPUT.json
```

Use the installed absolute CLI path from the user's MCP configuration if this file still contains the template marker. Do not guess paths or reinstall blindly. Input JSON uses the same schema as the MCP tool. The CLI refuses an existing output before making a call.

Choose batches that replace actual work, such as classifying several issue reports into explicit categories. Preserve unknown/review items for the host. A small local classification diagnostic passed; source-claim verification did not reliably remove host review. Neither establishes general accuracy or a reason to add mandatory calls.

Evidence MCP results provide a compact text view (`jev-evidence-text-v1`) alongside unchanged full `structuredContent` and on-disk receipts. The text retains every selected original, its hashes, judgment details, exclusions, checks and limits. When orchestrating calls in code mode, emit the text content once instead of serializing both representations into model context. Consumers needing the original machine schema should read `structuredContent`. Source briefs still return all ranked candidates; ranking alone does not prove less reading.

Use the user's already-granted project authority to choose a minimal non-sensitive scope. Never transmit secrets, real saves, private personal information, or a whole repository. Common-secret detection is best effort; host authorization remains required. Source and work-preparation tools only read source and write local receipts. General tools judge supplied text; they do not execute proposed calls. Validate authorization, schema and prerequisites yourself before setting flags true.

One state/judgment uses one route. Batch independent questions; do not call on every message, reroll uncertain answers, or retry a failed judgment through another tool. Gather targeted missing evidence or continue independent work. Model fixed to jev-1.13.0. Program checks at most 20 questions and 24000 serialized request characters at the inference boundary; oversized inputs fail. Source brief also caps candidate count at 8, source file size at 256 KiB and complete units at 4500 characters (small whole files at 2400).

`REVIEW_REQUIRED`, stale sources, incomplete coverage or errors never mean approval. `auto`, `BRIEF_READY` and `EVIDENCE_READY` are advisory, not proof of implementation, permission, or runtime acceptance. Preserve original evidence and counterevidence. Host owns goal interpretation, edits, execution, tests and final acceptance. Do not claim measured speed/cost improvement without an end-to-end comparison. No model switching, autonomous executor or mandatory restart.
