# Work preparation for the main host and subagents

Execution checks are described in [execution gate](execution-gate.md). Packets now
expose `judgment_state`: COLLECTED for zero inference, JEV_JUDGED for an actual
ready judgment, REVIEW_REQUIRED for uncertainty/adverse checks, or STALE_SOURCE.
They also expose `model` (null for collection). WORK_PREPARED remains a compatibility
label and is never sufficient for the gate. The gate requires real nonzero
task-specific judgment and a separate host disposition before binding execution.

Use `jev_prepare_work` before the host does substantive semantic sorting, whether
the host will execute itself or delegate. Collect the goal, current originals and
known constraints first; do not solve the whole task merely to ask Jev to endorse it.
The tool reuses evidence collection, classification and named-source checks. It
does not invent subtasks, choose models, dispatch agents, edit source or run tests.

## Input

Each distinct main-host work package or subagent assignment has its own required
`task_id`, goal, evidence scope, constraints and acceptance. Shared source files do
not make two tasks the same. Prepare them separately; never hand every worker a
generic packet or reuse another task's decisions. No cross-task inference cache exists.
The host assigns task IDs; the tool does not maintain a global uniqueness registry.
Every invocation creates a fresh run and packet, including repeated IDs.

Accepts `jev_prepare_evidence` fields plus `task_id` (1–96 letters/digits/`_.-`,
starting with a letter or digit), `executor` (`main` default or `subagent`),
`constraints` and `acceptance` (each up to 10 complete strings, 500 characters each).
These are host-supplied context, not proof of implementation or execution authority.

`sources` are 1–10 explicitly authorized excerpts. This entry pins every source,
even when the caller omits `pinned` or sets it false. Optional `labels` are 2–8
host-supplied candidate groups, not model names; the tool adds `unknown`. One primary
group per source does not prove exclusive ownership: shared evidence and dependencies
must be added by the host. Optional `checks` are up to 8 atomic claims bound to named
sources. To expose a suspected conflict, check a desirable claim such as “These
requirements agree on whether the failing assertion may remain red.” Put authoritative
material in the named sources. Unsupported/contradicted answers require inspection.

Known facts, file-write intersections, resource locks, arithmetic and fixed steps
remain deterministic host work. Every independent question shares one inference
request: one category per source when labels exist, plus one question per check.
Dependent questions need new evidence/state in a later round. The reused boundary
fixes `jev-1.13.0` and rejects more than 20 questions or 24,000 serialized request
characters, including work context, without truncation. No labels/checks means
local collection with zero model calls. SDK transient HTTP retries share one deadline.

## Run

Edit `examples/work-preparation.json` to use the exact configured repository root.
The example contains synthetic non-sensitive materials, not production proof.
Use the same input with MCP or this CLI operation:

```text
node /absolute/path/to/jev-codex-kit/bin/jev-kit.mjs call jev_prepare_work INPUT.json NEW_OUTPUT.json
```

## Consume and hand off

Results retain all excerpts, hashes, raw judgments, groups, unassigned material,
checks, `review_items`, constraints, acceptance and a private `packet_path` beside
the evidence receipt. `host_review_required` is always true. `WORK_PREPARED` means
preparation completed, never permission or task PASS. `REVIEW_REQUIRED` and
`STALE_SOURCE` remain explicit; errors return no successful packet. Source hashes
are checked after inference, not locked for future execution.

The main host resolves groups and questionable premises, assigns write ownership,
and creates complete diagnosis/implementation/verification work packages. For main
work, use the packet directly. For delegation, include the relevant originals,
constraints, acceptance, receipt and hashes in the actual task; pass only a packet
path when the worker can read it. Preserve shared requirements when splitting groups.
This tool does not itself split or dispatch tasks.

Only within the same task_id, reuse returned judgments after confirming the goal, constraints, question meanings
and source hashes remain current. Handing that specific prepared task to its executor
does not require re-judging. A different task always needs its own preparation.
There is no automatic persistent cache or model-trust flag. New evidence can overturn
suggestions. Failure/uncertainty requires host inspection, not another route for the
same judgment. Exact fixes can proceed without model requests.

The MCP text view `jev-work-text-v1` preserves every original and work-packet field
without repeating the source manifest. Emit that view once. Full machine output is
also available in `structuredContent` and the private packet.

## Availability and limits

Fresh kit MCP/Pi processes expose the new tool. With an older active registry, choose
the CLI before inference, or use an available evidence entry and compose the same
handoff locally. Do not restart unrelated tasks or repeat a failed judgment through
a second route. The submit hook only reminds the host; it does not enforce use by
every live model. This adds preparation and handoff, not measured overall savings.
The host retains architecture, source/runtime verification and final acceptance.

Design references: [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
and [named-source checking](https://docs.typesafe.ai/cookbooks/citation_check).
