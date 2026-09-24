# Task execution gate (opt-in, native trust required)

This is an execution guardrail, not a claim that every client or every ongoing
session is covered. `workflow` remains a legacy zero-inference reminder. Install
the separate gate with `node bin/jev-kit.mjs auto install-work-gate` after ordinary
setup. Review both new hook definitions in Codex `/hooks`. Installation never
edits native trust, enables bypass flags, or restarts sessions. Existing hooks and
credentials are preserved. A running session must demonstrate that it loaded the
new definitions before it is considered covered.

The gate registers UserPromptSubmit and PreToolUse. It does not send the user
message, a transcript, or a repository to the provider. Long messages and code
blocks register a task boundary without truncation. “继续”, “开始” and “修好” retain
only a still-open current task; after `close`, they require a new task. Normal new
messages invalidate old action bindings conservatively. The host still identifies
semantic boundaries inside a turn; a hook cannot observe private reasoning.

## Normal path

1. Gather the original requirement, necessary source excerpts, known constraints
   and acceptance. Do not finish grouping or diagnosis before asking for judgment.
2. Add a JSON input under `$JEV_KIT_HOME/auto/inbox/` (default `~/.jev-codex-kit`)
   using apply_patch. It contains `session_id` (given in the block reason) and
   `work`, the complete [work preparation](work-preparation.md) input. Each distinct
   task requires its own task_id. Supply actual task-specific `labels` and/or
   relationship `checks`; the gate rejects zero-question packets. Sources stay
   inside existing explicitly authorized roots. Inbox files are local input only;
   they do not expand source permissions.
3. Run `node /absolute/path/bin/jev-work.mjs prepare INPUT.json`. This registers
   COLLECTED, invokes the existing real preparation path, and records the actual
   model, question count, usage, original evidence, hashes and resulting groups.
   Registration alone never permits execution.
4. Read the full returned packet. Preserve unknown groups, failed checks and all
   requirements. Compose the work package using these judgments. Resolve ownership
   and dependencies locally. Add a review JSON with `session_id`, `task_id`,
   `disposition` (`adopt`, `retain_for_inspection`, or `override`), a substantive
   `explanation`, and `actions: [{tool_name, tool_input}]`. Use actual canonical
   hook names and exact arguments. Run `node /absolute/path/bin/jev-work.mjs review
   REVIEW.json`. Review binds the calls; it is not another inference.
5. Execute. PreToolUse verifies packet and receipt bytes, all source hashes,
   session revision, host review and the exact one-shot action binding. An action
   can be rebound after an interrupted call with another review of the same fresh
   task. Do not repeat inference for unchanged material. A different delegation
   message requires a new task; the registry rejects changing a task's assignment.
6. Finish the work package with `node /absolute/path/bin/jev-work.mjs close SESSION
   TASK_ID`. The next package requires new preparation. Closing is a lifecycle
   operation, not a successful task-acceptance claim.

The host can prepare multiple packets in one session and activate the appropriate
one via review. It must not reuse one packet for different work, even on the same
file. Each assignment, including follow-up to an existing agent, gets independent
preparation. The same-task executor can consume the host's original packet; the
registry does not yet transfer a capability into an independently identified
child session. That client path requires verification, not a promise of reuse.

## Status and exceptions

`COLLECTED` means no valid judgment yet. `JEV_JUDGED` means an actual model reply.
`REVIEW_REQUIRED` means the actual reply retains uncertainty or adverse checks;
it needs an explicit host disposition, not a reroll. `HOST_REVIEWED` records how
the host used the reply. `EXEMPT` and `DEGRADED` never mean successful inference.
The underlying legacy WORK_PREPARED field is retained for compatibility; use
`judgment_state` and actual inference counts, never that label alone.

Service failure records DEGRADED, blocks execution until explicitly resolved, and
forbids another attempt under the same task_id. Do not change IDs or entrypoints
to reroll an unchanged failed judgment. Changed evidence/goal uses a new revision
ID and only asks affected questions. No timeout is treated as approval.

For a pure calculation, an already specified mechanical step, unauthorized external
data, or a failed service, use `node /absolute/path/bin/jev-work.mjs exception
INPUT.json`. The JSON has session_id, task_id, kind (`pure_calculation`,
`mechanical_step`, `data_not_authorized`, `service_unavailable`), explanation and
exact actions. A service exception requires a recorded failed preparation. The
host must report the limitation. “Simple task” and “I know how” are not kinds.
Exceptions are host attestations, not machine proof of semantic eligibility.

## Collection, coverage and limits

Simple read commands and narrowly scoped inbox JSON additions are allowed before
preparation to avoid a deadlock. Shell scripts, compound commands, arbitrary MCP
calls, edits and delegation require bindings. A read not recognized by the narrow
allowlist needs an explicit mechanical-step exception; it is not automatically
unsafe. The shell allowlist is conservative, not a security sandbox. Custom shell
profiles/aliases and hostile local state are outside this guardrail's trust model.

Evidence retains the existing 20-question/24,000 serialized-character limit.
Oversized inputs reject without truncation. The host must split at complete source
or requirement boundaries and preserve cross-batch relationships; no automatic
large-document decomposition is claimed. Each batch has an independent revision
ID and receipt. A group of receipts is not yet an aggregate execution capability.

Current [Codex hook documentation](https://developers.openai.com/codex/hooks)
describes shell (`Bash`), apply_patch, MCP and ordinary function coverage, including
spawn_agent. It excludes hosted tools and new write_stdin input on already running
exec sessions, and warns about specialized paths. Exact action names are client
dependent. Pure textual answers, private reasoning, internal task scope changes,
unhooked tools, shell aliases and mutated long-running processes cannot be fully
enforced here. If a client omits hooks or has not trusted them, this gate cannot
force a model call. Do not claim automatic cross-session success from unit tests,
direct handler invocations, local provider fixtures or registration alone.

Private state and traces live in `auto/work/<session-hash>.json` and `.events.jsonl`.
They contain original work inputs and host dispositions; do not commit them.
No task state or result is accepted as implementation, runtime or product proof.
