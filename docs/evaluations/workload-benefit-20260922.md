# Workload diagnostic — 2026-09-22

The useful narrow result was batch classification. Source-claim verification
did not remove host review reliably. The integration also added avoidable host
work and duplicated evidence metadata; 0.4.2 addresses those overheads.

## Method and recorded results

[Frozen input and expected labels](../../evals/workload-benefit.json) were written
before the requests. Each batch was submitted once to Jev and once to a Codex
agent using `gpt-6-astra`, effort `max`. No Jev result was rerolled or threshold
lowered. [Recorded results](../../evals/workload-benefit-20260922.result.json)
include failures, abstentions, timing and usage. These are project-authored
fixtures, not an independent benchmark or a full coding task.

Source excerpts are deliberately condensed for this diagnostic. `c1`–`c6`
refer to this kit's v0.4.1 code and validation; `c7` refers to
[Foreman's worker at 7a76bf3](https://github.com/thruwire/foreman/blob/7a76bf3304b21912f8a0af0efff2cc7ecf82a718/src/foreman/workers/codex_app_server.py),
and `c8` to the [context-diet guard at e6f034f](https://github.com/konstantinosbotonakis/codex-context-diet/blob/e6f034f53985aeba553c333920982edb63893e70/src/codex/qualityGuard.ts).
Their complete implementations were inspected separately; this fixture does
not measure Jev's ability to discover those implementations by itself.

| Batch | Jev | Codex | Interpretation |
| --- | --- | --- | --- |
| Eight source/document claims | 624 ms; 3/8 exact expected verdicts; 7/8 require review | 8/8; 17,014 ms task duration; no tool calls | Does not justify an automatic correctness gate |
| Eight Chinese issue reports, five categories plus unknown | 685 ms observed call; 630 ms inference; 8/8 expected labels | 8/8; 49,593 ms task duration; two model turns and one tool call | Narrow classification works; the Codex timing is confounded |

Verification had three clear direction errors (`c2`, `c7`, `c8`). Two additional
differences (`c5`, `c6`) were contradicted versus unsupported under the frozen
rubric; both rejected an unproven positive claim. It would be misleading to call
all five mismatches erroneous approval, or to report the one `auto` answer as
proof that this batch removed useful work. Seven items still needed host review.

The classification baseline inherited the installed skill-router advisory and
read its configuration despite the benchmark's no-tools instruction. That is
evidence of integration overhead, **not** a fair basis for a Jev/Codex speed
ratio. Both tasks also inherited host instructions and tools. Codex input usage
includes those prefixes and cached input; comparing that total with Jev input
does not measure billable savings. The report retains these numbers for audit.

## Changes supported by these observations

1. New installs use a fixed local workflow hint once per task/catalog. It does
   not query a model, decrypt credentials or direct the host to resolve a skill
   candidate from config. Existing users can select `auto mode workflow`.
   Optional paid `skills` mode and its previous decisions remain available.
2. A single evidence call can classify a batch and return the original reports.
   Hosts should use that workflow only when its labels replace needed semantic
   sorting. Uncertain items remain for inspection; it does not write code.
3. MCP evidence text merges repeated source manifests, selection records and
   identical hashes. Offline rendering of the successful recorded batch reduced
   the text view from **8,769 to 4,887 characters (44.3%)**, preserving all 335
   characters of original reports and every decision. Full `structuredContent`
   remains unchanged for machine consumers and full receipts stay on disk.
   Consequently the complete serialized MCP envelope falls only from 18,454 to
   14,254 characters (22.8%). These are character counts, not model token or
   billing savings. A code-mode host should display the text view once instead
   of serializing the text and structured versions together.

The presentation comparison reuses the recorded response without another model
call. Private source paths, session identifiers and credential files are excluded
from the public report; published character counts include original path lengths.
Unit and stdio tests cover preservation of originals, uncertainty, exclusions,
checks, stale state and the original structured contract. Tests are implementation
evidence, not new live model accuracy samples.

## Limits

No general coding speedup, Codex quota reduction, native desktop success, or
automatic supervision of all existing tasks was established. The local hint
still incurs a hook-process launch and cannot enforce host behavior. Source
briefs still return all ranked candidates, so ranking alone is not evidence of
less reading. Whole-task A/B measurements on representative work remain needed
before reporting a productivity ratio.
