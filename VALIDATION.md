# Validation record

## Isolated recovery hardening — 2026-09-24 UTC

The existing task-specific Jev-before-execution requirement is unchanged. The
user's global auto switch remains **disabled** and no live hook definition,
native trust entry, running Desktop session, or credential was changed.

- The legacy v1 command retains its original ambiguous failure fallback; it
  remains disabled. New v2 definitions pass an explicit
  event name to distinct submit/tool commands: submit failure and timeout cannot
  emit a tool denial, while malformed or missing tool input still denies. With
  `enabled:false`, the handler exits before waiting for stdin to finish. The
  legacy v1 fallback remains unchanged, and v2 migration requires new native
  trust; neither definition has been changed in the user's installed hooks.
- `auto status` now reports the **current** `enabled` flag and `DISABLED` status,
  retaining the historical result separately as `last_run`. A prior
  `WORKFLOW_REMINDER` no longer looks like a currently active route.
- Local Windows suite: **105/105 PASS**. New isolated checks exercised both
  event-specific failure outcomes through Node and the installed-style Windows
  PowerShell command; the disabled handler exited with stdin still open, and
  stalled enabled submit/tool inputs reached their distinct watchdog outcomes. V2
  installer tests verify exact v1 migration, unrelated-hook preservation and
  refusal of an unapproved replacement.
- A fresh Jev review of the v2 code diff had complete input coverage but returned
  **escalate** (composite 0.5555, safe-to-apply 0.09), with low correctness
  confidence (0.46) and a high test-gap score (1.9/2). This is
  advisory adverse evidence, not a passed review. Host inspection and the
  stalled-input regression above addressed a concrete local gap; the Desktop
  acceptance limit remains.
- A separate Codex app-server using an isolated config directory loaded and
  trusted both test hooks, then emitted `userPromptSubmit` started/completed for
  a synthetic message. Its model turn failed authentication (401) because the
  test intentionally had no account credential. This proves native hook loading,
  **not** a completed conversational turn or Desktop send recovery. The user's
  credential was neither copied nor linked; Windows denied an attempted
  credential-file symlink before the test proceeded without credentials.
- A second isolated app-server readback saw both distinct v2 hook definitions as
  trusted. No model turn was run because the isolated profile has no auth. This
  verifies registration and native review mechanics, not a working v2 turn.
- Original Desktop message-send failure root cause is still unobserved. This
  repair is not permission to run `auto enable` in the user's active profile.
  Full acceptance still needs an isolated authenticated Desktop send and task
  completion, plus a verified rollback path. Keep the active user route disabled.

## Desktop send interruption after enabling the gate — 2026-09-24 UTC

The user reported that this existing Desktop conversation could not send a
message. They ran `node bin/jev-kit.mjs auto disable` and restarted the client;
messages then sent again. This is a user-observed incident and recovery, not a
confirmed root-cause attribution to either new hook. Do not count the prior fresh
CLI/app-server acceptance as existing Desktop-session acceptance.

Current readback after recovery: `auto/config.json` has `enabled: false`.
`hooks.json` still registers the original reminder and both
`jev-kit-work-gate-v1` definitions; `config.toml` still contains their native
trust entries. The shared `enabled` flag makes both hook handlers return without
work when disabled. Therefore the present installation is **registered and
trusted but inactive**. The user's working conversation must not be re-enabled
or restarted as a diagnostic. No hook or trust files were changed in this audit.

The original failure's precise stage, error and duration remain unobserved.
An earlier probe in this existing conversation used the host-provided
`functions.exec` surface and found no gate event. That was an invalid test of
whether the session loaded native hooks: hosted/unhooked tool paths are outside
the documented `PreToolUse` coverage. The prior inference that the old session
had not loaded the gate is withdrawn. No conclusion about old-session hook
loading follows from that probe.
Possible submit-hook latency, client hook loading and UI transport errors must
be distinguished by timestamped native hook/client evidence before attributing
cause. Keep the recovery state intact; a future fix needs an isolated Desktop
acceptance that proves a normal message can be sent and a task completed, plus
rollback that still works if the submit path is impaired. `auto enable` alone is
not such an acceptance test.

## Native task-gate behavior — 2026-09-23 (UTC logs extend into September 24)

The user explicitly authorized reviewing and trusting the two `jev-kit-work-gate-v1`
definitions. Native app-server `config/batchWrite` applied that trust and
`hooks/list` readback reported both trusted; unrelated definitions were preserved.
This used the native configuration API, not an interactive `/hooks` screen.
The prior config was backed up before the change. No running Desktop task was restarted.

- Real native CLI/app-server plus `openai/gpt-6-sol` received ordinary prompts
  without Jev instructions in the prompts. Registered project rules and trusted
  hooks remained present. These are synthetic isolated tasks, not game acceptance.
- Fresh queue repair: actual `jev-1.13.0` judgment preceded the accepted source
  patch (one question, 564.57 ms inference). Node tests passed 2/2. The same
  session's next independent `peek` task used its own task ID and receipt;
  `REVIEW_REQUIRED` was retained for host inspection, then tests passed 4/4.
- A long task description containing code blocks produced a three-question
  judgment and wrote `third.json`. A separate `continue` turn prepared R4-R6
  independently before writing `second.json`. The original boundary run's R1-R3
  phase degraded on a root validation error; that phase is not counted as a pass.
- Native testing exposed overly strict child-root validation, unhelpful local
  schema errors, missing canonical action feedback, and child submit events that
  reset the parent task revision. Fixes rebase authorized child scopes, report
  pre-inference validation errors, retain exact pending actions, and recognize
  a fresh one-shot same-task handoff only after a permitted delegation.
- Current local Windows suite: **99/99 PASS**, including the new regression cases.
- Native same-agent follow-up: `first-verbatim-r1-r3-20260923` obtained a real
  three-question judgment (539.05 ms), then spawned the reader. After its return,
  the host closed that task and prepared `second-categories-r4-r6-20260923`
  independently (three questions, 583.46 ms), reviewed it and dispatched
  `multi_agent_v1send_input` to the same child. Both handoffs preserved revision 1;
  distinct packet paths and execution events prove separate preparation.
  The prompts did not ask the model to use Jev.
- Stability observation:
  Private logs retain an intermittent concurrent hook failure and compound-read
  denials; subsequent simple reads recovered. This is not a reliability guarantee.
- Private evidence: `W:/Codex/temp/jev-task-gate-20260923/`, including
  `trust-before.json`, `trust-after.json`, `native-real-r2-summary.json`,
  `native-long-final-summary.json`, `native-boundary-summary.json`, and
  `native-delegation-final-events.jsonl`; original receipts remain in the private
  kit home. Full prompts, source hashes, model usage and execution events are retained.
- NOT VERIFIED: existing Desktop tasks loading these hooks, other clients,
  independent child-session capability transfer, hosted/unhooked execution paths,
  general task coverage, performance or savings. Hooks cannot establish private
  thought order or recognize every semantic subtask within one turn.

## Task execution gate candidate — 2026-09-23

Historical pre-trust snapshot (superseded by the native results above):
**PARTIAL / native behavioral acceptance BLOCKED, not complete.** Source implements
task checks, but no unprompted real-model cross-session task has been accepted.

- Local Windows suite: **94/94 PASS**. Includes receipt-less execution denial,
  required host review, exact one-shot call binding, distinct spawn/follow-up tasks,
  same-file independent receipts, long/code/continue boundaries, source/receipt
  changes, zero-inference rejection, failure/no-reroll and explicit degradation.
  Installer preserves old definitions, unrelated hooks and backups and never
  writes native trust. These are unit/integration tests, not autonomous behavior.
- New CLI hook entrypoint subprocess smoke: PASS (receipt-less apply_patch denied,
  no execution dispatched). This was a direct handler process, not native hook
  execution. Packaging dry-run/build checked separately; no release uploaded.
- Direct handler + **real Jev** integration: two ordinary synthetic task strings,
  neither mentioning Jev, over the same two public example sources. Each made one
  call with three questions to `jev-1.13.0`; inference times 679.47/257.85 ms;
  tokens 1257/126 and 1255/126 (input/output). The handler denied the unprepared
  action, then accepted its exact binding after host review. All uncertain/adverse
  results were retained for inspection. Calls were driven by a test harness;
  apply_patch/followup_task were NOT dispatched. This does not prove an independent
  model follows the workflow.
- Real Codex CLI/app-server **0.153.4**, `hooks/list` after local registration:
  old UserPromptSubmit **trusted**; new task UserPromptSubmit **untrusted**;
  new PreToolUse **untrusted**. No hooks.state/config trust edits, bypass flags,
  client restart or game changes. Registration references the working checkout;
  it does not establish the version loaded by any existing Desktop session.
- BLOCKED: native execution of new hooks and all real-model behavioral acceptance
  cases until exact definitions receive native review. This includes fresh tasks,
  an existing session's next task, long/code prompts, continuation to the next
  package, two distinct assignments, follow-up to an existing agent and main-host
  self-execution. Old-session loading, child-session packet handoff and specialized
  tool aliases remain unverified. Hosted tools/write_stdin exceptions remain.
- Large source inputs reject at complete-input limits; host-managed batches are
  documented, but automatic complete-boundary batching and aggregate multi-batch
  execution capabilities are NOT implemented. Semantic task boundaries inside a
  turn and exception eligibility remain host responsibilities. Exact action binding
  is a guardrail, not proof of the host's private thought order or task semantics.
- Private local evidence: `W:/Codex/temp/jev-task-gate-20260923/` (suite, live report,
  hooks-before/after, rule backups), with original provider receipts under the
  local kit's `runs/work/` and lifecycle traces under `auto/work/`. No credentials
  or user transcripts are committed. Source main update is not a new Release.

See [gate contract and activation](docs/execution-gate.md). Historical results below
describe earlier versions and do not override this current acceptance limit.

## Unreleased task-specific work preparation — 2026-09-22

- `jev_prepare_work` now prepares a packet for main-host execution or one subagent assignment. Different tasks require distinct caller-assigned task IDs and independent preparation, including when sources overlap. There is no cross-task cache or global ID registry; every invocation creates a fresh run.
- All supplied sources are pinned. The packet and compact MCP text preserve original excerpts/hashes, constraints, acceptance, grouping suggestions, raw check results and review items. Host review remains required. This does not dispatch agents or generate arbitrary task plans.
- Full local suite: **87/87 PASS**. New checks cover independent model calls/receipts for different tasks sharing files, context binding, complete originals, uncertain groups, unsupported checks, stale input, sensitive/oversized context and provider failure. Real stdio and Pi registration expose 13 tools; deterministic work-packet requests use zero inference. Vendor build PASS (transpilation only).
- One real CLI call on the public synthetic Chinese example: `jev-1.13.0`, 4 questions, 1 workflow inference, 1761 input / 195 output tokens, 836.45 ms inference and 845.56 ms preparation total (not CLI/host end-to-end latency). Defect and test-status materials were assigned to their expected groups. Ownership's raw choice was coordination (confidence 0.86, probability 0.89), below the existing threshold, so it stayed unassigned for review. The false test-passed claim was contradicted (confidence 0.94). Overall status **REVIEW_REQUIRED**, not an all-clear. No reroll or threshold change.
- Independently compared all 3 returned originals and file hashes against disk: PASS. Kept private packet/receipt locally; no whole conversation or game source was sent. This is a small synthetic diagnostic, not production accuracy or savings evidence.
- Refreshed only the existing hook's skill hashes with backup. Two direct invocations of the installed handler returned the main-host/subagent and separate-task reminder. Hook mode/trust remained unchanged; direct handler output does not prove every already-running task follows the rule. Current tasks can select the documented CLI when their MCP registry lacks the new tool.
- NOT RUN: real game implementation with this packet, cross-task coding A/B, Linux/macOS verification, new GitHub Release. Task splitting, dependency/ownership adjudication, execution and final acceptance remain host responsibilities.

## Unreleased source update: pre-work reminder — 2026-09-22

- The global Codex rule now requires a zero-model, purpose-based Jev preflight before each new substantive task or independent work package. It preserves on-demand calls and excludes deterministic work and repeat judgments.
- The existing trusted `UserPromptSubmit` hook command and installed `workflow` mode were retained. Its handler now returns the local pre-work reminder on each eligible substantive prompt in the same task: first `WORKFLOW_HINT`, then `WORKFLOW_REMINDER`. Short continuations and excluded/sensitive prompts still skip locally; global instructions carry the work-package rule.
- A direct invocation of the current installed handler and config for one synthetic session with two distinct eligible work prompts returned `UserPromptSubmit` additional context twice. The second status was `WORKFLOW_REMINDER`, `model: null`, `workflow_inference_calls: 0`, `question_count: 0`. This verifies the handler path, not a new Desktop model turn or every already-running task's refresh.
- Affected hook tests: 16/16 PASS. Full local kit suite after the batch: 81/81 PASS. No Jev API request, model/provider change, restart, or hook trust change was required for this validation.

Release candidate 0.4.2. No blanket claims about speed, savings or semantic accuracy.

- Windows suite: **81/81 PASS**; after deferring the unused provider import, the affected hook/router/entry suites passed **32/32**. The original local companion passed **20/20**. CI for the release commit determines Linux/macOS results.
- Real native Codex app-server hook -> local receiving model fixture: **PASS**. The unchanged trusted hook emitted `WORKFLOW_HINT`, `model: null`, zero inference/questions. Its observed Windows hook duration was 1,859 ms: this is not zero local overhead. No real generative provider was used by this transport check. Existing Desktop tasks were not restarted or proven refreshed.
- The installed original companion launcher returned `jev-evidence-text-v1` through actual stdio MCP with both tools present, two complete pinned originals/hashes, no stderr and zero inference. Full structured results remain compatible. Existing long-lived processes may still emit the previous text layout.
- Workload diagnostic: Chinese report classification **8/8 in 685 ms** observed call time; source verification **3/8 exact labels**, including three direction errors and seven review/escalation items. The Codex classification baseline incurred a hook-induced config read, so its timing cannot establish a fair speed ratio. Full [method and limits](docs/evaluations/workload-benefit-20260922.md).
- Offline presentation of that recorded response retained all originals and judgments while reducing text from **8,769 to 4,887 characters**. The whole serialized MCP result, including the unchanged structured contract, fell from **18,454 to 14,254 characters**. Character reduction is not a measured token or billing saving.

Historical v0.4.1 evidence:

- Final Windows full suite: **77/77 PASS**. A concurrent status-write test exposed Windows rename contention; task receipts now remain authoritative and the status command selects complete per-task records. The affected suites passed **23/23**, then the full suite passed. See release-commit CI for other platforms.
- Regression coverage includes 42 distinct prompts despite old 6/30 counters; 40 real HTTP loopback actions across five chunks; two simultaneous tasks; Chinese payloads above 24 KB but within the character contract; stale-skill refresh; preserved legacy dedup; BOM source discovery; Lua/Luau ranges; backed-up skill upgrade/removal; idle shutdown and simultaneous broker launches.
- Actual in-app browser + real Jev on the final reused parser/candidate code: **PASS**, two clicks / three decisions, **1,602 ms** loop, **1,070 ms** API total, 2,077 input / 141 output tokens. Independent final readback showed Report details open and Revenue 42; status ready. Disposable local fixture only.
- Real Codex submit hook ran with an unchanged trusted command: Jev selected UI with probability 1 but applicability .86 below the .9 threshold, so the probe returned REVIEW_REQUIRED. This is not an accepted recommendation. The final fix explicitly relays such a selected candidate as review evidence; offline tests verify that contract without lowering thresholds or rerolling the failed decision. The receiving model endpoint was a local fixture, not a real generative Codex task.
- Windows Computer Use adapter is implemented and contract-tested. The installed official sky plugin returned Calculator's window but no accessibility tree; Notepad had no targetable window. **A real Jev-selected Windows click is NOT VERIFIED.** macOS native execution and general coding speed/usage improvements are also unverified.
- Source reuse: unchanged jev-browser-use bridge supplies browser candidates; Jev-cu supplies unchanged parseAX/role definitions. Licenses and pinned revisions are retained. Their broad execution entry points and benchmark results are not claimed as this kit's behavior.
- One bounded Jev gate on the earlier hook/broker patch verified three scoped claims but returned overall `escalate` (`review_escalated`). It is not recorded as an automatic review pass. Host inspection and additional concurrency/lifecycle regressions followed, including the Windows status-write repair above; no threshold was relaxed and the same gate was not rerolled.

Historical v0.4.0 evidence (the native-API claim below was corrected by the audit above):

- Local Windows: **62/62 PASS**. Adds hook installation/preservation, Windows PowerShell launch regression, canonical project paths and junction-escape checks, routing budgets, quiet error paths, real loopback broker authorization checks, stale UI decisions, bounded browser scrolling and native adapter contract tests.
- Actual Codex 0.153.4 hook -> real Jev -> next model input: PASS, including selection of the installed `jev-ui` skill (605 ms model route, 2,952 ms hook). Generative endpoint was a local fixture. Existing Desktop task refresh was NOT VERIFIED.
- Actual CUA in-app browser -> real Jev -> two real clicks -> independent final AX readback: PASS. Three decisions, 1,729 ms loop, 2,111 input / 141 output tokens. See `docs/integration-map.md`.
- Real native desktop Computer Use: BLOCKED by the current tool surface; simulated contract checks are not native execution evidence. Browser scroll has automated contract coverage but no live scroll benchmark.
- Integration fixes: quoted Windows executable needed an explicit PowerShell invocation; CUA rejected npm/process access, so an authenticated API-only loopback broker was added. Starting that daemon inside the native submit hook timed out; the host now starts/reuses it automatically after skill routing instead. A fresh native UI-routing test passed after this correction.

Historical v0.3.0 evidence:

- Current local Windows suite: **44/44 PASS**, including real MCP registration of all 12 tools, required-skill zero-inference behavior, offline catalog CLI, stale catalog and overwrite rejection, schema/secret/request limits, uncertainty and failed-response handling.
- Live skill-routing diagnostic: eight distinct synthetic tasks, fixed four-skill catalog, `jev-1.13.0`, expected result 8/8 versus lexical baseline 6/8; 2216 ms summed route time. Raw report, dataset, methodology and explicit limits are in `docs/evaluations/skill-routing-20260922.md`. No Codex workload/token reduction or coding-task speed comparison was measured.

Historical v0.2.0 evidence:

- Current local Windows suite: **33/33 PASS**, including the final local release check. New cases cover client dialects, secret-free config export, JSONC preservation/backups, conflict preflight, scoped installation paths and the Pi adapter using an actual MCP subprocess. See the release commit CI for platform results.
- Real Claude Code 2.1.172 (`mcp get`) and OpenCode 1.18.14 (`mcp list`) connected to the generated registrations in isolated config directories. No paid model task was run and existing client registrations were not edited.
- Client registration tests do not prove each desktop client's behavior. The current matrix in docs/clients.md states what was and was not tested. macOS Finder launch is not verified by shell/Node CI.

Historical v0.1.0 evidence:

- Final local Windows suite: **26/26 PASS**, including DPAPI, actual stdio and CLI. A real Codex CLI was also registered twice successfully in an isolated user/config home; other registrations were not changed.
- One bounded live call through the distributed CLI used public synthetic text stating a test was not run. `jev-1.13.0` returned Noul .02 for successful execution, complete coverage, 292 input / 20 output tokens. This is a connection/one-case check, not general accuracy evidence. No credential or local receipt is included in the repository.
- Packaging check: the npm archive includes built vendor modules and third-party licenses, without node_modules, credential stores or private receipt folders. Release ZIP includes source and lockfile and requires the documented install/build step.

- Original companion checks: 20 passed on Windows after portability changes. These include actual source discovery, source hashes, complete-unit extraction, stale files, path/junction rejection, uncertain evidence retention and stubbed model responses.
- Unified entry checks: actual CLI setup/config/doctor, no-key deterministic evidence, overwrite refusal, unauthorized roots, actual stdio registration of all 11 tools, model override and request bounds. See CI for the final test count and per-platform results.
- Credential test uses a fake value in an isolated home; Windows must roundtrip DPAPI without storing plaintext. It never calls the network.
- `npm run build` transpiles vendored modules, not a claim of full upstream type checking. Upstream full test suites are not included or claimed passing; previously observed upstream Windows portability failures remain outside this kit's focused test result.
- A source brief is partial evidence. Chinese/GDScript semantic accuracy, real game-task speed, other MCP desktop clients and autonomous programming are not accepted by these checks.

Use the GitHub Actions run associated with the release commit for current Windows/Linux/macOS results. CI runs without API secrets. Local doctor is offline and cannot validate API authentication.
